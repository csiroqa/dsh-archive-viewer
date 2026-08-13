/**
 * 已删除会话 id 的共享存储（localStorage 持久化）。
 * 归档面板与会话头部删除按钮共用：删除成功后写入，刷新页面后仍隐藏
 * （workspace 表在重启 bootstrap 时才会彻底移除）。
 */

const DELETED_IDS_KEY = 'dsh-archive-viewer:deleted-ids'

/** 读取已删除 id 集合（localStorage 不可用或数据损坏时返回空集）。 */
export function loadDeletedIds(): Readonly<Set<string>> {
  try {
    const raw = window.localStorage.getItem(DELETED_IDS_KEY)
    if (raw === null) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? new Set(parsed.filter((item): item is string => typeof item === 'string'))
      : new Set()
  } catch {
    return new Set()
  }
}

/** 追加已删除 id 并持久化；返回更新后的集合。 */
export function recordDeletedIds(ids: readonly string[]): Readonly<Set<string>> {
  if (ids.length === 0) return loadDeletedIds()
  const next = new Set([...loadDeletedIds(), ...ids])
  try {
    window.localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...next]))
  } catch {
    // 持久化失败不影响本会话内的隐藏
  }
  return next
}
