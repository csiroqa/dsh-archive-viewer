/**
 * DeleteSessionButton — 会话头部右上角「删除当前会话」按钮。
 *
 * 与「关闭 dsh」同格式（conversation.session.header.utilities 槽位，
 * 圆形图标按钮 + confirm 确认）。删除走 archive.session.delete RPC：
 * 仅限非运行中会话，永久删除日志、摘要、书签与文件夹归属。
 * 当前会话 id 从 sessions store 的 current 字段读取（槽位 owner props 为空）。
 */
import { useState, useSyncExternalStore } from 'react'
import { recordDeletedIds } from './deletedIds.ts'
import type { ConnectionHandle, RpcResult, SessionListState } from './types.ts'

/** 垃圾桶图标（与 shell 16px 导航图标观感一致）。 */
const TRASH_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5h11"/><path d="M4 4.5V3.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1"/><path d="M5 4.5v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-8"/><path d="M6.5 7v3.5M9.5 7v3.5"/></svg>`

/** 删除会话 RPC（与归档面板共用同一端点）。 */
async function deleteSessionRpc(connection: ConnectionHandle, sessionId: string): Promise<void> {
  const result: RpcResult = await connection.rpc.call('/rpc', 'archive.session.delete', { sessionId })
  if (!result.ok) throw new Error(result.error?.message ?? '删除会话失败')
}

/** store 适配器：useSyncExternalStore 直接消费 SnapshotStore。 */
function subscribeOf<T>(store: { subscribe(listener: () => void): () => void }): (listener: () => void) => () => void {
  return listener => store.subscribe(listener)
}
function snapshotOf<T>(store: { getSnapshot(): T }): () => T {
  return () => store.getSnapshot()
}

/** 会话头部删除按钮（owner props 为空；数据源经 inject face 传入）。 */
export function DeleteSessionButton(props: {
  stores: {
    sessions: { list: { getSnapshot(): SessionListState; subscribe(listener: () => void): () => void } }
    connection: ConnectionHandle | undefined
  }
}): JSX.Element {
  const { stores } = props
  const sessionState = useSyncExternalStore(subscribeOf(stores.sessions.list), snapshotOf(stores.sessions.list))
  const [deleting, setDeleting] = useState(false)

  const sessionId = sessionState.current

  const onDelete = async (): Promise<void> => {
    if (deleting || sessionId === undefined) return
    const connection = stores.connection
    if (connection === undefined) {
      window.alert('归档数据服务未连接，无法删除会话')
      return
    }
    if (!window.confirm('永久删除当前会话？日志、摘要、书签与文件夹归属将一并清除，此操作不可撤销。')) return
    setDeleting(true)
    try {
      await deleteSessionRpc(connection, sessionId)
      // 与归档面板的 deletedIds 联动：写入共享 localStorage，面板刷新后不再显示。
      recordDeletedIds([sessionId])
      window.alert('会话已永久删除')
    } catch (cause) {
      window.alert(`删除失败：${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <button
      type="button"
      className="dsh-av-delete-session"
      aria-label="删除当前会话"
      title={sessionId === undefined ? '删除当前会话' : '删除当前会话'}
      disabled={deleting || sessionId === undefined}
      onClick={() => { void onDelete() }}
    >
      {deleting
        ? <span aria-hidden>…</span>
        : <span dangerouslySetInnerHTML={{ __html: TRASH_ICON }} />}
    </button>
  )
}
