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
  width: 760px;
  max-width: calc(100vw - 24px);
  height: 76vh;
  max-height: 76vh;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 14px;
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
  min-height: 46px;
  padding: 10px 14px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  background: linear-gradient(to bottom, var(--dsw-alias-bg-layer-1, transparent), transparent);
}
.dsh-av-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  letter-spacing: 0.01em;
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
  transition: background 0.12s ease, border-color 0.12s ease;
}
.dsh-av-close:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  border-color: var(--dsw-alias-border-l1);
}
.dsh-av-notice {
  flex: none;
  padding: 6px 14px;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
.dsh-av-notice[data-kind="error"] {
  color: var(--dsw-alias-state-error-primary);
}
.dsh-av-pane {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* ── 左栏：文件夹树 ── */
.dsh-av-tree {
  flex: none;
  width: 208px;
  min-width: 208px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1, transparent);
}
.dsh-av-tree-title {
  flex: none;
  padding: 12px 14px 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--dsw-alias-label-caption);
}
.dsh-av-tree-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0 8px 8px;
}
.dsh-av-tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 28px;
  padding: 0 9px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-family: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease, color 0.1s ease;
}
.dsh-av-tree-item:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh-av-tree-item[data-active="true"] {
  background: var(--dsw-alias-interactive-bg-active);
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
.dsh-av-tree-item[data-active="true"] .dsh-av-tree-icon {
  color: var(--dsw-alias-state-business-primary, #3964fe);
}
.dsh-av-tree-item[data-indent="true"] {
  padding-left: 26px;
}
.dsh-av-tree-icon {
  flex: none;
  width: 12px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
}
.dsh-av-tree-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-av-tree-count {
  flex: none;
  min-width: 20px;
  height: 16px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--dsw-alias-button-ghost-active-fill);
  color: var(--dsw-alias-label-caption);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}
.dsh-av-tree-item[data-active="true"] .dsh-av-tree-count {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
}
.dsh-av-tree-node {
  position: relative;
  display: flex;
  align-items: center;
  border-radius: 8px;
}
.dsh-av-tree-node .dsh-av-tree-mini {
  visibility: hidden;
  opacity: 0;
  flex: none;
  width: 20px;
  height: 20px;
  margin-right: 2px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: opacity 0.1s ease;
}
/* hover 与键盘 focus（:focus-within）都要显示，保证触屏与键盘可达。 */
.dsh-av-tree-node:hover .dsh-av-tree-mini,
.dsh-av-tree-node:focus-within .dsh-av-tree-mini {
  visibility: visible;
  opacity: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dsh-av-tree-node .dsh-av-tree-mini:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh-av-tree-node .dsh-av-tree-mini-del:hover {
  color: var(--dsw-alias-state-error-primary);
}
.dsh-av-tree-edit {
  flex: 1;
  min-width: 0;
  height: 24px;
  margin: 1px 4px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-state-business-primary, #3964fe);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 12px;
  outline: none;
}
.dsh-av-tree-foot {
  flex: none;
  padding: 6px;
  border-top: 1px solid var(--dsw-alias-border-l2);
}
.dsh-av-tree-new {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease, background 0.12s ease;
}
.dsh-av-tree-new:hover {
  border-color: var(--dsw-alias-state-business-primary, #3964fe);
  color: var(--dsw-alias-state-business-primary, #3964fe);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #3964fe) 8%, transparent);
}

/* ── 右栏 ── */
.dsh-av-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
  padding: 10px 14px 12px;
}
.dsh-av-note {
  flex: none;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-button-ghost-active-fill);
  font-size: 11.5px;
  line-height: 17px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-av-list-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
}
.dsh-av-list-head-label {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.dsh-av-list-head-count {
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}
.dsh-av-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding-right: 2px;
}
.dsh-av-empty {
  margin: 12px auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}

/* ── 勾选框（与 shell 列表一致的外观） ── */
.dsh-av-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: none;
  cursor: pointer;
}
.dsh-av-check input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}
.dsh-av-check span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  background: transparent;
  box-sizing: border-box;
}
.dsh-av-check input:checked + span {
  border-color: var(--dsw-alias-state-business-primary, #3964fe);
  background: var(--dsw-alias-state-business-primary, #3964fe);
}
.dsh-av-check input:checked + span::after {
  content: '';
  width: 7px;
  height: 4px;
  border-left: 2px solid var(--dsw-alias-fg-on-accent, #fff);
  border-bottom: 2px solid var(--dsw-alias-fg-on-accent, #fff);
  transform: rotate(-45deg) translate(0.5px, -0.5px);
}
.dsh-av-check:hover span {
  border-color: var(--dsw-alias-border-l1);
}
.dsh-av-check input:focus-visible + span {
  outline: 2px solid var(--dsw-alias-state-business-primary, #3964fe);
  outline-offset: 1px;
}

/* ── 会话卡片 ── */
.dsh-av-row {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}
.dsh-av-row:hover {
  border-color: var(--dsw-alias-label-dimmed);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.dsh-av-row[data-checked="true"] {
  border-color: var(--dsw-alias-state-business-primary, #3964fe);
  box-shadow: 0 0 0 1px var(--dsw-alias-state-business-primary, #3964fe) inset;
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
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #3964fe) 10%, transparent);
  color: var(--dsw-alias-state-business-primary, #3964fe);
  font-size: 11px;
  line-height: 18px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  transition: background 0.1s ease, border-color 0.1s ease, color 0.1s ease;
}
.dsh-av-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  border-color: var(--dsw-alias-border-l1);
}
.dsh-av-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.dsh-av-select {
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.1s ease;
}
.dsh-av-select:focus {
  border-color: var(--dsw-alias-state-business-primary, #3964fe);
}

/* ── 收藏 + 便签 ── */
.dsh-av-btn[data-bookmarked="true"] {
  color: var(--dsw-alias-state-business-primary, #3964fe);
  border-color: var(--dsw-alias-state-business-primary, #3964fe);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #3964fe) 8%, transparent);
}
.dsh-av-btn[data-has-note="true"] {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l1);
}
.dsh-av-note-editor {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-button-ghost-active-fill);
}
.dsh-av-note-input {
  min-height: 56px;
  padding: 6px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
}
.dsh-av-note-input:focus {
  border-color: var(--dsw-alias-state-business-primary, #3964fe);
}
.dsh-av-note-input::placeholder {
  color: var(--dsw-alias-label-tertiary);
}
.dsh-av-note-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.dsh-av-btn-primary {
  border-color: var(--dsw-alias-state-business-primary, #3964fe);
  color: var(--dsw-alias-state-business-primary, #3964fe);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #3964fe) 8%, transparent);
}
.dsh-av-btn-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #3964fe) 14%, transparent);
}
.dsh-av-log {
  border-top: 1px dashed var(--dsw-alias-border-l2);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 32vh;
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
.dsh-av-load-older {
  align-self: flex-start;
}
.dsh-av-log-error,
.dsh-av-log-empty {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}

/* ── 底部批量操作条 ── */
.dsh-av-batchbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid var(--dsw-alias-border-l2);
  background: linear-gradient(to top, var(--dsw-alias-bg-layer-1, transparent), transparent);
}
.dsh-av-batchbar-count {
  flex: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-state-business-primary, #3964fe);
  margin-right: 4px;
}
.dsh-av-batchbar-move {
  margin-left: auto;
}

/* ── 经验库视图：搜索 + 沉淀卡片 ── */
.dsh-av-library {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh-av-library-toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-av-search {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 12.5px;
  outline: none;
}
.dsh-av-search::placeholder {
  color: var(--dsw-alias-label-tertiary);
}
.dsh-av-search:focus {
  border-color: var(--dsw-alias-state-business-primary, #3964fe);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary, #3964fe) 18%, transparent);
}
.dsh-av-sm-list-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh-av-sm {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  transition: border-color 0.12s ease;
}
.dsh-av-sm:hover {
  border-color: var(--dsw-alias-label-dimmed);
}
.dsh-av-sm-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.dsh-av-sm-goal {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 19px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-av-sm-time {
  flex: none;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
}
.dsh-av-sm-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dsh-av-sm-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dsh-av-sm-label {
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  color: var(--dsw-alias-label-caption);
}
.dsh-av-sm-list {
  margin: 0;
  padding-left: 14px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.dsh-av-sm-list li {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-av-sm-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-av-btn-sm {
  padding: 2px 8px;
  font-size: 11px;
}
.dsh-av-sm-md {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-button-ghost-active-fill);
  font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 24vh;
  overflow-y: auto;
}

/* ── 右上角「关闭 dsh」按钮（会话头部 utilities 区） ── */
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