/**
 * Host half of dsh-archive-viewer — archival + knowledge-library engine.
 *
 * 三个能力（全部在 bundle 内自包含，不修改 harness 源码，不引入
 * @deepseek-ai/* 类型依赖；结构化类型与 wire 形状逐字一致）：
 *
 *  1. 自动定期归档（autoArchive）：ctx.interval 周期扫描空闲会话（非 running、
 *     最后活跃早于 maxIdleDays、未被 pin、未归档），调用 workspaceRegistry
 *     .archiveSession() 幂等归档。
 *  2. 自动摘要沉淀经验库（summarize）：归档/完成会话后，用 ctx.llm.stream()
 *     生成结构化摘要（目标、关键决策、产出、可复用经验、遗留提问），以
 *     Markdown + JSON 写入 $DSH_HOME/archive_snapshots/ 经验库目录，供
 *     browser 半区阅读检索。
 *  3. 自定义 RPC 信道（/rpc）：browser 半区经 ctx.connection.rpc.call 读取
 *     摘要，查询经验库，查看自动归档状态。
 *
 * LLM 摘要遵循官方 auxiliary-call 范式（与 dsh-session-title-llm 同构）：
 * 文本块从 StreamChunk 的 text-delta 累积；无 BlockAssembler 依赖，手写极简
 * 收集器保持包完全自包含。
 */

import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const FOLDERS_FILE = 'folders.json'
const BOOKMARKS_FILE = 'bookmarks.json'

/** 插件稳定名（loader 行 id 由 cordis.patch.yml 的 insert 决定）。 */
export const name = 'archive-viewer'

/** 需要注入的宿主服务（均在 web-app 组合内必装；interval 挂在 timer 服务上）。 */
export const inject = ['timer', 'agents', 'sessions', 'sessionPersistence', 'workspaceRegistry', 'llm', 'connection']

/* ------------------------------------------------------------------ */
/* 结构化 ctx（cordis Context 的可用子集），零框架类型依赖              */
/* ------------------------------------------------------------------ */

interface SessionIdBrand { readonly __sessionId?: unique symbol }
type SessionId = string & SessionIdBrand

/** SessionEvent 的结构子集。 */
interface SessionEvent {
  seq: number
  time: number
  type: string
  data: {
    text?: string
    content?: readonly { type: string; text?: string }[]
  }
}

/** Session（实时 store 行）的结构子集。 */
interface LiveSession {
  id: SessionId
  header?: { createdAt?: number; cwd?: string }
  events?: readonly SessionEvent[]
}

/** 持久化会话头部（冷会话）。 */
interface PersistedHeader {
  id: SessionId
  createdAt: number
  cwd?: string
}

/** sessionPersistence.inspect 的结果（冷会话事件读取）。 */
interface SessionInspection {
  header: { id: SessionId; createdAt?: number }
  events: readonly SessionEvent[]
}

/** StreamChunk 的结构子集（只消费 text-delta / finish）。 */
type StreamChunk =
  | { type: 'text-delta'; index: number; text: string }
  | { type: 'block-start' | 'block-end' | 'reasoning-delta' | 'tool-call-delta' | 'usage'; index?: number; text?: string }
  | { type: 'finish'; reason: { kind: string; failure?: { message: string } } }

/** 上下文子集（本插件用到的最小面）。 */
interface HostContext {
  logger: {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
  }
  /** cordis timer mixin。 */
  interval(callback: () => void, delayMs: number): () => void
  on(event: 'agent/status', listener: (payload: { agent: { id: SessionId }; status: string }) => void): () => void
  get<T = unknown>(name: string): T | undefined
  agents: {
    get(id: SessionId): { status: string } | undefined
    roots(): { id: SessionId }[]
  }
  sessions: {
    list(): readonly LiveSession[]
    get(id: SessionId): LiveSession | undefined
    on?(event: string, listener: unknown): () => void
  }
  sessionPersistence: {
    list(): Promise<readonly PersistedHeader[]>
    inspect(id: SessionId, signal?: AbortSignal): Promise<SessionInspection>
    locate(header: PersistedHeader): { kind: string; path: string } | undefined
  }
  workspaceRegistry: {
    archiveSession(id: SessionId): Promise<void>
    archivedSessionIds?: readonly SessionId[] | (() => readonly SessionId[])
  }
  llm: {
    stream(options: {
      provider: string
      model: string
      messages: readonly { role: string; content: readonly { type: 'text'; text: string }[] }[]
      system?: string
      maxTokens?: number
      sessionId?: SessionId
      purpose?: string
      signal?: AbortSignal
    }): AsyncIterable<StreamChunk>
  }
  connection: {
    rpc: {
      handle(
        channel: string,
        handler: (
          endpoint: string,
          payload: unknown,
          signal: AbortSignal,
        ) => Promise<{ ok: boolean; value?: unknown; error?: { code: string; message: string } }>,
        options: { authority: 'loopback' | 'trusted-host' },
      ): () => Promise<void>
    }
  }
}

/** RPC 信封的成功/失败结果（与 host-apiproxy 的 RpcResult 一致）。 */
type RpcResult =
  | { ok: true; value: unknown }
  | { ok: false; error: { code: string; message: string } }

const ok = (value: unknown): RpcResult => ({ ok: true, value })
const fail = (message: string, code = 'archive-viewer-error'): RpcResult =>
  ({ ok: false, error: { code, message } })

/* ------------------------------------------------------------------ */
/* 配置                                                               */
/* ------------------------------------------------------------------ */

/** 插件配置（cordis.patch.yml 的 insert 行 config 合并）。 */
export interface ArchiveViewerConfig {
  /** 自动定期归档开关。 */
  autoArchiveEnabled?: boolean
  /** 多久未活跃的会话视为可归档（天）。 */
  maxIdleDays?: number
  /** 扫描周期（分钟）。 */
  scanIntervalMinutes?: number
  /** 永不自动归档的会话 id（pin）。 */
  pinnedSessionIds?: readonly string[]
  /** 自动摘要沉淀经验库开关。 */
  summarizeEnabled?: boolean
  /** 摘要模型 provider（与 DSH 的 LLM 路由一致，如 deepseek）。 */
  provider?: string
  /** 摘要模型 id。 */
  model?: string
  /** 摘要输入字节上限。 */
  maxInputBytes?: number
  /** 摘要输出 token 上限。 */
  maxOutputTokens?: number
  /** 摘要请求超时（毫秒）。 */
  timeoutMs?: number
}

/** 归档快照（经验库条目）的磁盘形状。 */
export interface ArchiveSnapshot {
  sessionId: string
  title: string
  archivedAt: number
  summaryMarkdown: string
  summary: {
    goal: string
    decisions: string[]
    outcomes: string[]
    lessons: string[]
    openQuestions: string[]
  }
}

const DEFAULT_MAX_IDLE_DAYS = 7
const DEFAULT_SCAN_MINUTES = 30
const DEFAULT_MAX_INPUT_BYTES = 64 * 1024
const DEFAULT_MAX_OUTPUT_TOKENS = 1024
const DEFAULT_TIMEOUT_MS = 60_000

/** 快照目录：$DSH_HOME/archive_snapshots。 */
function snapshotDir(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'archive_snapshots')
}

function mdFilename(sessionId: string): string {
  return `${sessionId.replace(/[^A-Za-z0-9_-]/g, '_')}.md`
}

function jsonFilename(sessionId: string): string {
  return `${sessionId.replace(/[^A-Za-z0-9_-]/g, '_')}.json`
}

/* ------------------------------------------------------------------ */
/* LLM 极简文本收集器（StreamChunk → 纯文本）                          */
/* ------------------------------------------------------------------ */

async function collectText(
  llm: HostContext['llm'],
  options: Parameters<HostContext['llm']['stream']>[0],
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<string> {
  let text = ''
  const deadline = new AbortController()
  const timer = setTimeout(() => deadline.abort(), timeoutMs)
  const onExternalAbort = (): void => deadline.abort()
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true })
  try {
    for await (const chunk of llm.stream({ ...options, signal: deadline.signal })) {
      if (chunk.type === 'text-delta') text += chunk.text
      if (chunk.type === 'finish' && chunk.reason.kind === 'error') {
        throw new Error(chunk.reason.failure?.message ?? 'LLM 摘要生成失败')
      }
      if (chunk.type === 'finish' && chunk.reason.kind === 'aborted') {
        throw new Error('LLM 摘要请求超时或被中止')
      }
    }
  } finally {
    clearTimeout(timer)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }
  return text.trim()
}

/** 从会话事件折叠出"可见文本"（user/assistant 两条主线，忽略工具/系统）。 */
function foldConversation(events: readonly SessionEvent[], maxBytes: number): {
  transcript: string
  title: string
  updatedAt: number | undefined
} {
  const lines: string[] = []
  let title = ''
  let updatedAt: number | undefined
  let bytes = 0
  for (const event of events) {
    updatedAt = event.time > (updatedAt ?? 0) ? event.time : updatedAt
    if (event.type !== 'user/message' && event.type !== 'assistant/message') continue
    const data = event.data
    let text = data.text ?? ''
    if (text === '' && data.content !== undefined) {
      text = data.content
        .filter(block => block.type === 'text' && block.text !== undefined)
        .map(block => block.text ?? '')
        .join('\n')
    }
    if (title === '' && event.type === 'user/message' && text !== '') {
      title = text.replace(/\s+/g, ' ').slice(0, 80)
    }
    const role = event.type === 'user/message' ? '用户' : '助手'
    const line = `[${role}] ${text}`
    if (bytes + Buffer.byteLength(line, 'utf8') > maxBytes) break
    lines.push(line)
    bytes += Buffer.byteLength(line, 'utf8')
  }
  return { transcript: lines.join('\n\n'), title, updatedAt }
}

/** 摘要用的 system prompt（JSON 结构化输出，五个字段）。 */
function summarySystemPrompt(): string {
  return [
    '你是会话归档分析器。阅读给定对话记录，输出中文结构化摘要。',
    '返回 JSON，仅含以下五个键，不要输出其他内容：',
    '{',
    '  "goal": "本次会话的目标（一句话）",',
    '  "decisions": ["做出的关键决策（数组，每项一句话）"],',
    '  "outcomes": ["完成的产出或结果（数组）"],',
    '  "lessons": ["可复用的经验教训（数组）"],',
    '  "openQuestions": ["遗留的未决问题（数组）"]',
    '}',
  ].join('\n')
}

/** 剥离模型输出常见的 ```json … ``` 代码块围栏，只留 JSON 本体。 */
function stripJsonFence(raw: string): string {
  const trimmed = raw.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed)
  return match === null ? trimmed : match[1]!.trim()
}

/** 生成并解析结构化摘要。异常时返回 null（由调用方决定降级为纯文本）。 */
async function generateSummary(
  ctx: HostContext,
  config: ArchiveViewerConfig,
  sessionId: SessionId,
  transcript: string,
  externalSignal?: AbortSignal,
): Promise<{ goal: string; decisions: string[]; outcomes: string[]; lessons: string[]; openQuestions: string[] } | null> {
  const provider = config.provider
  const model = config.model
  if (provider === undefined || model === undefined) return null
  const maxTokens = config.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
  try {
    const raw = await collectText(ctx.llm, {
      provider,
      model,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: `对话记录：\n${transcript}` }],
        },
      ],
      system: summarySystemPrompt(),
      maxTokens,
      sessionId,
      // 契约内取值（llm 的 GenerateOptions.purpose 为 compaction | session-title），
      // 自定义值会走适配器 default 分支，避免上游收紧联合类型后失效。
      purpose: 'compaction',
    }, config.timeoutMs ?? DEFAULT_TIMEOUT_MS, externalSignal)
    const parsed = JSON.parse(stripJsonFence(raw)) as {
      goal?: unknown
      decisions?: unknown
      outcomes?: unknown
      lessons?: unknown
      openQuestions?: unknown
    }
    const strings = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    return {
      goal: typeof parsed.goal === 'string' ? parsed.goal : '',
      decisions: strings(parsed.decisions),
      outcomes: strings(parsed.outcomes),
      lessons: strings(parsed.lessons),
      openQuestions: strings(parsed.openQuestions),
    }
  } catch (error) {
    ctx.logger.warn(`[archive-viewer] summary failed for ${String(sessionId)}: ${String(error)}`)
    return null
  }
}

/** 摘要对象 → 人类可读 Markdown。 */
function summaryMarkdown(sessionId: string, title: string, summary: {
  goal: string
  decisions: string[]
  outcomes: string[]
  lessons: string[]
  openQuestions: string[]
}, archivedAt: number): string {
  const items = (label: string, values: readonly string[]): string =>
    values.length === 0 ? '' : `## ${label}\n${values.map(value => `- ${value}`).join('\n')}\n`
  return [
    `# ${title === '' ? '未命名会话' : title}`,
    '',
    `> 会话 ID：\`${sessionId}\` · 归档于 ${new Date(archivedAt).toLocaleString()}`,
    '',
    summary.goal === '' ? '' : `## 目标\n${summary.goal}\n`,
    items('关键决策', summary.decisions),
    items('产出', summary.outcomes),
    items('可复用经验', summary.lessons),
    items('遗留问题', summary.openQuestions),
  ].filter(line => line !== '').join('\n')
}

/* ------------------------------------------------------------------ */
/* 快照存取（经验库）                                                  */
/* ------------------------------------------------------------------ */

async function snapshotDirEnsure(): Promise<string> {
  const dir = snapshotDir()
  await mkdir(dir, { recursive: true })
  return dir
}

async function writeSnapshot(snapshot: ArchiveSnapshot): Promise<void> {
  const dir = await snapshotDirEnsure()
  await Promise.all([
    writeFile(join(dir, jsonFilename(snapshot.sessionId)), JSON.stringify(snapshot, null, 2), 'utf8'),
    writeFile(join(dir, mdFilename(snapshot.sessionId)), snapshot.summaryMarkdown, 'utf8'),
  ])
}

async function listSnapshots(): Promise<readonly ArchiveSnapshot[]> {
  const dir = snapshotDir()
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const snapshots: ArchiveSnapshot[] = []
  for (const name of names) {
    if (!name.endsWith('.json') || name === '.json' || name.startsWith('.')) continue
    // 同目录下的文件夹/书签数据文件不是快照，跳过。
    if (name === FOLDERS_FILE || name === BOOKMARKS_FILE) continue
    try {
      const raw = await readFile(join(dir, name), 'utf8')
      snapshots.push(JSON.parse(raw) as ArchiveSnapshot)
    } catch {
      // 损坏的条目跳过，不阻断列表
    }
  }
  return snapshots.sort((a, b) => b.archivedAt - a.archivedAt)
}

async function readSnapshot(sessionId: string): Promise<ArchiveSnapshot | undefined> {
  const dir = snapshotDir()
  try {
    const raw = await readFile(join(dir, jsonFilename(sessionId)), 'utf8')
    return JSON.parse(raw) as ArchiveSnapshot
  } catch {
    return undefined
  }
}

/* ------------------------------------------------------------------ */
/* 归档文件夹（Voyager 式文件夹归档：会话可归入自定义文件夹）          */
/* ------------------------------------------------------------------ */

/** 归档文件夹（持久化形状）。 */
export interface ArchiveFolder {
  id: string
  name: string
  /** 会话 → 文件夹的归属表（sessionId → folderId）。 */
  assignment?: Record<string, string>
}

export class FolderStore {
  private cache: ArchiveFolder[] | null = null
  /** 写队列：串行化 save，避免固定 tmp 名的并发 rename 竞态。 */
  private writeQueue: Promise<void> = Promise.resolve()
  /** 数据目录（默认 $DSH_HOME/archive_snapshots；测试可注入临时目录）。 */
  private readonly dir: string

  constructor(dir?: string) {
    this.dir = dir ?? snapshotDir()
  }

  private async file(): Promise<string> {
    await mkdir(this.dir, { recursive: true })
    return join(this.dir, FOLDERS_FILE)
  }

  async load(): Promise<ArchiveFolder[]> {
    if (this.cache !== null) return this.cache
    try {
      const raw = await readFile(await this.file(), 'utf8')
      const parsed = JSON.parse(raw) as { folders?: ArchiveFolder[] } | ArchiveFolder[]
      this.cache = Array.isArray(parsed) ? parsed : (parsed.folders ?? [])
    } catch (error) {
      // 损坏文件不静默清空：保留现场，避免后续 save() 用空数据覆盖用户数据。
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`archive folders file is corrupt (${await this.file()}): ${String(error)}`)
      }
      this.cache = []
    }
    return this.cache
  }

  private async save(): Promise<void> {
    const file = await this.file()
    const tmp = `${file}.tmp`
    const snapshot = JSON.stringify({ folders: this.cache ?? [] }, null, 2)
    // 串行化写入：并发 save 时后到的等待前一个完成，避免共用 tmp 名的 rename 竞态。
    const task = this.writeQueue.then(async () => {
      await writeFile(tmp, snapshot, 'utf8')
      await rename(tmp, file)
    })
    this.writeQueue = task.catch(() => undefined)
    await task
  }

  async list(): Promise<ArchiveFolder[]> {
    return (await this.load()).map(folder => ({ ...folder, assignment: { ...(folder.assignment ?? {}) } }))
  }

  async create(name: string): Promise<ArchiveFolder> {
    const folders = await this.load()
    const folder: ArchiveFolder = {
      id: `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      assignment: {},
    }
    folders.push(folder)
    await this.save()
    return { ...folder }
  }

  async rename(id: string, name: string): Promise<ArchiveFolder | undefined> {
    const folders = await this.load()
    const folder = folders.find(item => item.id === id)
    if (folder === undefined) return undefined
    folder.name = name
    await this.save()
    return { ...folder, assignment: { ...(folder.assignment ?? {}) } }
  }

  async remove(id: string): Promise<boolean> {
    const folders = await this.load()
    const index = folders.findIndex(item => item.id === id)
    if (index === -1) return false
    folders.splice(index, 1)
    for (const folder of folders) {
      if (folder.assignment !== undefined) {
        for (const sessionId of Object.keys(folder.assignment)) {
          if (folder.assignment[sessionId] === id) delete folder.assignment[sessionId]
        }
      }
    }
    await this.save()
    return true
  }

  /** 把会话移入文件夹（assignment 为空串表示移出到未归档）。 */
  async move(sessionId: string, folderId: string | undefined): Promise<ArchiveFolder[] | undefined> {
    const folders = await this.load()
    if (folderId !== undefined && !folders.some(item => item.id === folderId)) return undefined
    for (const folder of folders) {
      const assignment = folder.assignment ?? {}
      if (folderId !== undefined && folder.id === folderId) {
        assignment[sessionId] = folderId
      } else {
        delete assignment[sessionId]
      }
      folder.assignment = assignment
    }
    await this.save()
    return this.list()
  }

  /** 全部会话 → 文件夹 id 映射（未归类的会话不在映射内）。 */
  async assignmentOf(): Promise<Readonly<Record<string, string>>> {
    const folders = await this.load()
    const map: Record<string, string> = {}
    for (const folder of folders) {
      for (const [sessionId, folderId] of Object.entries(folder.assignment ?? {})) {
        if (folderId === folder.id) map[sessionId] = folderId
      }
    }
    return map
  }

  /** 会话删除时清理其文件夹归属（无归属时无操作）。 */
  async removeForSession(sessionId: string): Promise<void> {
    const folders = await this.load()
    let touched = false
    for (const folder of folders) {
      if (folder.assignment !== undefined && folder.assignment[sessionId] !== undefined) {
        delete folder.assignment[sessionId]
        touched = true
      }
    }
    if (touched) await this.save()
  }
}

const folderStore = new FolderStore()

/* ------------------------------------------------------------------ */
/* 收藏 + 便签（bookmarks.json：sessionId → { bookmarked, note }）     */
/* ------------------------------------------------------------------ */

/** 会话收藏（持久化形状）。 */
export interface BookmarkEntry {
  sessionId: string
  bookmarked: boolean
  note: string
  updatedAt: number
}

export class BookmarkStore {
  private cache: Record<string, BookmarkEntry> | null = null
  /** 写队列：串行化 save，避免固定 tmp 名的并发 rename 竞态。 */
  private writeQueue: Promise<void> = Promise.resolve()
  /** 数据目录（默认 $DSH_HOME/archive_snapshots；测试可注入临时目录）。 */
  private readonly dir: string

  constructor(dir?: string) {
    this.dir = dir ?? snapshotDir()
  }

  private async file(): Promise<string> {
    await mkdir(this.dir, { recursive: true })
    return join(this.dir, BOOKMARKS_FILE)
  }

  async load(): Promise<Record<string, BookmarkEntry>> {
    if (this.cache !== null) return this.cache
    try {
      const raw = await readFile(await this.file(), 'utf8')
      this.cache = JSON.parse(raw) as Record<string, BookmarkEntry>
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`bookmarks file is corrupt (${await this.file()}): ${String(error)}`)
      }
      this.cache = {}
    }
    return this.cache
  }

  private async save(): Promise<void> {
    const file = await this.file()
    const tmp = `${file}.tmp`
    const snapshot = JSON.stringify(this.cache ?? {}, null, 2)
    const task = this.writeQueue.then(async () => {
      await writeFile(tmp, snapshot, 'utf8')
      await rename(tmp, file)
    })
    this.writeQueue = task.catch(() => undefined)
    await task
  }

  async list(): Promise<readonly BookmarkEntry[]> {
    const entries = Object.values(await this.load())
    return entries
      .filter(entry => entry.bookmarked || entry.note !== '')
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /** 切换收藏标记，返回最新条目。 */
  async toggle(sessionId: string): Promise<BookmarkEntry> {
    const entries = await this.load()
    const existing = entries[sessionId]
    const entry: BookmarkEntry = {
      sessionId,
      bookmarked: !(existing?.bookmarked ?? false),
      note: existing?.note ?? '',
      updatedAt: Date.now(),
    }
    if (!entry.bookmarked && entry.note === '') delete entries[sessionId]
    else entries[sessionId] = entry
    await this.save()
    return entry
  }

  /** 设置便签（空串表示删除便签）。 */
  async setNote(sessionId: string, note: string): Promise<BookmarkEntry | null> {
    const entries = await this.load()
    const existing = entries[sessionId]
    if (existing === undefined) {
      if (note === '') return null
      const entry: BookmarkEntry = { sessionId, bookmarked: false, note, updatedAt: Date.now() }
      entries[sessionId] = entry
      await this.save()
      return entry
    }
    existing.note = note
    existing.updatedAt = Date.now()
    if (!existing.bookmarked && existing.note === '') {
      delete entries[sessionId]
      await this.save()
      return null
    }
    await this.save()
    return existing
  }

  /** 会话删除时清理其书签条目（无条目时无操作）。 */
  async removeForSession(sessionId: string): Promise<void> {
    const entries = await this.load()
    if (entries[sessionId] === undefined) return
    delete entries[sessionId]
    await this.save()
  }
}

const bookmarkStore = new BookmarkStore()

/* ------------------------------------------------------------------ */
/* 删除会话（文件级清理：日志文件 + 快照 + 书签 + 文件夹归属）        */
/* ------------------------------------------------------------------ */

/**
 * 删除一个会话（仅限非 running）：
 *  1. 删除会话日志文件（路径经官方 sessionPersistence.locate 获取，
 *     不硬编码后端目录布局，后端实现变化时自动跟随）
 *  2. 删除归档快照（json + md）
 *  3. 清理书签条目
 *  4. 清理文件夹归属
 * workspace 注册表的 sessionIds 不在此处改写——持久化文件删除后，
 * 下一次启动 bootstrap 会以 header 重建，自动过滤已删会话。
 * @returns 删除是否成功（目标不存在视为失败并给出原因）。
 */
async function deleteSession(ctx: HostContext, sessionId: SessionId): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (ctx.agents.get(sessionId)?.status === 'running') return { ok: false, reason: '运行中的会话不能删除' }

  const headers = await ctx.sessionPersistence.list()
  const header = headers.find(item => item.id === sessionId)
  if (header === undefined) return { ok: false, reason: '会话不存在或尚未持久化' }

  // 1) 删除会话日志文件（官方 locate 给出后端拥有的绝对路径）。
  const location = ctx.sessionPersistence.locate(header)
  if (location !== undefined) {
    try {
      await rm(location.path, { force: true })
    } catch (error) {
      return { ok: false, reason: `删除日志失败：${error instanceof Error ? error.message : String(error)}` }
    }
  }

  // 2) 清理快照文件。
  await Promise.all([
    rm(join(snapshotDir(), jsonFilename(sessionId)), { force: true }).catch(() => undefined),
    rm(join(snapshotDir(), mdFilename(sessionId)), { force: true }).catch(() => undefined),
  ])

  // 3) 清理书签条目。
  try {
    await bookmarkStore.removeForSession(sessionId)
  } catch (error) {
    ctx.logger.warn(`[archive-viewer] bookmark cleanup failed for ${String(sessionId)}: ${String(error)}`)
  }

  // 4) 清理文件夹归属。
  try {
    await folderStore.removeForSession(sessionId)
  } catch (error) {
    ctx.logger.warn(`[archive-viewer] folder cleanup failed for ${String(sessionId)}: ${String(error)}`)
  }

  return { ok: true }
}

/* ------------------------------------------------------------------ */
/* 自动定期归档                                                        */
/* ------------------------------------------------------------------ */

/**
 * 扫描全部会话（live + persisted），返回满足自动归档条件的 id：
 * 非 running、最后活跃早于 maxIdleDays、未 pin、未归档。
 */
async function collectAutoArchiveCandidates(
  ctx: HostContext,
  config: ArchiveViewerConfig,
): Promise<readonly SessionId[]> {
  const maxIdle = Date.now() - (config.maxIdleDays ?? DEFAULT_MAX_IDLE_DAYS) * 24 * 60 * 60 * 1000
  const pinned = new Set(config.pinnedSessionIds ?? [])
  const archivedRaw = ctx.workspaceRegistry.archivedSessionIds
  const archived = new Set(
    typeof archivedRaw === 'function' ? archivedRaw() : archivedRaw ?? [],
  )
  const liveIds = new Set(ctx.sessions.list().map(session => session.id))
  const candidates = new Set<SessionId>()

  for (const session of ctx.sessions.list()) {
    if (pinned.has(session.id) || archived.has(session.id)) continue
    if (ctx.agents.get(session.id)?.status === 'running') continue
    const updatedAt = session.events?.at(-1)?.time
    if (updatedAt !== undefined && updatedAt < maxIdle) candidates.add(session.id)
  }

  // 冷会话（已持久化但不在 live 内存）：按 createdAt 粗筛 + 存档时间兜底。
  // 用 createdAt 作为最后活跃的下界：createdAt 早于阈值即可尝试归档
  // （archiveSession 幂等，对未知会话拒绝）。
  // 注意：sessionPersistence.list() 也包含 live 会话（backend 首 append 即物化），
  // 必须按 liveIds 排除——否则「创建早但今天仍活跃」的会话会被误归档。
  for (const header of await ctx.sessionPersistence.list()) {
    if (candidates.has(header.id) || pinned.has(header.id) || archived.has(header.id)) continue
    if (liveIds.has(header.id)) continue
    if (header.createdAt < maxIdle) candidates.add(header.id)
  }

  return [...candidates]
}

/** 执行一轮自动归档，返回归档数量。归档前先沉淀快照（会话尚在 live，可读全量事件）。 */
async function runArchiveScan(ctx: HostContext, config: ArchiveViewerConfig): Promise<number> {
  let archived = 0
  const candidates = await collectAutoArchiveCandidates(ctx, config)
  ctx.logger.info(`[archive-viewer] scan tick: ${candidates.length} candidate(s)`)
  for (const id of candidates) {
    // 快照与归档之间可能耗时数十秒（LLM 摘要），会话可能在此期间恢复为 running，
    // 归档前必须复查，避免把活跃会话归档。
    if (ctx.agents.get(id)?.status === 'running') continue
    // 归档前先沉淀摘要（此时会话仍 live，事件完整）。
    try {
      await snapshotSession(ctx, config, id, false)
    } catch (error) {
      ctx.logger.warn(`[archive-viewer] snapshot skipped for ${String(id)}: ${String(error)}`)
    }
    if (ctx.agents.get(id)?.status === 'running') continue
    try {
      await ctx.workspaceRegistry.archiveSession(id)
      archived += 1
    } catch (error) {
      ctx.logger.warn(`[archive-viewer] auto-archive failed for ${String(id)}: ${String(error)}`)
    }
  }
  return archived
}

/**
 * 归档或完成会话 → 生成摘要快照（经验库）。
 * @param sessionId - 目标会话。
 * @param force - 已存在快照时是否重新生成。
 */
async function snapshotSession(
  ctx: HostContext,
  config: ArchiveViewerConfig,
  sessionId: SessionId,
  force: boolean,
  externalSignal?: AbortSignal,
): Promise<ArchiveSnapshot | null> {
  if (!(config.summarizeEnabled ?? true)) return null
  const existing = await readSnapshot(sessionId)
  if (existing !== undefined && !force) return existing

  // live 会话直接读内存事件；已归档/冷会话经 sessionPersistence.inspect 读取，
  // 保证 refresh 对归档会话也能重新生成摘要。
  const session = ctx.sessions.get(sessionId)
  let events = session?.events ?? []
  if (events.length === 0) {
    try {
      const inspection = await ctx.sessionPersistence.inspect(sessionId)
      events = inspection.events
    } catch (error) {
      ctx.logger.warn(`[archive-viewer] inspect failed for ${String(sessionId)}: ${String(error)}`)
      events = []
    }
  }
  const { transcript, title, updatedAt } = foldConversation(events, config.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES)
  if (transcript === '') return null

  const summary = await generateSummary(ctx, config, sessionId, transcript, externalSignal)
  const snapshot: ArchiveSnapshot = {
    sessionId,
    title,
    archivedAt: updatedAt ?? Date.now(),
    summaryMarkdown: summaryMarkdown(sessionId, title, summary ?? {
      goal: transcript.slice(0, 200),
      decisions: [],
      outcomes: [],
      lessons: [],
      openQuestions: [],
    }, updatedAt ?? Date.now()),
    summary: summary ?? {
      goal: transcript.slice(0, 200),
      decisions: [],
      outcomes: [],
      lessons: [],
      openQuestions: [],
    },
  }
  await writeSnapshot(snapshot)
  return snapshot
}

/* ------------------------------------------------------------------ */
/* 插件入口                                                            */
/* ------------------------------------------------------------------ */

/**
 * Mount the host half.
 * @param ctx - host plugin context.
 * @param config - plugin configuration (config 合并自 cordis.patch.yml)。
 */
export function apply(ctx: HostContext, config: ArchiveViewerConfig): () => void {
  const cfg: ArchiveViewerConfig = { ...config }
  ctx.logger.info(`[archive-viewer] host half loaded (autoArchive=${String(cfg.autoArchiveEnabled ?? true)}, summarize=${String(cfg.summarizeEnabled ?? true)})`)
  const disposers: (() => void)[] = []

  // 自动定期归档：周期扫描（间隔 ≥ 1 分钟，防抖）。
  if (cfg.autoArchiveEnabled !== false) {
    const minutes = Math.max(1, cfg.scanIntervalMinutes ?? DEFAULT_SCAN_MINUTES)
    let scanning = false
    disposers.push(ctx.interval(() => {
      if (scanning) return
      scanning = true
      void runArchiveScan(ctx, cfg)
        .then(async (count) => {
          if (count > 0) ctx.logger.info(`[archive-viewer] auto-archived ${count} idle session(s)`)
        })
        .catch(error => ctx.logger.error(`[archive-viewer] archive scan failed: ${String(error)}`))
        .finally(() => { scanning = false })
    }, minutes * 60 * 1000))
    ctx.logger.info(`[archive-viewer] auto-archive scan every ${minutes} minute(s)`)
  }

  // 会话完成（running → idle 且非手动停止语义）时沉淀摘要。
  // 手动停止（aborted）也在 idle 边缘，但把内容沉淀下来无害且更全；
  // LLM 摘要只在该会话确有过往对话时生成。
  if (cfg.summarizeEnabled !== false) {
    disposers.push(ctx.on('agent/status', ({ agent, status }) => {
      if (status !== 'idle') return
      void snapshotSession(ctx, cfg, agent.id, false)
        .then(snapshot => {
          if (snapshot !== null) {
            ctx.logger.info(`[archive-viewer] snapshot ready for ${String(agent.id)}`)
          }
        })
        .catch(error => ctx.logger.warn(`[archive-viewer] snapshot failed for ${String(agent.id)}: ${String(error)}`))
    }))
  }

  // 自定义 RPC 信道：browser 半区读经验库 / 查状态 / 强制快照。
  // 外层 try/catch 保证任何 handler 异常都收敛为 RPC 信封（{ok:false,error}），
  // 而不是让连接层回 HTTP 500 裸文本。
  const dispose = ctx.connection.rpc.handle('/rpc', async (endpoint, payload, signal) => {
    try {
      switch (endpoint) {
        case 'archive.summary.list': {
          return ok(await listSnapshots())
        }
        case 'archive.summary.get': {
          const sessionId = (payload as { sessionId?: unknown } | null)?.sessionId
          if (typeof sessionId !== 'string' || sessionId === '') return fail('sessionId is required', 'bad-request')
          const snapshot = await readSnapshot(sessionId)
          return snapshot === undefined
            ? fail('no snapshot for this session', 'not-found')
            : ok(snapshot)
        }
        case 'archive.summary.refresh': {
          const sessionId = (payload as { sessionId?: unknown } | null)?.sessionId
          if (typeof sessionId !== 'string' || sessionId === '') return fail('sessionId is required', 'bad-request')
          if (!(cfg.summarizeEnabled ?? true)) return fail('摘要功能未开启（插件配置 summarizeEnabled=false）', 'disabled')
          if (cfg.provider === undefined || cfg.model === undefined) return fail('摘要模型未配置（插件 config 需 provider/model）', 'misconfigured')
          const snapshot = await snapshotSession(ctx, cfg, sessionId as SessionId, true, signal)
          return snapshot === null
            ? fail('该会话没有可摘要的对话内容', 'empty')
            : ok(snapshot)
        }
        case 'archive.auto.run': {
          const count = await runArchiveScan(ctx, cfg)
          return ok({ archived: count })
        }
        case 'archive.auto.status': {
          return ok({
            enabled: (cfg.autoArchiveEnabled ?? true) !== false,
            maxIdleDays: cfg.maxIdleDays ?? DEFAULT_MAX_IDLE_DAYS,
            scanIntervalMinutes: Math.max(1, cfg.scanIntervalMinutes ?? DEFAULT_SCAN_MINUTES),
            summarizeEnabled: (cfg.summarizeEnabled ?? true) !== false,
            snapshotDir: snapshotDir(),
          })
        }
        case 'archive.folder.list': {
          return ok({ folders: await folderStore.list(), assignment: await folderStore.assignmentOf() })
        }
        case 'archive.folder.create': {
          const name = (payload as { name?: unknown } | null)?.name
          if (typeof name !== 'string' || name.trim() === '') return fail('folder name is required', 'bad-request')
          if (name.trim().length > 64) return fail('folder name is too long (max 64 chars)', 'bad-request')
          return ok({ folders: await folderStore.list(), assignment: await folderStore.assignmentOf(), created: await folderStore.create(name.trim()) })
        }
        case 'archive.folder.rename': {
          const p = payload as { folderId?: unknown; name?: unknown } | null
          if (typeof p?.folderId !== 'string' || p.folderId === '') return fail('folderId is required', 'bad-request')
          if (typeof p.name !== 'string' || p.name.trim() === '') return fail('folder name is required', 'bad-request')
          if (p.name.trim().length > 64) return fail('folder name is too long (max 64 chars)', 'bad-request')
          const renamed = await folderStore.rename(p.folderId, p.name.trim())
          if (renamed === undefined) return fail('folder not found', 'not-found')
          return ok({ folders: await folderStore.list(), assignment: await folderStore.assignmentOf() })
        }
        case 'archive.folder.remove': {
          const p = payload as { folderId?: unknown } | null
          if (typeof p?.folderId !== 'string' || p.folderId === '') return fail('folderId is required', 'bad-request')
          const removed = await folderStore.remove(p.folderId)
          if (!removed) return fail('folder not found', 'not-found')
          return ok({ folders: await folderStore.list(), assignment: await folderStore.assignmentOf() })
        }
        case 'archive.folder.move': {
          const p = payload as { sessionId?: unknown; folderId?: unknown } | null
          if (typeof p?.sessionId !== 'string' || p.sessionId === '') return fail('sessionId is required', 'bad-request')
          if (p.folderId !== undefined && typeof p.folderId !== 'string') return fail('invalid folderId', 'bad-request')
          const after = await folderStore.move(p.sessionId, p.folderId === '' ? undefined : p.folderId)
          if (after === undefined) return fail('folder not found', 'not-found')
          return ok({ folders: after, assignment: await folderStore.assignmentOf() })
        }
        case 'bookmark.list': {
          return ok({ bookmarks: await bookmarkStore.list() })
        }
        case 'bookmark.toggle': {
          const p = payload as { sessionId?: unknown } | null
          if (typeof p?.sessionId !== 'string' || p.sessionId === '') return fail('sessionId is required', 'bad-request')
          const entry = await bookmarkStore.toggle(p.sessionId)
          // 幽灵条目（toggle 后 bookmarked=false 且无便签）不返回，与 setNote 对齐。
          return ok({ bookmarks: await bookmarkStore.list(), updated: entry.bookmarked || entry.note !== '' ? entry : null })
        }
        case 'bookmark.note': {
          const p = payload as { sessionId?: unknown; note?: unknown } | null
          if (typeof p?.sessionId !== 'string' || p.sessionId === '') return fail('sessionId is required', 'bad-request')
          if (typeof p.note !== 'string') return fail('note must be a string', 'bad-request')
          const entry = await bookmarkStore.setNote(p.sessionId, p.note)
          // setNote 清空后条目可能被删除（幽灵），返回 null 与 toggle 对齐。
          return ok({ bookmarks: await bookmarkStore.list(), updated: entry })
        }
        case 'archive.session.delete': {
          const p = payload as { sessionId?: unknown } | null
          if (typeof p?.sessionId !== 'string' || p.sessionId === '') return fail('sessionId is required', 'bad-request')
          const result = await deleteSession(ctx, p.sessionId as SessionId)
          return result.ok
            ? ok({ deleted: true })
            : fail(result.reason, 'delete-failed')
        }
        default:
          return fail(`unknown endpoint ${JSON.stringify(endpoint)}`, 'unknown-endpoint')
      }
    } catch (error) {
      ctx.logger.error(`[archive-viewer] rpc ${JSON.stringify(endpoint)} failed: ${String(error)}`)
      // 原始错误保留在日志；对用户只给固定中文文案，避免泄露实现细节。
      return fail('操作失败，请查看 dsh 日志', 'handler-error')
    }
  }, { authority: 'loopback' })
  disposers.push(() => { void dispose().catch(() => undefined) })
  // 返回 disposer：插件卸载/热重载时 cordis 会调用，注销 interval、事件监听与 RPC 路由。
  return () => { for (const dispose of disposers) dispose() }
}