/**
 * ArchivePanelView — 已归档会话查看面板（渲染在 sidebar.footer.action 注册项的
 * fixed 层叠内，样式全部走 --dsw-alias-* 令牌以跟随皮肤）。
 *
 * 数据源（全部只读，均为 client runtime 的实时 store）：
 *  - stores.workspaces：注册表全局归档集合 archivedSessionIds + 工作区视图
 *  - stores.sessions：全部会话行（归档不删除日志，会话仍留在 session.list）
 *  - stores.connection.api.sessions.history：按页读取会话事件（冷会话走
 *    持久化检查，无需激活 Agent）
 *  - GET /api/session.export：宿主侧 ZIP 导出（与官方"下载会话日志"同一端点）
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type {
  ArchiveStores, ConnectionHandle, HistoryEntry, SessionEvent, SessionId,
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
      // RPC 响应的 ok/value/error 都挂在 result 层（rpcId + result 信封）。
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

  // 首次展开时加载尾部一页。
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

/** 一行归档会话。 */
function ArchiveRow(props: {
  connection: ConnectionHandle | undefined
  sessionId: SessionId
  title: string
  meta: string
  workspace: string | undefined
  onNotice(sessionId: SessionId, text: string, kind?: 'error'): void
  onUnarchive(sessionId: SessionId): Promise<void>
}): JSX.Element {
  const { connection, sessionId, title, meta, workspace, onNotice, onUnarchive } = props
  const [open, setOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const log = useSessionLog(connection, sessionId, open)

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
    <div className="dsh-av-row">
      <div className="dsh-av-row-head">
        <span className="dsh-av-row-title" title={sessionId}>{title}</span>
        {workspace !== undefined && <span className="dsh-av-badge">{workspace}</span>}
        <span className="dsh-av-row-meta">{meta}</span>
      </div>
      <div className="dsh-av-actions">
        <button type="button" className="dsh-av-btn" onClick={() => setOpen(v => !v)}>
          {open ? '收起对话' : '查看对话'}
        </button>
        <button type="button" className="dsh-av-btn" disabled={busyAction !== null} onClick={() => void runAction('unarchive')}>
          {busyAction === 'unarchive' ? '恢复中…' : '恢复会话'}
        </button>
        <button type="button" className="dsh-av-btn" disabled={busyAction !== null} onClick={() => void runAction('download')}>
          {busyAction === 'download' ? '下载中…' : '下载日志 (ZIP)'}
        </button>
        <button type="button" className="dsh-av-btn" disabled={busyAction !== null} onClick={() => void runAction('copy')}>
          {busyAction === 'copy' ? '复制中…' : '复制 ID'}
        </button>
      </div>
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

/** 面板主体。 */
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

  const workspaceTitles = useMemo(() => workspaceTitlesOf(workspaceState.items), [workspaceState.items])

  // 归档集合是注册表全局的，行的摘要按 updatedAt 降序展示。
  const rows = useMemo(() => {
    return workspaceState.archivedSessionIds
      .map((id) => {
        const summary = sessionState.byId[id]
        const title = summary?.displayTitle ?? summary?.title ?? `未命名会话 (${id})`
        const meta = summary === undefined
          ? '摘要暂不可用'
          : `${formatTime(summary.updatedAt)}${summary.running ? ' · 运行中' : ''}${summary.blank ? ' · 空白' : ''}`
        return { id, title, meta, updatedAt: summary?.updatedAt ?? 0 }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [workspaceState.archivedSessionIds, sessionState.byId])

  const onNotice = useCallback((sessionId: string, text: string, kind?: 'error') => {
    setNotices(prev => ({ ...prev, [sessionId]: { text, kind } }))
  }, [])

  // 取消归档：RPC 成功后 host/archived-sessions-changed 帧会实时更新归档集合，
  // 该行随之从本面板消失并回到原工作区分组；面板级横幅提示结果。
  const [banner, setBanner] = useState<{ text: string; kind?: 'error' } | null>(null)
  const bannerTimer = useRef<number | undefined>(undefined)
  const onUnarchive = useCallback(async (sessionId: string) => {
    try {
      await unarchiveSessionRpc(sessionId)
      setBanner({ text: '会话已恢复，已回到原工作区分组' })
    } catch (cause) {
      setBanner({ text: `恢复失败：${cause instanceof Error ? cause.message : String(cause)}`, kind: 'error' })
    }
    window.clearTimeout(bannerTimer.current)
    bannerTimer.current = window.setTimeout(() => setBanner(null), 5000)
  }, [])

  useEffect(() => () => { window.clearTimeout(bannerTimer.current) }, [])

  return (
    <div data-dsh-archive-viewer-panel>
      <div className="dsh-av-header">
        <h2 className="dsh-av-title">已归档会话</h2>
        <span className="dsh-av-count">{rows.length} 个</span>
        <button type="button" className="dsh-av-close" onClick={onClose}>关闭</button>
      </div>
      <div className="dsh-av-body">
        <div className="dsh-av-note">
          归档会话被隐藏在所有会话列表与搜索之外，但日志、附件与工作区分组位置完整保留。可查看对话、导出 ZIP，或点击「恢复会话」取消归档——恢复后立即回到原工作区分组。
        </div>
        {banner !== null && (
          <div className="dsh-av-notice" data-kind={banner.kind}>{banner.text}</div>
        )}
        <div className="dsh-av-list">
          {!workspaceState.baselinesReady && <div className="dsh-av-empty">正在加载会话列表…</div>}
          {workspaceState.baselinesReady && rows.length === 0 && <div className="dsh-av-empty">没有已归档的会话</div>}
          {rows.map((row) => (
            <div key={row.id}>
              <ArchiveRow
                connection={stores.connection}
                sessionId={row.id}
                title={row.title}
                meta={row.meta}
                workspace={workspaceTitles.get(row.id)}
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
      </div>
    </div>
  )
}
