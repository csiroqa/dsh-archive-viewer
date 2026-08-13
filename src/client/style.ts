/**
 * dsh-archive-viewer 注入样式。
 * 视觉语言对齐官方 ui-agent-preset（Card/Row/groupHead 模式）与 ui-conversation
 * InputBar：卡片用 bg-layer-3 + border-l2、hover 强化到 label-dimmed；行内列表用
 * border-bottom 分隔；分组头大写 600 letter-spacing；操作按钮为浅底 pill。
 * 全部使用 --dsw-alias-* 令牌跟随皮肤，强调色用 --dsw-alias-state-business-primary。
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

/* ── 面板（fixed 层叠；对齐官方浮层面板观感） ── */
[data-dsh-archive-viewer-panel] {
  position: fixed;
  left: 12px;
  bottom: 128px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: 780px;
  max-width: calc(100vw - 24px);
  height: 76vh;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 14px;
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
  min-height: 52px;
  padding: 12px 16px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
.dsh-av-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
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
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.dsh-av-close:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  border-color: var(--dsw-alias-label-dimmed);
}
.dsh-av-notice {
  flex: none;
  padding: 8px 16px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1, transparent);
}
.dsh-av-notice[data-kind="error"] {
  color: var(--dsw-alias-state-error-primary);
}
.dsh-av-pane {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* ── 左栏：文件夹树（对齐官方侧栏列表观感） ── */
.dsh-av-tree {
  flex: none;
  width: 220px;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1, transparent);
}
.dsh-av-tree-title {
  flex: none;
  padding: 16px 16px 8px;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-av-tree-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px 8px;
}
.dsh-av-tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-family: inherit;
  font-size: 13px;
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
  padding-left: 28px;
}
.dsh-av-tree-icon {
  flex: none;
  width: 14px;
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
  min-width: 22px;
  height: 18px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--dsw-alias-fill-tsp-secondary, var(--dsw-alias-button-ghost-active-fill));
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
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
  width: 22px;
  height: 22px;
  margin-right: 2px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: opacity 0.1s ease;
}
/* hover 与键盘 focus 都要显示，保证触屏与键盘可达。 */
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
  height: 28px;
  margin: 2px 4px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-state-business-primary, #3964fe);
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}
.dsh-av-tree-foot {
  flex: none;
  padding: 8px;
  border-top: 1px solid var(--dsw-alias-border-l2);
}
.dsh-av-tree-new {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px dashed var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-family: inherit;
  font-size: 12.5px;
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
  gap: 10px;
  overflow: hidden;
  padding: 12px 16px 16px;
}
.dsh-av-note {
  flex: none;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--dsw-alias-fill-tsp-secondary, var(--dsw-alias-button-ghost-active-fill));
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-av-list-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
  min-height: 24px;
}
.dsh-av-list-head-label {
  color: var(--dsw-alias-label-secondary);
  font-size: 12.5px;
}
.dsh-av-list-head-count {
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.dsh-av-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}
.dsh-av-empty {
  margin: 24px auto;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-tertiary);
}

/* ── 勾选框（对齐官方列表勾选观感） ── */
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
  width: 16px;
  height: 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: transparent;
  box-sizing: border-box;
  transition: border-color 0.1s ease, background 0.1s ease;
}
.dsh-av-check input:checked + span {
  border-color: var(--dsw-alias-state-business-primary, #3964fe);
  background: var(--dsw-alias-state-business-primary, #3964fe);
}
.dsh-av-check input:checked + span::after {
  content: '';
  width: 8px;
  height: 4px;
  border-left: 2px solid #fff;
  border-bottom: 2px solid #fff;
  transform: rotate(-45deg) translate(0.5px, -0.5px);
}
.dsh-av-check:hover span {
  border-color: var(--dsw-alias-label-dimmed);
}
.dsh-av-check input:focus-visible + span {
  outline: 2px solid var(--dsw-alias-state-business-primary, #3964fe);
  outline-offset: 1px;
}

/* ── 会话卡片（对齐官方 Card 模式：bg-layer-3 底 + hover 强化边框） ── */
.dsh-av-row {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3);
  transition: border-color 0.16s ease, background 0.16s ease;
}
.dsh-av-row:hover:not([data-checked="true"]) {
  border-color: var(--dsw-alias-label-dimmed);
}
.dsh-av-row[data-checked="true"] {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-state-business-primary, #3964fe);
}
.dsh-av-row-head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.dsh-av-row-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-av-row-meta {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.dsh-av-badge {
  flex: none;
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #3964fe) 12%, transparent);
  color: var(--dsw-alias-state-business-primary, #3964fe);
  font-size: 11px;
  font-weight: 500;
  line-height: 20px;
  max-width: 140px;
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
  padding-left: 28px;
}
/* 操作按钮：官方浅底 pill */
.dsh-av-btn {
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
  color: var(--dsw-alias-label-secondary);
  font-family: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: background 0.1s ease, color 0.1s ease;
}
.dsh-av-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh-av-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.dsh-av-select {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-family: inherit;
  font-size: 12.5px;
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
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #3964fe) 12%, transparent);
}
.dsh-av-btn[data-has-note="true"] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-av-note-editor {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-av-note-input {
  min-height: 64px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 13px;
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
  color: var(--dsw-alias-state-business-primary, #3964fe);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #3964fe) 12%, transparent);
}
.dsh-av-btn-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #3964fe) 18%, transparent);
}

/* ── 对话日志 ── */
.dsh-av-log {
  border-top: 1px dashed var(--dsw-alias-border-l2);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 32vh;
  overflow-y: auto;
}
.dsh-av-msg {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dsh-av-msg-role {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-caption);
}
.dsh-av-msg-text {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dsw-alias-label-secondary);
}
.dsh-av-load-older {
  align-self: flex-start;
}
.dsh-av-log-error,
.dsh-av-log-empty {
  font-size: 12.5px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}

/* ── 底部批量操作条 ── */
.dsh-av-batchbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1, transparent);
}
.dsh-av-batchbar-count {
  flex: none;
  font-size: 13px;
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
  gap: 10px;
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
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
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
  gap: 10px;
}
.dsh-av-sm {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3);
  transition: border-color 0.16s ease;
}
.dsh-av-sm:hover {
  border-color: var(--dsw-alias-label-dimmed);
}
.dsh-av-sm-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.dsh-av-sm-goal {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-av-sm-time {
  flex: none;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
}
.dsh-av-sm-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dsh-av-sm-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dsh-av-sm-label {
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--dsw-alias-label-caption);
}
.dsh-av-sm-list {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dsh-av-sm-list li {
  font-size: 12.5px;
  line-height: 19px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-av-sm-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-av-btn-sm {
  height: 24px;
  padding: 0 10px;
  font-size: 12px;
}
.dsh-av-sm-md {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--dsw-alias-fill-tsp-secondary, var(--dsw-alias-button-ghost-active-fill));
  font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 1.55;
  color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 24vh;
  overflow-y: auto;
}

/* ── 右上角「关闭 dsh」按钮 ── */
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
  background: var(--dsw-alias-interactive-bg-hover-danger, var(--dsw-alias-interactive-bg-hover));
  color: var(--dsw-alias-state-error-primary);
}
.dsh-av-shutdown:disabled {
  opacity: 0.5;
  cursor: default;
}
`
