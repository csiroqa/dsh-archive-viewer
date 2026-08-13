/**
 * Host half of dsh-archive-viewer.
 *
 * 查看器本体在 browser 半区（src/client/），host 侧只负责占位：
 * 归档/取消归档 API 均属 workspace 域，本插件不注册任何 host 能力。
 * 用结构化类型而非 @deepseek-ai/cordis 类型，保持包完全自包含。
 */

/** 结构化最小 ctx（cordis Context 的可用子集），避免引入框架类型依赖。 */
interface HostContext {
  logger: {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
  }
}

/** Stable Cordis plugin name（loader 行 id 由 cordis.patch.yml 的 insert 决定）。 */
export const name = 'archive-viewer'

/**
 * Mount the host half.
 * @param ctx - host plugin context.
 */
export function apply(ctx: HostContext): void {
  ctx.logger.info('[dsh-archive-viewer] host half loaded; the archived-session viewer runs in the browser')
}
