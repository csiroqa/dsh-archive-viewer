/**
 * ArchivePanelView — 已归档会话查看面板（渲染在 sidebar.footer.action 注册项的
 * fixed 层叠内，样式全部走 --dsw-alias-* 令牌以跟随皮肤）。
 *
 * 信息架构（对标 Voyager 文件夹归档）：
 *  - 左栏：文件夹树 ——「全部归档」根 / 用户自定义文件夹 / 「未分类」（不在任何
 *    文件夹的归档会话）/「经验库」（LLM 沉淀的知识卡片）。文件夹可新建、重命名、
 *    删除、把会话移入/移出。
 *  - 右栏：时间线卡片流 —— 归档会话按更新时间倒序排列，卡片带勾选（批量操作）、
 *    摘要预览、对话查看、ZIP 导出、恢复会话。
 *  - 底部批量操作条：勾选 ≥1 项时出现，支持批量导出 / 生成摘要 / 恢复 / 移动。
 *
 * 数据源（只读 store + RPC）：
 *  - stores.workspaces.snapshot：注册表全局归档集合 archivedSessionIds + 工作区
 *  - stores.sessions.snapshot：全部会话行（归档不删日志，仍在 session.list）
 *  - stores.connection.api.sessions.history：按页读取会话事件
 *  - connection.rpc.call('/rpc', 'archive.folder.*')：文件夹 CRUD + 会话归属
 *  - connection.rpc.call('/rpc', 'archive.summary.*')：经验库快照读写
 *  - GET /api/session.export：宿主侧 ZIP 导出
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type {
  ArchiveFolder, ArchiveRowInfo, ArchiveSnapshot, ArchiveStores, BookmarkEntry, BookmarkPayload,
  ConnectionHandle, FolderPayload, HistoryEntry, RpcResult, SessionEvent, SessionId,
} from './types.ts'

/** 历史一页的消息数（chunk/tool 事件随消息成组返回，20 条消息已是一大页）。 */
const PAGE_SIZE = 20

/** 侧边栏行内只渲染这两类事件（其余如 turn/start、tool/call 等跳过）。 */
const CHAT_TYPES = new Set(['user/message', 'assistant/message'])

/** store 适配器：useSyncExternalStore 直接消费 SnapshotStore。 */
function subscribeOf<T>(store: { subscribe(listener: () => void): () => void }): (listener: () => void) => () => void {
  return listener => store.subscribe(listener)
}
function snapshotOf<T>(store: { getSnapshot(): T }): () => T {
  return () => store.getSnapshot()
}

/** 会话 id → 工作区标题（用于行内归属提示）。 */
function workspaceTitlesOf(items: readonly { sessionIds: readonly string[]; title: string }[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>()
  for (const item of items) {
    for (const id of item.sessionIds) if (!map.has(id)) map.set(id, item.title)
  }
  return map
}

/** 从事件数据提取可读文本。 */
function textOf(event: SessionEvent): string {
  const data = event.data
  if (data.text !== undefined && data.text !== '') return data.text
  const parts: string[] = []
  for (const block of data.content ?? []) {
    if (block.type === 'text') {
      if (block.text !== '') parts.push(block.text)
    } else {
      parts.push(`[${block.type}]`)
    }
  }
  return parts.join('\n')
}

/** 时间戳 → 本地化字符串。 */
function formatTime(time: number): string {
  try {
    return new Date(time).toLocaleString()
  } catch {
    return String(time)
  }
}

/** 干净的下载文件名（宿主端点约定的 id 清理规则）。 */
function zipFilename(sessionId: string): string {
  return `dsh-session-${sessionId.replace(/[^A-Za-z0-9_-]/g, '_')}.zip`
}

/** 触发宿主 ZIP 导出下载（HEAD 预检 + 原生下载锚点，与官方下载逻辑一致）。 */
async function downloadLogZip(sessionId: string): Promise<void> {
  const origin = globalThis.location?.origin
  const url = new URL('/api/session.export', origin !== undefined && origin !== 'null' ? origin : 'http://dsh.internal')
  url.searchParams.set('sessionId', sessionId)
  url.searchParams.set('includeDescendants', 'true')
  const response = await fetch(url, { method: 'HEAD' })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}${detail === '' ? '' : ` ${detail}`}`)
  }
  const anchor = document.createElement('a')
  anchor.href = url.toString()
  anchor.download = zipFilename(sessionId)
  anchor.click()
}

/** 触发宿主取消归档（workspace.unarchiveSession RPC，RPC 信封与官方客户端一致）。 */
async function unarchiveSessionRpc(sessionId: string): Promise<void> {
  const origin = globalThis.location?.origin
  const response = await fetch(
    new URL('/api/workspace.unarchiveSession', origin !== undefined && origin !== 'null' ? origin : 'http://dsh.internal'),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: crypto.randomUUID(),
        method: 'workspace.unarchiveSession',
        payload: { sessionId },
      }),
    },
  )
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const envelope = (await response.json()) as {
    result?: { ok?: boolean; error?: { message?: string } }
  }
  if (envelope.result?.ok !== true) {
    throw new Error(envelope.result?.error?.message ?? '未知错误')
  }
}

/** 经通用 RPC 信道读取归档快照（经验库）列表。 */
async function listSummariesRpc(connection: ConnectionHandle): Promise<readonly ArchiveSnapshot[]> {
  const result = await connection.rpc.call('/rpc', 'archive.summary.list')
  if (!result.ok) throw new Error(result.error?.message ?? '读取经验库失败')
  return (result.value as { sessionId: string; title: string; archivedAt: number; summaryMarkdown: string; summary: ArchiveSnapshot['summary'] }[] ?? [])
    .map((value, index) => ({
      sessionId: String(value.sessionId),
      title: String(value.title ?? ''),
      archivedAt: Number(value.archivedAt ?? 0),
      summaryMarkdown: String(value.summaryMarkdown ?? ''),
      summary: {
        goal: String(value.summary?.goal ?? ''),
        decisions: Array.isArray(value.summary?.decisions) ? value.summary!.decisions.map(String) : [],
        outcomes: Array.isArray(value.summary?.outcomes) ? value.summary!.outcomes.map(String) : [],
        lessons: Array.isArray(value.summary?.lessons) ? value.summary!.lessons.map(String) : [],
        openQuestions: Array.isArray(value.summary?.openQuestions) ? value.summary!.openQuestions.map(String) : [],
      },
    }))
}

/** 经通用 RPC 信道读取单个会话的快照（不存在或强制刷新时请求生成）。 */
async function readSummaryRpc(connection: ConnectionHandle, sessionId: string, refresh: boolean): Promise<ArchiveSnapshot | null> {
  const result: RpcResult =
    refresh
      ? await connection.rpc.call('/rpc', 'archive.summary.refresh', { sessionId })
      : await connection.rpc.call('/rpc', 'archive.summary.get', { sessionId })
  if (!result.ok) {
    if (result.error?.code === 'not-found' || result.error?.code === 'empty') return null
    throw new Error(result.error?.message ?? '读取摘要失败')
  }
  const value = result.value as { sessionId: string; title: string; archivedAt: number; summaryMarkdown: string; summary: ArchiveSnapshot['summary'] }
  return {
    sessionId: String(value.sessionId),
    title: String(value.title ?? ''),
    archivedAt: Number(value.archivedAt ?? 0),
    summaryMarkdown: String(value.summaryMarkdown ?? ''),
    summary: {
      goal: String(value.summary?.goal ?? ''),
      decisions: Array.isArray(value.summary?.decisions) ? value.summary!.decisions.map(String) : [],
      outcomes: Array.isArray(value.summary?.outcomes) ? value.summary!.outcomes.map(String) : [],
      lessons: Array.isArray(value.summary?.lessons) ? value.summary!.lessons.map(String) : [],
      openQuestions: Array.isArray(value.summary?.openQuestions) ? value.summary!.openQuestions.map(String) : [],
    },
  }
}

/** 文件夹 RPC：list / create / rename / remove / move，返回统一 FolderPayload。 */
async function folderRpc(
  connection: ConnectionHandle,
  action: 'list' | 'create' | 'rename' | 'remove' | 'move',
  params?: { name?: string; folderId?: string; sessionId?: string; folderId2?: string },
): Promise<FolderPayload> {
  const endpoint = `archive.folder.${action}`
  const payload: Record<string, unknown> = {}
  if (params?.name !== undefined) payload.name = params.name
  if (params?.folderId !== undefined) payload.folderId = params.folderId
  if (params?.sessionId !== undefined) payload.sessionId = params.sessionId
  if (action === 'move' && params?.folderId2 !== undefined) payload.folderId = params.folderId2
  const result: RpcResult = await connection.rpc.call('/rpc', endpoint, payload)
  if (!result.ok) throw new Error(result.error?.message ?? `文件夹操作失败（${action}）`)
  const value = result.value as { folders?: unknown; assignment?: unknown; created?: unknown }
  return {
    folders: Array.isArray(value?.folders)
      ? value.folders.map(folder => ({ id: String((folder as { id?: unknown })?.id ?? ''), name: String((folder as { name?: unknown })?.name ?? '') }))
      : [],
    assignment: (value?.assignment ?? {}) as Readonly<Record<string, string>>,
    created: (value?.created as ArchiveFolder | undefined) ?? undefined,
  }
}

/** 书签 RPC：list / toggle / note，返回统一 BookmarkPayload。 */
async function bookmarkRpc(
  connection: ConnectionHandle,
  action: 'list' | 'toggle' | 'note',
  params?: { sessionId?: string; note?: string },
): Promise<BookmarkPayload> {
  const result: RpcResult = await connection.rpc.call('/rpc', `bookmark.${action}`, {
    ...(params?.sessionId !== undefined ? { sessionId: params.sessionId } : {}),
    ...(params?.note !== undefined ? { note: params.note } : {}),
  })
  if (!result.ok) throw new Error(result.error?.message ?? `书签操作失败（${action}）`)
  const value = result.value as { bookmarks?: unknown; updated?: unknown }
  return {
    bookmarks: Array.isArray(value?.bookmarks)
      ? value.bookmarks.map(entry => ({
        sessionId: String((entry as { sessionId?: unknown })?.sessionId ?? ''),
        bookmarked: (entry as { bookmarked?: unknown })?.bookmarked === true,
        note: String((entry as { note?: unknown })?.note ?? ''),
        updatedAt: Number((entry as { updatedAt?: unknown })?.updatedAt ?? 0),
      }))
      : [],
    updated: (value?.updated as BookmarkEntry | null | undefined) ?? null,
  }
}

/** 复制会话 id（剪贴板 API + 兜底 execCommand）。 */
async function copySessionId(id: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(id)
    return
  } catch {
    // 非安全上下文等场景走兜底
  }
  const textarea = document.createElement('textarea')
  textarea.value = id
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
  } finally {
    textarea.remove()
  }
}

/** 一行会话的对话日志加载器（尾部一页 + 向前翻页）。 */
function useSessionLog(
  connection: ConnectionHandle | undefined,
  sessionId: SessionId,
  enabled: boolean,
): {
  events: HistoryEntry[]
  hasMore: boolean
  loading: boolean
  error: string | null
  loadOlder(): void
} {
  const [events, setEvents] = useState<HistoryEntry[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = useCallback(async (beforeSeq: number | undefined): Promise<{ events: HistoryEntry[]; hasMore: boolean } | null> => {
    if (connection === undefined) {
      setError('connection 服务不可用')
      return null
    }
    try {
      const response = await connection.api.sessions.history({
        sessionId,
        ...(beforeSeq === undefined ? {} : { beforeSeq }),
        maxMessages: PAGE_SIZE,
      })
      if (!response.result.ok) {
        setError(`读取失败：${response.result.error?.message ?? '未知错误'}`)
        return null
      }
      return {
        events: response.result.value?.events ?? [],
        hasMore: response.result.value?.hasMore ?? false,
      }
    } catch (cause) {
      setError(`读取失败：${cause instanceof Error ? cause.message : String(cause)}`)
      return null
    }
  }, [connection, sessionId])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchPage(undefined).then((page) => {
      if (cancelled || page === null) return
      setEvents(page.events)
      setHasMore(page.hasMore)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [enabled, fetchPage])

  const loadOlder = useCallback(() => {
    if (loading || events.length === 0) return
    const beforeSeq = events[0]?.event.seq
    if (beforeSeq === undefined) return
    setLoading(true)
    void fetchPage(beforeSeq).then((page) => {
      if (page === null) return
      setEvents(prev => [...page.events, ...prev])
      setHasMore(page.hasMore)
      setLoading(false)
    })
  }, [loading, events, fetchPage])

  return { events, hasMore, loading, error, loadOlder }
}

/** 摘要卡片：把快照渲染成 Voyager 式沉淀卡片（目标 + 决策 + 经验列表）。 */
function SummaryCard(props: {
  snapshot: ArchiveSnapshot
  sessionTitle: string
  onRefresh(sessionId: string): void
  refreshing: boolean
}): JSX.Element {
  const { snapshot, sessionTitle, onRefresh, refreshing } = props
  const [expanded, setExpanded] = useState(false)
  const summary = snapshot.summary
  const empty = summary.goal === '' && summary.decisions.length === 0
    && summary.outcomes.length === 0 && summary.lessons.length === 0
    && summary.openQuestions.length === 0

  const items = (label: string, values: readonly string[]): JSX.Element | null =>
    values.length === 0 ? null : (
      <div className="dsh-av-sm-item">
        <span className="dsh-av-sm-label">{label}</span>
        <ul className="dsh-av-sm-list">
          {values.map((value, index) => <li key={index}>{value}</li>)}
        </ul>
      </div>
    )

  return (
    <div className="dsh-av-sm" data-expanded={expanded || undefined}>
      <div className="dsh-av-sm-head">
        <span className="dsh-av-sm-goal" title={summary.goal}>
          {empty
            ? `「${sessionTitle}」暂无摘要沉淀`
            : (summary.goal !== '' ? summary.goal : sessionTitle)}
        </span>
        <span className="dsh-av-sm-time">归档于 {formatTime(snapshot.archivedAt)}</span>
      </div>
      {!empty && (
        <div className="dsh-av-sm-body">
          {items('关键决策', summary.decisions)}
          {items('产出', summary.outcomes)}
          {items('可复用经验', summary.lessons)}
          {items('遗留问题', summary.openQuestions)}
        </div>
      )}
      <div className="dsh-av-sm-actions">
        {!empty && (
          <button type="button" className="dsh-av-btn dsh-av-btn-sm" onClick={() => setExpanded(v => !v)}>
            {expanded ? '收起' : '展开 Markdown'}
          </button>
        )}
        <button
          type="button"
          className="dsh-av-btn dsh-av-btn-sm"
          disabled={refreshing}
          onClick={() => onRefresh(snapshot.sessionId)}
        >
          {refreshing ? '生成中…' : empty ? '生成摘要' : '重新生成'}
        </button>
      </div>
      {expanded && !empty && (
        <pre className="dsh-av-sm-md">{snapshot.summaryMarkdown}</pre>
      )}
    </div>
  )
}

/** 经验库视图：全部沉淀快照 + 关键词搜索。 */
function KnowledgeLibrary(props: {
  connection: ConnectionHandle
  onNotice(text: string, kind?: 'error'): void
}): JSX.Element {
  const { connection, onNotice } = props
  const [snapshots, setSnapshots] = useState<readonly ArchiveSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSnapshots(await listSummariesRpc(connection))
    } catch (cause) {
      onNotice(`读取经验库失败：${cause instanceof Error ? cause.message : String(cause)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [connection, onNotice])

  useEffect(() => { void load() }, [load])

  const refreshOne = useCallback(async (sessionId: string) => {
    setRefreshing(sessionId)
    try {
      await readSummaryRpc(connection, sessionId, true)
      await load()
    } catch (cause) {
      onNotice(`摘要生成失败：${cause instanceof Error ? cause.message : String(cause)}`, 'error')
    } finally {
      setRefreshing(null)
    }
  }, [connection, load, onNotice])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return snapshots
    return snapshots.filter(snapshot =>
      snapshot.title.toLowerCase().includes(needle)
      || snapshot.summary.goal.toLowerCase().includes(needle)
      || snapshot.summary.decisions.some(v => v.toLowerCase().includes(needle))
      || snapshot.summary.outcomes.some(v => v.toLowerCase().includes(needle))
      || snapshot.summary.lessons.some(v => v.toLowerCase().includes(needle))
      || snapshot.summary.openQuestions.some(v => v.toLowerCase().includes(needle))
      || snapshot.summaryMarkdown.toLowerCase().includes(needle),
    )
  }, [snapshots, query])

  return (
    <div className="dsh-av-library">
      <div className="dsh-av-library-toolbar">
        <input
          type="search"
          className="dsh-av-search"
          placeholder="搜索目标 / 决策 / 经验…"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <button type="button" className="dsh-av-btn" disabled={loading} onClick={() => void load()}>
          {loading ? '加载中…' : '刷新'}
        </button>
      </div>
      <div className="dsh-av-sm-list-wrap">
        {loading && <div className="dsh-av-empty">正在读取经验库…</div>}
        {!loading && snapshots.length === 0 && (
          <div className="dsh-av-empty">
            还没有摘要沉淀。归档会话点「生成摘要」即可沉淀（需要配置 provider/model，见 README）。
          </div>
        )}
        {!loading && snapshots.length > 0 && filtered.length === 0 && (
          <div className="dsh-av-empty">没有匹配「{query}」的沉淀条目</div>
        )}
        {filtered.map(snapshot => (
          <SummaryCard
            key={snapshot.sessionId}
            snapshot={snapshot}
            sessionTitle={snapshot.title !== '' ? snapshot.title : snapshot.sessionId}
            onRefresh={refreshOne}
            refreshing={refreshing === snapshot.sessionId}
          />
        ))}
      </div>
    </div>
  )
}

/** 文件夹树状态：folders + assignment + 操作 helper 的封装。 */
function useFolderState(connection: ConnectionHandle | undefined, onError: (text: string) => void): {
  folders: readonly ArchiveFolder[]
  assignment: Readonly<Record<string, string>>
  loading: boolean
  reload(): Promise<void>
  createFolder(name: string): Promise<void>
  renameFolder(folderId: string, name: string): Promise<void>
  removeFolder(folderId: string): Promise<void>
  moveSession(sessionId: string, folderId: string | undefined): Promise<void>
} {
  const [folders, setFolders] = useState<readonly ArchiveFolder[]>([])
  const [assignment, setAssignment] = useState<Readonly<Record<string, string>>>({})
  const [loading, setLoading] = useState(true)

  const apply = useCallback(async (action: 'list' | 'create' | 'rename' | 'remove' | 'move', params?: { name?: string; folderId?: string; sessionId?: string; folderId2?: string }) => {
    if (connection === undefined) {
      onError('connection 服务不可用')
      return
    }
    const payload = await folderRpc(connection, action, params)
    setFolders(payload.folders)
    setAssignment(payload.assignment)
  }, [connection, onError])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      await apply('list')
    } catch (cause) {
      onError(`读取文件夹失败：${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      setLoading(false)
    }
  }, [apply, onError])

  useEffect(() => { void reload() }, [reload])

  const createFolder = useCallback(async (name: string) => {
    try { await apply('create', { name }) } catch (cause) {
      onError(`新建文件夹失败：${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }, [apply, onError])

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    try { await apply('rename', { folderId, name }) } catch (cause) {
      onError(`重命名失败：${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }, [apply, onError])

  const removeFolder = useCallback(async (folderId: string) => {
    try { await apply('remove', { folderId }) } catch (cause) {
      onError(`删除失败：${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }, [apply, onError])

  const moveSession = useCallback(async (sessionId: string, folderId: string | undefined) => {
    try { await apply('move', { sessionId, folderId2: folderId ?? '' }) } catch (cause) {
      onError(`移动失败：${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }, [apply, onError])

  return { folders, assignment, loading, reload, createFolder, renameFolder, removeFolder, moveSession }
}

/** 书签状态：bookmarks + toggle/setNote + 依 sessionId 的查询表。 */
function useBookmarkState(connection: ConnectionHandle | undefined, onError: (text: string) => void): {
  bookmarks: readonly BookmarkEntry[]
  bySession: Readonly<Record<string, BookmarkEntry>>
  toggle(sessionId: string): Promise<void>
  setNote(sessionId: string, note: string): Promise<void>
} {
  const [bookmarks, setBookmarks] = useState<readonly BookmarkEntry[]>([])

  const apply = useCallback(async (action: 'list' | 'toggle' | 'note', params?: { sessionId?: string; note?: string }) => {
    if (connection === undefined) {
      onError('connection 服务不可用')
      return
    }
    const payload = await bookmarkRpc(connection, action, params)
    setBookmarks(payload.bookmarks)
  }, [connection, onError])

  useEffect(() => {
    let cancelled = false
    if (connection === undefined) return
    void bookmarkRpc(connection, 'list')
      .then(payload => { if (!cancelled) setBookmarks(payload.bookmarks) })
      .catch(cause => { if (!cancelled) onError(`读取收藏失败：${cause instanceof Error ? cause.message : String(cause)}`) })
    return () => { cancelled = true }
  }, [connection, onError])

  const bySession = useMemo(() => {
    const map: Record<string, BookmarkEntry> = {}
    for (const entry of bookmarks) map[entry.sessionId] = entry
    return map
  }, [bookmarks])

  const toggle = useCallback(async (sessionId: string) => {
    try { await apply('toggle', { sessionId }) } catch (cause) {
      onError(`收藏操作失败：${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }, [apply, onError])

  const setNote = useCallback(async (sessionId: string, note: string) => {
    try { await apply('note', { sessionId, note }) } catch (cause) {
      onError(`便签保存失败：${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }, [apply, onError])

  return { bookmarks, bySession, toggle, setNote }
}

/** 左栏文件夹树。 */
function FolderTree(props: {
  folders: readonly ArchiveFolder[]
  assignment: Readonly<Record<string, string>>
  totalCount: number
  bookmarkCount: number
  selected: string
  onSelect(key: string): void
  onCreate(name: string): void
  onRename(folderId: string, name: string): void
  onRemove(folderId: string): void
  libraryCount: number
}): JSX.Element {
  const { folders, totalCount, selected, onSelect, onCreate, onRename, onRemove, libraryCount, bookmarkCount } = props
  const unclassified = totalCount - Object.keys(props.assignment).length
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const commitCreate = (): void => {
    const name = draft.trim()
    if (name !== '') onCreate(name)
    setDraft('')
    setCreating(false)
  }

  const commitRename = (folderId: string): void => {
    const name = editText.trim()
    if (name !== '') onRename(folderId, name)
    setEditing(null)
    setEditText('')
  }

  const item = (key: string, label: string, count: number, indent = false): JSX.Element => (
    <button
      type="button"
      className="dsh-av-tree-item"
      data-active={selected === key || undefined}
      data-indent={indent || undefined}
      onClick={() => onSelect(key)}
    >
      <span className="dsh-av-tree-icon">{indent ? '▸' : '▾'}</span>
      <span className="dsh-av-tree-label">{label}</span>
      <span className="dsh-av-tree-count">{count}</span>
    </button>
  )

  return (
    <div className="dsh-av-tree">
      <div className="dsh-av-tree-title">文件夹</div>
      <div className="dsh-av-tree-scroll">
        {item('all', '全部归档', totalCount)}
        {item('bookmarks', '收藏', bookmarkCount)}
        {folders.map(folder => (
          <div key={folder.id} className="dsh-av-tree-node" data-active={selected === `folder:${folder.id}` || undefined}>
            {editing === folder.id
              ? (
                <input
                  autoFocus
                  className="dsh-av-tree-edit"
                  value={editText}
                  onChange={event => setEditText(event.target.value)}
                  onBlur={() => commitRename(folder.id)}
                  onKeyDown={event => { if (event.key === 'Enter') commitRename(folder.id); if (event.key === 'Escape') { setEditing(null); setEditText('') } }}
                />
              )
              : (
                <>
                  <button
                    type="button"
                    className="dsh-av-tree-item"
                    data-active={selected === `folder:${folder.id}` || undefined}
                    data-indent
                    onClick={() => onSelect(`folder:${folder.id}`)}
                  >
                    <span className="dsh-av-tree-icon">▸</span>
                    <span className="dsh-av-tree-label">{folder.name}</span>
                    <span className="dsh-av-tree-count">
                      {Object.values(props.assignment).filter(id => id === folder.id).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="dsh-av-tree-mini"
                    title="重命名"
                    onClick={() => { setEditing(folder.id); setEditText(folder.name) }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="dsh-av-tree-mini dsh-av-tree-mini-del"
                    title="删除文件夹（会话回到未分类）"
                    onClick={() => { if (window.confirm(`删除文件夹「${folder.name}」？会话将回到「未分类」。`)) onRemove(folder.id) }}
                  >
                    ✕
                  </button>
                </>
              )}
          </div>
        ))}
        {item('unclassified', '未分类', Math.max(0, unclassified), true)}
        {item('library', '经验库', libraryCount)}
      </div>
      <div className="dsh-av-tree-foot">
        {creating
          ? (
            <input
              autoFocus
              className="dsh-av-tree-edit"
              placeholder="文件夹名称"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onBlur={() => { commitCreate() }}
              onKeyDown={event => { if (event.key === 'Enter') commitCreate(); if (event.key === 'Escape') { setDraft(''); setCreating(false) } }}
            />
          )
          : (
            <button type="button" className="dsh-av-tree-new" onClick={() => setCreating(true)}>＋ 新建文件夹</button>
          )}
      </div>
    </div>
  )
}

/** 右栏完整会话卡片（含摘要预览 + 对话查看 + 收藏/便签 + 行内操作）。 */
function ArchiveRow(props: {
  connection: ConnectionHandle | undefined
  row: ArchiveRowInfo
  checked: boolean
  onToggleChecked(): void
  onMoveTo(folderId: string | undefined): void
  folders: readonly ArchiveFolder[]
  bookmark: BookmarkEntry | undefined
  onToggleBookmark(sessionId: SessionId): void
  onSaveNote(sessionId: SessionId, note: string): void
  onNotice(sessionId: SessionId, text: string, kind?: 'error'): void
  onUnarchive(sessionId: SessionId): Promise<void>
}): JSX.Element {
  const { connection, row, checked, onToggleChecked, onMoveTo, folders, bookmark, onToggleBookmark, onSaveNote, onNotice, onUnarchive } = props
  const { id: sessionId, title, meta, workspace } = row
  const [open, setOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [summary, setSummary] = useState<ArchiveSnapshot | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState(bookmark?.note ?? '')
  const log = useSessionLog(connection, sessionId, open)

  const commitNote = useCallback(() => {
    setNoteOpen(false)
    if (noteDraft.trim() === (bookmark?.note ?? '')) return
    onSaveNote(sessionId, noteDraft)
  }, [noteDraft, bookmark, onSaveNote, sessionId])

  const loadSummary = useCallback(async (refresh: boolean) => {
    if (connection === undefined) return
    setSummaryLoading(true)
    try {
      const snapshot = await readSummaryRpc(connection, sessionId, refresh)
      setSummary(snapshot)
      if (snapshot !== null) onNotice(sessionId, '摘要已就绪')
    } catch (cause) {
      onNotice(sessionId, `摘要读取失败：${cause instanceof Error ? cause.message : String(cause)}`, 'error')
    } finally {
      setSummaryLoading(false)
    }
  }, [connection, sessionId, onNotice])

  const runAction = useCallback(async (kind: 'download' | 'copy' | 'unarchive') => {
    setBusyAction(kind)
    try {
      if (kind === 'download') {
        await downloadLogZip(sessionId)
        onNotice(sessionId, '已开始下载日志 ZIP')
      } else if (kind === 'copy') {
        await copySessionId(sessionId)
        onNotice(sessionId, '会话 ID 已复制')
      } else {
        await onUnarchive(sessionId)
      }
    } catch (cause) {
      onNotice(sessionId, `操作失败：${cause instanceof Error ? cause.message : String(cause)}`, 'error')
    } finally {
      setBusyAction(null)
    }
  }, [sessionId, onNotice, onUnarchive])

  return (
    <div className="dsh-av-row" data-checked={checked || undefined}>
      <div className="dsh-av-row-head">
        <label className="dsh-av-check">
          <input type="checkbox" checked={checked} onChange={onToggleChecked} />
          <span />
        </label>
        <span className="dsh-av-row-title" title={sessionId}>{title}</span>
        {workspace !== undefined && <span className="dsh-av-badge">{workspace}</span>}
        <span className="dsh-av-row-meta">{meta}</span>
      </div>
      <div className="dsh-av-actions">
        <button type="button" className="dsh-av-btn" onClick={() => setOpen(v => !v)}>
          {open ? '收起对话' : '查看对话'}
        </button>
        <button
          type="button"
          className="dsh-av-btn"
          disabled={summaryLoading || busyAction !== null}
          onClick={() => void (summary === null ? loadSummary(false) : loadSummary(true))}
        >
          {summaryLoading ? '生成中…' : summary === null ? '生成摘要' : '重新生成'}
        </button>
        <button
          type="button"
          className="dsh-av-btn"
          data-bookmarked={bookmark?.bookmarked === true || undefined}
          disabled={busyAction !== null}
          onClick={() => onToggleBookmark(sessionId)}
          title={bookmark?.bookmarked ? '取消收藏' : '收藏会话'}
        >
          {bookmark?.bookmarked ? '★ 已收藏' : '☆ 收藏'}
        </button>
        <button
          type="button"
          className="dsh-av-btn"
          data-has-note={(bookmark?.note ?? '') !== '' || undefined}
          disabled={busyAction !== null}
          onClick={() => { setNoteDraft(bookmark?.note ?? ''); setNoteOpen(v => !v) }}
          title="便签"
        >
          {(bookmark?.note ?? '') !== '' ? '📝 便签' : '📝 写便签'}
        </button>
        <select
          className="dsh-av-select"
          title="移动到文件夹"
          value=""
          onChange={event => { if (event.target.value !== '') onMoveTo(event.target.value) }}
        >
          <option value="" disabled>移动至…</option>
          <option value="">未分类</option>
          {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
        <button type="button" className="dsh-av-btn" disabled={busyAction !== null} onClick={() => void runAction('unarchive')}>
          {busyAction === 'unarchive' ? '恢复中…' : '恢复'}
        </button>
        <button type="button" className="dsh-av-btn" disabled={busyAction !== null} onClick={() => void runAction('download')}>
          {busyAction === 'download' ? '下载中…' : '导出 ZIP'}
        </button>
      </div>
      {noteOpen && (
        <div className="dsh-av-note-editor">
          <textarea
            autoFocus
            className="dsh-av-note-input"
            placeholder="记录这个会话的要点、结论或后续事项…"
            value={noteDraft}
            onChange={event => setNoteDraft(event.target.value)}
            onKeyDown={event => { if (event.key === 'Escape') setNoteOpen(false) }}
          />
          <div className="dsh-av-note-actions">
            <button type="button" className="dsh-av-btn" onClick={() => setNoteOpen(false)}>取消</button>
            <button type="button" className="dsh-av-btn dsh-av-btn-primary" onClick={commitNote}>保存便签</button>
          </div>
        </div>
      )}
      {summary !== null && (
        <SummaryCard
          snapshot={summary}
          sessionTitle={title}
          onRefresh={() => void loadSummary(true)}
          refreshing={summaryLoading}
        />
      )}
      {open && (
        <div className="dsh-av-log">
          {log.error !== null && <div className="dsh-av-log-error">{log.error}</div>}
          {log.loading && log.events.length === 0 && <div className="dsh-av-log-empty">正在读取对话…</div>}
          {!log.loading && log.error === null && log.events.length === 0 && (
            <div className="dsh-av-log-empty">该会话没有可见消息（可能只有工具/系统事件）</div>
          )}
          {log.events.map(({ event }) => {
            if (!CHAT_TYPES.has(event.type)) return null
            const role = event.type === 'user/message' ? '你' : '助手'
            return (
              <div className="dsh-av-msg" key={event.seq}>
                <span className="dsh-av-msg-role">{role} · {formatTime(event.time)}</span>
                <span className="dsh-av-msg-text">{textOf(event)}</span>
              </div>
            )
          })}
          {log.hasMore && (
            <button type="button" className="dsh-av-btn dsh-av-load-older" disabled={log.loading} onClick={log.loadOlder}>
              {log.loading ? '加载中…' : '加载更早'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** 面板主体（文件夹树 + 时间线卡片流 + 批量操作条）。 */
export function ArchivePanelView(props: { stores: ArchiveStores; onClose(): void }): JSX.Element {
  const { stores, onClose } = props
  const sessionState = useSyncExternalStore(
    subscribeOf(stores.sessions),
    snapshotOf(stores.sessions),
  )
  const workspaceState = useSyncExternalStore(
    subscribeOf(stores.workspaces),
    snapshotOf(stores.workspaces),
  )
  const [notices, setNotices] = useState<Readonly<Record<string, { text: string; kind?: 'error' }>>>({})
  const [selectedKey, setSelectedKey] = useState<string>('all')
  const [checked, setChecked] = useState<Readonly<Set<string>>>(new Set())
  const [batchAction, setBatchAction] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ text: string; kind?: 'error' } | null>(null)
  const bannerTimer = useRef<number | undefined>(undefined)

  const workspaceTitles = useMemo(() => workspaceTitlesOf(workspaceState.items), [workspaceState.items])

  const onNotice = useCallback((sessionId: string, text: string, kind?: 'error') => {
    setNotices(prev => ({ ...prev, [sessionId]: { text, kind } }))
  }, [])

  const folderState = useFolderState(stores.connection, (text) => setBanner({ text, kind: 'error' }))
  const bookmarkState = useBookmarkState(stores.connection, (text) => setBanner({ text, kind: 'error' }))

  const displayRows = useMemo<readonly ArchiveRowInfo[]>(() => {
    const makeRow = (id: SessionId): ArchiveRowInfo => {
      const summary = sessionState.byId[id]
      const title = summary?.displayTitle ?? summary?.title ?? `未命名会话 (${id})`
      const meta = summary === undefined
        ? '摘要暂不可用'
        : `${formatTime(summary.updatedAt)}${summary.running ? ' · 运行中' : ''}${summary.blank ? ' · 空白' : ''}`
      return { id, title, meta, updatedAt: summary?.updatedAt ?? 0, workspace: workspaceTitles.get(id) }
    }

    if (selectedKey === 'bookmarks') {
      return bookmarkState.bookmarks
        .filter(entry => entry.bookmarked)
        .map(entry => makeRow(entry.sessionId))
        .sort((a, b) => b.updatedAt - a.updatedAt)
    }

    const rows: ArchiveRowInfo[] = workspaceState.archivedSessionIds
      .map(makeRow)
      .sort((a, b) => b.updatedAt - a.updatedAt)

    if (selectedKey === 'all') return rows
    if (selectedKey === 'unclassified') {
      return rows.filter(rowRow => folderState.assignment[rowRow.id] === undefined)
    }
    if (selectedKey.startsWith('folder:')) {
      const folderId = selectedKey.slice('folder:'.length)
      return rows.filter(rowRow => folderState.assignment[rowRow.id] === folderId)
    }
    return rows
  }, [workspaceState.archivedSessionIds, sessionState.byId, workspaceTitles, selectedKey, folderState.assignment, bookmarkState.bookmarks])

  const isLibrary = selectedKey === 'library'

  const toggleChecked = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setChecked(prev => {
      const allChecked = displayRows.length > 0 && displayRows.every(row => prev.has(row.id))
      const next = new Set(prev)
      if (allChecked) for (const row of displayRows) next.delete(row.id)
      else for (const row of displayRows) next.add(row.id)
      return next
    })
  }, [displayRows])

  const onUnarchive = useCallback(async (sessionId: string) => {
    try {
      await unarchiveSessionRpc(sessionId)
      setBanner({ text: '会话已恢复，已回到原工作区分组' })
      setChecked(prev => { const next = new Set(prev); next.delete(sessionId); return next })
    } catch (cause) {
      setBanner({ text: `恢复失败：${cause instanceof Error ? cause.message : String(cause)}`, kind: 'error' })
    }
    window.clearTimeout(bannerTimer.current)
    bannerTimer.current = window.setTimeout(() => setBanner(null), 5000)
  }, [])

  const moveCheckedTo = useCallback(async (folderId: string | undefined) => {
    const ids = [...checked]
    if (ids.length === 0) return
    try {
      await Promise.all(ids.map(id => folderState.moveSession(id, folderId)))
      setBanner({ text: `已将 ${ids.length} 个会话移至${folderId === undefined ? '未分类' : '目标文件夹'}` })
      setChecked(new Set())
    } catch (cause) {
      setBanner({ text: `批量移动失败：${cause instanceof Error ? cause.message : String(cause)}`, kind: 'error' })
    }
    window.clearTimeout(bannerTimer.current)
    bannerTimer.current = window.setTimeout(() => setBanner(null), 5000)
  }, [checked, folderState.moveSession])

  const [libraryCount, setLibraryCount] = useState<number | null>(null)
  useEffect(() => {
    if (stores.connection === undefined) return
    let cancelled = false
    void listSummariesRpc(stores.connection)
      .then(list => { if (!cancelled) setLibraryCount(list.length) })
      .catch(() => { if (!cancelled) setLibraryCount(null) })
    return () => { cancelled = true }
  }, [stores.connection])

  const batchDownload = useCallback(async () => {
    setBatchAction('download')
    try {
      for (const id of checked) await downloadLogZip(id)
      setBanner({ text: `已开始导出 ${checked.size} 个会话 ZIP` })
    } catch (cause) {
      setBanner({ text: `批量导出失败：${cause instanceof Error ? cause.message : String(cause)}`, kind: 'error' })
    } finally {
      setBatchAction(null)
    }
  }, [checked])

  const batchSummarize = useCallback(async () => {
    if (stores.connection === undefined) return
    setBatchAction('summarize')
    try {
      let done = 0
      for (const id of checked) {
        await readSummaryRpc(stores.connection, id, true).catch(() => null)
        done += 1
      }
      setBanner({ text: `已为 ${done} 个会话生成摘要` })
    } finally {
      setBatchAction(null)
    }
  }, [checked, stores.connection])

  const batchUnarchive = useCallback(async () => {
    setBatchAction('unarchive')
    try {
      let done = 0
      for (const id of checked) {
        await onUnarchive(id)
        done += 1
      }
      setBanner({ text: `已恢复 ${done} 个会话` })
      setChecked(new Set())
    } finally {
      setBatchAction(null)
    }
  }, [checked, onUnarchive])

  useEffect(() => () => { window.clearTimeout(bannerTimer.current) }, [])

  return (
    <div data-dsh-archive-viewer-panel>
      <div className="dsh-av-header">
        <h2 className="dsh-av-title">会话归档 · 经验库</h2>
        <div className="dsh-av-count">
          {selectedKey === 'library' ? `${folderState.loading ? '…' : ''}` : `${workspaceState.archivedSessionIds.length} 会话`}
        </div>
        <button type="button" className="dsh-av-close" onClick={onClose}>关闭</button>
      </div>
      {banner !== null && (
        <div className="dsh-av-notice" data-kind={banner.kind}>{banner.text}</div>
      )}
      <div className="dsh-av-pane">
        {stores.connection !== undefined && (
          <FolderTree
            folders={folderState.folders}
            assignment={folderState.assignment}
            totalCount={workspaceState.archivedSessionIds.length}
            bookmarkCount={bookmarkState.bookmarks.filter(entry => entry.bookmarked).length}
            selected={selectedKey}
            onSelect={(key) => { setSelectedKey(key); setChecked(new Set()) }}
            onCreate={folderState.createFolder}
            onRename={folderState.renameFolder}
            onRemove={folderState.removeFolder}
            libraryCount={libraryCount ?? 0}
          />
        )}
        <div className="dsh-av-main">
          {isLibrary ? (
            stores.connection === undefined
              ? <div className="dsh-av-empty">connection 服务不可用，无法读取经验库</div>
              : <KnowledgeLibrary connection={stores.connection} onNotice={(text, kind) => { setBanner({ text, kind }) }} />
          ) : (
            <>
              <div className="dsh-av-note">
                {selectedKey === 'all' && '全部归档会话。可按文件夹归档整理，勾选后可批量导出 / 摘要 / 恢复。'}
                {selectedKey === 'bookmarks' && '收藏的会话（含未归档）。点「★」可取消收藏，「📝」可记录便签。'}
                {selectedKey === 'unclassified' && '未归入任何文件夹的归档会话。可移入文件夹整理。'}
                {!selectedKey.startsWith('folder:') && selectedKey !== 'all' && selectedKey !== 'unclassified' && selectedKey !== 'bookmarks' && '归档会话沉淀区。'}
                {selectedKey.startsWith('folder:') && '该文件夹内的归档会话（按最近更新时间倒序）。'}
              </div>
              <div className="dsh-av-list-head">
                <label className="dsh-av-check">
                  <input
                    type="checkbox"
                    checked={displayRows.length > 0 && displayRows.every(row => checked.has(row.id))}
                    onChange={toggleAll}
                  />
                  <span />
                </label>
                <span className="dsh-av-list-head-label">全选</span>
                <span className="dsh-av-list-head-count">共 {displayRows.length} 条</span>
              </div>
              <div className="dsh-av-list">
                {!workspaceState.baselinesReady && <div className="dsh-av-empty">正在加载会话列表…</div>}
                {workspaceState.baselinesReady && displayRows.length === 0 && <div className="dsh-av-empty">这个视图下没有归档会话</div>}
                {displayRows.map((row) => (
                  <div key={row.id}>
                    <ArchiveRow
                      connection={stores.connection}
                      row={row}
                      checked={checked.has(row.id)}
                      onToggleChecked={() => toggleChecked(row.id)}
                      onMoveTo={(folderId) => folderState.moveSession(row.id, folderId)}
                      folders={folderState.folders}
                      bookmark={bookmarkState.bySession[row.id]}
                      onToggleBookmark={(sessionId) => { void bookmarkState.toggle(sessionId) }}
                      onSaveNote={(sessionId, note) => { void bookmarkState.setNote(sessionId, note) }}
                      onNotice={onNotice}
                      onUnarchive={onUnarchive}
                    />
                    {notices[row.id] !== undefined && (
                      <div className="dsh-av-notice" data-kind={notices[row.id]!.kind}>
                        {notices[row.id]!.text}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {checked.size > 0 && !isLibrary && (
        <div className="dsh-av-batchbar">
          <span className="dsh-av-batchbar-count">已选 {checked.size} 项</span>
          <button type="button" className="dsh-av-btn" disabled={batchAction !== null} onClick={() => void batchDownload()}>
            {batchAction === 'download' ? '导出中…' : '导出 ZIP'}
          </button>
          <button type="button" className="dsh-av-btn" disabled={batchAction !== null || stores.connection === undefined} onClick={() => void batchSummarize()}>
            {batchAction === 'summarize' ? '摘要中…' : '生成摘要'}
          </button>
          <button type="button" className="dsh-av-btn" disabled={batchAction !== null} onClick={() => void batchUnarchive()}>
            {batchAction === 'unarchive' ? '恢复中…' : '恢复会话'}
          </button>
          <div className="dsh-av-batchbar-move">
            <select className="dsh-av-select" value="" onChange={event => { if (event.target.value !== '') moveCheckedTo(event.target.value) }}>
              <option value="" disabled>移动到文件夹…</option>
              <option value="">未分类</option>
              {folderState.folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
          </div>
          <button type="button" className="dsh-av-btn" onClick={() => setChecked(new Set())}>取消</button>
        </div>
      )}
    </div>
  )
}
