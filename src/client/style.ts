/**
 * dsh-archive-viewer 注入样式。
 * 全部使用 shell 的设计令牌（--dsw-alias-* / --dsh-*）：皮肤（skin）就是重定义
 * 这些变量，因此本插件自动跟随当前皮肤，无需逐皮肤适配。几何与交互样式参照
 * 官方 ui-cordis 的 CordisPanel.module.css（同为 sidebar.footer.action 注册项）。
 */

export const CSS_TEXT = `
/* ── 侧边栏插件栏入口（sidebar.footer.action 列表项） ── */
[data-dsh-archive-viewer-layer] {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  width: 100%;
  height: 49px;
  margin: 8px 0 0;
}
[data-dsh-archive-viewer-layer][data-rail="true"] {
  width: 36px;
  height: 36px;
  margin: 0;
}
[data-dsh-archive-viewer-footer] {
  display: flex;
  align-items: center;
  width: 100%;
}
[data-dsh-archive-viewer-layer][data-rail="true"] [data-dsh-archive-viewer-footer] {
  flex-direction: column;
  gap: 2px;
}
[data-dsh-archive-viewer-badge] {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 49px;
  padding: 0 8px 0 6px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
  overflow: hidden;
}
[data-dsh-archive-viewer-badge]:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
[data-dsh-archive-viewer-badge][data-active="true"] {
  background: var(--dsw-alias-interactive-bg-hover);
}
[data-dsh-archive-viewer-layer][data-rail="true"] [data-dsh-archive-viewer-badge] {
  justify-content: center;
  gap: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 50%;
}
[data-dsh-archive-viewer-badge-label] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 面板（fixed 层叠，锚在侧边栏上方；几何参照 CordisPanel） ── */
[data-dsh-archive-viewer-panel] {
  position: fixed;
  left: 12px;
  bottom: 128px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: 560px;
  max-width: calc(100vw - 24px);
  max-height: 72vh;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  /* 浮动层必须用 overlay 令牌：皮肤的 bg-base 是半透明/全透明（whale-song 0.42、
     maid-atelier transparent），bg-overlay 才是各皮肤为浮动面板准备的高不透明度面
     （0.92+）。带 fallback 链保证任何主题下都有实底。 */
  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-base, #111418));
  box-shadow: var(--dsw-shadow-lv2);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}
.dsh-av-header {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 12px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  /* 继承面板 overlay 实底，不再单独上底色（皮肤下 bg-base 可能透明）。 */
}
.dsh-av-title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
}
.dsh-av-count {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}
.dsh-av-close {
  margin-left: auto;
  padding: 3px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsh-av-close:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-av-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dsh-av-note {
  flex: none;
  margin: 4px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-button-ghost-active-fill);
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-av-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  margin: 0;
}
.dsh-av-empty {
  margin: 12px auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-av-row {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  /* 行继承面板 overlay 实底；边框提供卡片层次，不再单独上底色。 */
}
.dsh-av-row-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dsh-av-row-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-av-row-meta {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}
.dsh-av-badge {
  flex: none;
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: var(--dsw-alias-button-ghost-active-fill);
  font-size: 11px;
  line-height: 18px;
  color: var(--dsw-alias-label-caption);
}
.dsh-av-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.dsh-av-btn {
  padding: 3px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsh-av-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-av-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.dsh-av-notice {
  flex: none;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-av-notice[data-kind="error"] {
  color: var(--dsw-alias-state-error-primary);
}
.dsh-av-log {
  border-top: 1px dashed var(--dsw-alias-border-l2);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 40vh;
  overflow-y: auto;
}
.dsh-av-msg {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dsh-av-msg-role {
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-caption);
}
.dsh-av-msg-text {
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dsw-alias-label-secondary);
}
.dsh-av-msg-block {
  font-size: 11px;
  font-style: italic;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-av-load-older {
  align-self: flex-start;
}
.dsh-av-log-error {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-state-error-primary);
}
.dsh-av-log-empty {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}

/* ── 右上角「关闭 dsh」按钮（会话头部 utilities 区；几何参照 CordisPanel 的
     圆形 actionButton，悬停转为错误色提示其破坏性语义） ── */
.dsh-av-shutdown {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
}
.dsh-av-shutdown:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-state-error-primary);
}
.dsh-av-shutdown:disabled {
  opacity: 0.5;
  cursor: default;
}
`
