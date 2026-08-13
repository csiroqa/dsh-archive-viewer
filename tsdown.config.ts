/**
 * dsh-archive-viewer — 查看已归档会话的 DSH Web 客户端插件。
 *
 * 构建产出两个半区：
 *  - lib/index.js   host 半区（node 进程侧，仅日志占位）
 *  - lib/client.js  browser 半区（Web GUI 侧，真正的查看器）
 *
 * 客户端打包约定（与官方 packages/client/tsdown.client.ts 一致）：
 * 闭包工厂产物 —— bundle 调用 window.__ModuleLoader__.load({ id, factory })，
 * 外部模块（react 平台模块表等）经注入的 require 在运行时解析，绝不内联。
 */
import type { UserConfig } from 'tsdown'

/** 本插件包名（同时是 client bundle 的 loader id）。 */
const ID = '@dsh-external/dsh-archive-viewer'

/**
 * 浏览器侧外部模块：平台种子表（PLATFORM_MODULES）加 runtime/client 豁免。
 * 与 host 的模块表逐字一致；运行时由 loader 的 require 提供。
 */
const PLATFORM_EXTERNALS = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-client-runtime/client',
]

/** host 半区：node 侧库构建（cordis 由 profile 树在运行时提供）。 */
const libConfig: UserConfig = {
  name: ID,
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  // 保持入口文件名：src/index.ts → lib/index.js（package.json main 指向它）。
  fixedExtension: false,
  dts: false,
  clean: false,
  external: ['@deepseek-ai/cordis'],
}

/** browser 半区：client bundle（lib/client.js）。 */
const clientConfig: UserConfig = {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [...PLATFORM_EXTERNALS],
  // 除平台模块表外的依赖全部内联（本插件实际只依赖 react 平台模块）。
  noExternal: (id: string) => (PLATFORM_EXTERNALS.includes(id) ? undefined : true),
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default ({ env }: { env?: { DSH_BUILD_FACE?: string } }) => {
  const face = env?.DSH_BUILD_FACE
  if (face !== undefined && face !== 'host' && face !== 'client') {
    throw new Error(`tsdown: --env.DSH_BUILD_FACE must be host or client, received ${String(face)}`)
  }
  if (face === 'host') return [libConfig]
  if (face === 'client') return [clientConfig]
  return [libConfig, clientConfig]
}
