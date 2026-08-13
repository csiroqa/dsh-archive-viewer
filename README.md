# dsh-archive-viewer

DeepSeek Harness（DSH）Web GUI 的**归档增强插件**：自动定期归档、文件夹归档整理、LLM 摘要沉淀经验库、会话收藏与便签，外加已归档会话的查看 / 恢复与一键关闭 dsh。

English: [README.en.md](README.en.md)

## 功能

### 归档管理

- **自动定期归档**（host 半区）：`ctx.interval` 周期扫描空闲会话（非运行中、最后活跃早于 `maxIdleDays`、未 pin、未归档），幂等归档——日志、附件与工作区分组位置完整保留
- **文件夹归档**：左栏文件夹树（全部归档 / 自定义文件夹 / 未分类 / 收藏 / 经验库），可新建、重命名、删除文件夹，会话可移入/移出；归属关系持久化在 `$DSH_HOME/archive_snapshots/folders.json`
- **批量操作**：勾选多个会话后批量导出 ZIP / 生成摘要 / 恢复 / 移动
- **查看对话**：直接读取归档会话日志（`session.history`，冷会话走持久化检查），支持分页加载更早
- **下载日志 ZIP**：官方 `session.export` 端点
- **恢复会话（取消归档）**：一键放回原工作区分组

### 经验库（LLM 摘要沉淀）

- 会话完成（running → idle）或手动点「生成摘要」时，用 `ctx.llm.stream` 生成结构化摘要（目标 / 关键决策 / 产出 / 可复用经验 / 遗留问题）
- 以 Markdown + JSON 写入 `$DSH_HOME/archive_snapshots/`，面板「经验库」视图支持全文搜索与重新生成
- 摘要模型走插件 config 的 `provider / model`（与 DSH 的 LLM 路由一致），未配置时点「生成摘要」会提示

### 收藏 + 便签

- 每个会话卡片可「☆ 收藏 / ★ 已收藏」、写便签；收藏视图展示所有收藏会话（含未归档）
- 持久化在 `$DSH_HOME/archive_snapshots/bookmarks.json`

### 其他

- **右上角「关闭 dsh」按钮**：确认后优雅关机（等价于 Ctrl+C，5 秒宽限收尾）
- **皮肤全适配**：全部使用 shell 设计令牌（`--dsw-alias-*` + `--ln-primary` 品牌色），自动跟随任意皮肤；面板 Portal 到 `document.body` 避开侧边栏令牌覆盖

## 配置

插件行（`cordis.patch.yml` 的 `archive-viewer` insert 行）支持以下可选 config：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `autoArchiveEnabled` | `true` | 自动定期归档开关 |
| `maxIdleDays` | `7` | 会话空闲多少天后自动归档 |
| `scanIntervalMinutes` | `30` | 扫描周期（分钟） |
| `pinnedSessionIds` | `[]` | 永不自动归档的会话 id |
| `summarizeEnabled` | `true` | 自动摘要沉淀开关 |
| `provider` / `model` | 未配置 | 摘要模型路由（与 DSH 的 LLM 配置一致） |
| `maxInputBytes` | `65536` | 摘要输入字节上限 |
| `maxOutputTokens` | `1024` | 摘要输出 token 上限 |
| `timeoutMs` | `60000` | 摘要请求超时（毫秒） |

## 依赖：DSH 核心补丁（必读）

「恢复会话」与「关闭 dsh」依赖 DSH 核心新增的两个 RPC（截至 2026-08 官方尚未包含）：

- `workspace.unarchiveSession` —— 注册表级取消归档
- `host.shutdown` —— 经 CLI 启动器的 `appExit` 触发优雅关机

使用前请先应用补丁：

```sh
cd <你的 deepseek-harness 检出目录>
git apply /path/to/dsh-archive-viewer/patches/0001-workspace-unarchive-and-host-shutdown-rpcs.patch
```

然后**重启 dsh web**（源码运行时 tsx 直接执行，无需构建；发布包安装的用户需重新构建受影响包）。补丁共 8 个文件：workspace 注册表、apiproxy 接口/校验/路由/实现、host schema 等。

> 若 DSH 官方后续合入这两个 RPC，补丁会变为空操作，可安全跳过。

## 安装

前置：Node.js >= 22、pnpm。

```sh
git clone https://github.com/csiroqa/dsh-archive-viewer.git
cd dsh-archive-viewer
pnpm install
pnpm build

# 安装进 web profile（link: 指向本目录）
dsh plugin --profile web add link:$(pwd)        # POSIX
dsh plugin --profile web add link:E:\path\to\dsh-archive-viewer   # Windows
```

重启 `dsh web`，浏览器 **Ctrl+F5** 硬刷新。

## 使用

1. 侧边栏底部（设置按钮上方）点击「已归档会话」打开面板
2. 左栏文件夹树切换视图；会话卡片：**查看对话 / 生成摘要 / 收藏 / 便签 / 恢复 / 导出 ZIP**
3. 勾选多个会话后底部批量操作条出现；「经验库」视图检索沉淀摘要
4. 会话头部**右上角**电源按钮 → 确认后关闭 dsh

## 兼容性

- 针对 DSH `0.1.0-rc.5` 源码检出开发验证
- 客户端零框架类型依赖：不 import 任何 `@deepseek-ai/*` 值，全部结构类型，不随 DSH SDK 版本漂移
- 构建产物：`tsdown`（host 半区 `lib/index.js` + browser 半区 `lib/client.js`，标准 `window.__ModuleLoader__.load` 闭包工厂格式）

## 许可与使用声明

**MIT License**（见 [LICENSE](LICENSE)）。

欢迎任何人**使用、修改、引用、或把本项目收录进自己的插件合集**，只需：

- 保留 `LICENSE` 文件与版权声明
- 标明出处（本仓库链接）

## 相关

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- 插件形态参考 [dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)（`dsh.bundle.patch` + `dsh.client` 声明 + 槽位注册）
