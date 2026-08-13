/**
 * Local structural types for the surfaces this plugin consumes.
 *
 * 刻意不 import 任何 @deepseek-ai/* 类型：本插件面向运行中的 DSH host
 * （0.1.0-rc.x checkout），npm SDK 版本落后且缺少 archivedSessionIds 等
 * 新字段；结构类型与 wire 形状逐字一致，构建时零框架依赖。
 * 形状来源：packages/client/runtime/src/client/{sessions,workspaces}/service.ts
 * 与 packages/host/apiproxy/src/api/{sessions,workspace}.ts。
 */

/** Opaque session id（wire 上是 branded string，这里按字符串使用）。 */
export type SessionId = string

/** 会话列表行（client runtime SessionSummary 的结构子集）。 */
export interface SessionSummary {
  id: SessionId
  title?: string
  displayTitle: string
  cwd?: string
  agentPreset?: string
  running: boolean
  blank: boolean
  updatedAt: number
  /** Host 侧投影值（含 title 投影键）。 */
  projectionValues?: Readonly<Partial<Record<string, unknown>>> & { title?: string | null }
}

/** sessions.list store 快照（SessionListState 结构子集）。 */
export interface SessionListState {
  ids: readonly SessionId[]
  byId: Readonly<Record<SessionId, SessionSummary>>
  current: SessionId | undefined
  phase: string
}

/** 工作区行（WorkspaceView 结构子集）。 */
export interface WorkspaceView {
  workspaceId: string
  path: string
  title: string
  sessionIds: readonly SessionId[]
}

/** workspaces.list store 快照（WorkspaceListState 结构子集）。 */
export interface WorkspaceListState {
  items: readonly WorkspaceView[]
  archivedSessionIds: readonly SessionId[]
  state: 'idle' | 'loading' | 'error'
  phase: string
  baselinesReady: boolean
}

/** 快照 store（SnapshotStore 结构子集，useSyncExternalStore 直接消费）。 */
export interface SnapshotStore<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** slots 服务的注册选项（ui-slots 的 register options 结构子集）。 */
export interface SlotRegistrationOptions {
  name: string
  id: string
  order?: number
  label?: string | (() => string)
  inject?: () => unknown
}

/** slots 服务（ui-slots 的 SlotRegistry 结构子集）。 */
export interface SlotsService {
  inject(name: string, factory: () => unknown): void
  register(options: SlotRegistrationOptions, component: unknown): () => void
}

/** client runtime 服务（ClientContext 结构子集）。 */
export interface ViewerContext {
  slots: SlotsService
  sessions: { list: SnapshotStore<SessionListState> }
  workspaces: { list: SnapshotStore<WorkspaceListState> }
  get(name: string): unknown
  logger: {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
  }
  effect(callback: () => (() => void) | void, label?: string): void
}

/** 面板需要的数据源（经 slot inject face 传入组件）。 */
export interface ArchiveStores {
  sessions: SnapshotStore<SessionListState>
  workspaces: SnapshotStore<WorkspaceListState>
  connection: ConnectionHandle | undefined
}

/** 文本内容块（ContentBlock 结构子集）。 */
export interface TextBlock {
  type: 'text'
  text: string
}

/** 会话事件（SessionEvent 结构子集）。 */
export interface SessionEvent {
  seq: number
  time: number
  type: string
  data: {
    content?: readonly TextBlock[]
    text?: string
  }
}

/** session.history 的一行（HistoryEntry 结构子集；view 与本插件无关）。 */
export interface HistoryEntry {
  event: SessionEvent
  view?: unknown
}

/** session.history 的 RPC 响应（RpcResponse 结构子集：result 层承载 ok/value/error）。 */
export interface HistoryResponse {
  rpcId: string
  result: {
    ok: boolean
    value?: {
      events: HistoryEntry[]
      hasMore: boolean
      projections?: unknown
    }
    error?: { code: string; message: string }
  }
}

/** connection 服务句柄（ConnectionHandle 结构子集；rpc 为通用 RPC 信道调用）。 */
export interface ConnectionHandle {
  api: {
    sessions: {
      history(payload: { sessionId: SessionId; beforeSeq?: number; maxMessages?: number }): Promise<HistoryResponse>
    }
  }
  rpc: {
    /**
     * 通用 RPC 调用（client/rpc.ts createWebConnectionRpc 的结构子集）。
     * @param channel - 逻辑信道（host 注册在 `/rpc`）。
     * @param endpoint - 端点方法名。
     * @param payload - 请求负载。
     * @returns RPC result 信封（ok/value/error 挂在 result 层）。
     */
    call(
      channel: string,
      endpoint: string,
      payload?: unknown,
      signal?: AbortSignal,
    ): Promise<RpcResult>
  }
}

/** RPC result 信封（serverResponseSchema 解析后的 result 层）。 */
export interface RpcResult {
  ok: boolean
  value?: unknown
  error?: { code: string; message: string }
}

/** 归档快照（经验库条目；host 侧 ArchiveSnapshot 的 wire 形状）。 */
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

/** 归档文件夹（host 侧 ArchiveFolder 的 wire 形状）。 */
export interface ArchiveFolder {
  id: string
  name: string
}

/** archive.folder.* 系列响应的统一载荷。 */
export interface FolderPayload {
  folders: readonly ArchiveFolder[]
  assignment: Readonly<Record<string, string>>
  created?: ArchiveFolder
}

/** 会话行的归档信息（归档面板计算后的展示行）。 */
export interface ArchiveRowInfo {
  id: SessionId
  title: string
  meta: string
  updatedAt: number
  workspace: string | undefined
}

/** 会话收藏 + 便签（host 侧 BookmarkEntry 的 wire 形状）。 */
export interface BookmarkEntry {
  sessionId: string
  bookmarked: boolean
  note: string
  updatedAt: number
}

/** bookmark.* 系列响应的统一载荷。 */
export interface BookmarkPayload {
  bookmarks: readonly BookmarkEntry[]
  updated?: BookmarkEntry | null
}
