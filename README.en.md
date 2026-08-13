# dsh-archive-viewer

Archived-session manager for the **DeepSeek Harness (DSH) Web GUI**: browse, read, and **restore archived sessions**, plus a one-click **shutdown button** in the header.

中文说明见 [README.md](README.md)。

## Features

- **Sidebar plugin-bar entry「已归档会话」**: lists every archived session — title, last activity, workspace, running/blank state
- **Read conversations**: loads the archived session log via `session.history` (cold sessions read through persistence inspection, no agent activation), with paging for older messages
- **Download log ZIP**: official `session.export` endpoint
- **Restore sessions (unarchive)**: one click puts the session back into its original workspace group, position preserved
- **Shutdown button** (header, top-right): graceful host shutdown (equivalent to Ctrl+C — 5s grace teardown)
- **Skin-adaptive**: all styling uses shell design tokens (`--dsw-alias-*`), following any skin; the panel is portaled to `document.body` to avoid sidebar-scoped token overrides

## Required DSH core patch (read first)

"Restore" and "Shutdown" depend on two new RPCs not yet in upstream DSH (as of 2026-08):

- `workspace.unarchiveSession`
- `host.shutdown`

Apply the patch before use:

```sh
cd <your deepseek-harness checkout>
git apply /path/to/dsh-archive-viewer/patches/0001-workspace-unarchive-and-host-shutdown-rpcs.patch
```

Then **restart `dsh web`** (source checkouts run via tsx — no build needed; packaged installs must rebuild the affected packages). The patch touches 8 files: the workspace registry, and the apiproxy interface/schemas/routes/implementation.

> If upstream DSH ever merges these RPCs (the `workspace.ts` comment "a future unarchive" marks exactly this spot), the patch becomes a no-op and can be skipped safely.

## Install

Requirements: Node.js >= 22, pnpm.

```sh
git clone https://github.com/keepermttl/dsh-archive-viewer.git
cd dsh-archive-viewer
pnpm install
pnpm build

dsh plugin --profile web add link:$(pwd)      # POSIX
dsh plugin --profile web add link:E:\path\to\dsh-archive-viewer   # Windows
```

Restart `dsh web` and hard-refresh (Ctrl+F5).

## Usage

1. Sidebar bottom (above Settings): open「已归档会话」
2. Per row: **Read conversation / Restore / Download ZIP / Copy ID**
3. Header top-right power button: confirm to shut down dsh

## Compatibility

- Developed and verified against a DSH `0.1.0-rc.5` source checkout
- Zero framework type dependencies: no `@deepseek-ai/*` value imports, structural types only — no drift with DSH SDK versions
- Build: `tsdown` (host half `lib/index.js` + browser half `lib/client.js`, standard `window.__ModuleLoader__.load` closure-factory format)

## License & usage statement

**MIT License** (see [LICENSE](LICENSE)).

Anyone is welcome to **use, modify, reference, or bundle this project into their own plugin collections** (e.g. a dsh-web-ui family repo), as long as you keep the `LICENSE` file / copyright notice and credit the source (this repository).

## Related

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- Plugin shape modeled after [dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui) (`dsh.bundle.patch` + `dsh.client` declaration + slot registration)
