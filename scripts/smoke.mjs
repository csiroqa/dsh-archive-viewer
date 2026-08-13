/**
 * 跨平台冒烟测试（本地与 CI 共用）：
 *   node --experimental-strip-types scripts/smoke.mjs
 *
 * 覆盖：host 产物可加载、文件夹 store 的 CRUD/归属/移出、书签 store 的
 * 收藏切换/便签/幽灵条目清理。不依赖 DSH 运行时（纯逻辑层），
 * 三平台（Windows/macOS/Linux）均应通过。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fromRoot = (relative) => pathToFileURL(resolve(root, relative)).href

// 1) host 产物可加载
const host = await import(fromRoot('lib/index.js'))
if (typeof host.apply !== 'function' || !host.name) {
  throw new Error(`host bundle exports invalid: ${Object.keys(host).join(',')}`)
}
console.log(`host bundle ok: ${host.name}`)

// 2) 文件夹 store：CRUD + 归属 + 移出到未分类
const { FolderStore } = await import(fromRoot('src/index.ts'))
const home = mkdtempSync(join(tmpdir(), 'dsh-av-smoke-'))
try {
  const folders = new FolderStore(home)

  const folder = await folders.create('项目A')
  if (folder.name !== '项目A' || folder.id === '') throw new Error('folder create failed')

  const renamed = await folders.rename(folder.id, '项目B')
  if (renamed?.name !== '项目B') throw new Error('folder rename failed')

  await folders.move('s1', folder.id)
  await folders.move('s2', folder.id)
  const assignment = await folders.assignmentOf()
  if (assignment['s1'] !== folder.id || assignment['s2'] !== folder.id) throw new Error('folder move failed')

  await folders.move('s1', undefined)
  const after = await folders.assignmentOf()
  if (after['s1'] !== undefined || after['s2'] !== folder.id) throw new Error('folder move-to-unclassified failed')

  const removed = await folders.remove(folder.id)
  if (!removed) throw new Error('folder remove failed')
  if ((await folders.assignmentOf())['s2'] !== undefined) throw new Error('folder remove must clear assignments')

  console.log('folder store ok (create/rename/move/unassign/remove)')
} finally {
  rmSync(home, { recursive: true, force: true })
}

// 3) 书签 store：切换 + 便签 + 幽灵条目清理
const home2 = mkdtempSync(join(tmpdir(), 'dsh-av-bm-smoke-'))
try {
  const { BookmarkStore } = await import(fromRoot('src/index.ts'))
  const bookmarks = new BookmarkStore(home2)

  const toggledOn = await bookmarks.toggle('s1')
  if (!toggledOn.bookmarked) throw new Error('bookmark toggle-on failed')

  const noted = await bookmarks.setNote('s1', '记住这个结论')
  if (noted?.note !== '记住这个结论') throw new Error('bookmark note failed')

  // 便签清空但已收藏：条目保留（bookmarked=true），note 归空。
  const cleared = await bookmarks.setNote('s1', '')
  if (cleared === null || cleared.note !== '' || !cleared.bookmarked) {
    throw new Error('note-clear must keep bookmarked entry')
  }

  // 取消收藏后（bookmarked=false 且 note=''）：幽灵条目被删除。
  const toggledOff = await bookmarks.toggle('s1')
  if (toggledOff.bookmarked) throw new Error('bookmark toggle-off failed')
  if ((await bookmarks.list()).length !== 0) throw new Error('ghost entry must be pruned from list')

  // 纯便签（未收藏）清空：条目删除，setNote 返回 null。
  await bookmarks.setNote('s2', '仅便签')
  const ghost = await bookmarks.setNote('s2', '')
  if (ghost !== null) throw new Error('note-clear on unbookmarked must return null')

  console.log('bookmark store ok (toggle/note/ghost-prune)')
} finally {
  rmSync(home2, { recursive: true, force: true })
}
