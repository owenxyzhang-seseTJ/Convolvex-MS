# DSH integration

This directory contains the DeepSeek Harness (DSH) bundle that exposes the
Convolvex-MS MCP server as native agent tools.

## Components

| Item | Location |
|---|---|
| Visual workbench bundle | `convolvex-ms-workbench/` |
| MCP tools bundle | `convolvex-ms-mcp/` |
| Server name | `convolvex-ms` |
| Transport | stdio (spawns `.venv/bin/python -m convolvex.mcp_server`) |
| Private workspace | `../runtime/ms-stdio` |
| Agent tool prefix | `mcp__convolvex-ms__` |

The stdio workspace is deliberately separate from `runtime/ms-http`: a
Convolvex-MS workspace allows one live server per directory.

This bundle is a local-only integration: `cordis.patch.yml` contains absolute
paths to this checkout, so moving or renaming `Convolvex_MS_1.1.0` requires
updating those two paths and reloading the bundle.

## Tools exposed

`ms_capabilities`, `ms_import_dataset`, `ms_import_file`, `ms_inspect`,
`ms_check_response`, `ms_background`, `ms_submit_analysis`,
`ms_submit_mass_profile`, `ms_get_job`, `ms_get_result`, `ms_read_array`,
`ms_list_jobs`, `ms_cancel_job`, `ms_integrate_charge`, `ms_quantify`.

## Local change required for DSH 0.2.2 / MCP 2026-07-28

DSH's MCP client negotiates the `2026-07-28` protocol and validates list
results against SEP-2549: cacheable results require `ttlMs` and `cacheScope`.
`src/convolvex/mcp_server.py` now adds `ttlMs: 60000` and
`cacheScope: "private"` to `tools/list`, `resources/list`,
`resources/templates/list`, `prompts/list`, `resources/read` and
`server/discover` replies. The same file was synced into the installed
virtualenv; `195 passed, 1 skipped` after the change.

## Install / remove the DSH bundle

The bundle is already installed in the `desktop` DSH profile as
`@local/convolvex-ms-mcp`. To install it again or on another machine, open
DSH **Settings → Plugins → Add plugin** and choose this bundle's directory
(`dsh-integration/convolvex-ms-mcp`). Removing the bundle removes the
`mcp__convolvex-ms__*` tools; it does not stop the standalone Web workbench or
HTTP MCP service.


## Visual workbench

`convolvex-ms-workbench/` adds a **Convolvex-MS 质谱工作台** entry to the DSH
left sidebar. It embeds the original `src/convolvex/web` frontend in a Shadow
DOM panel and starts the project's Python web service lazily for the selected
DSH workspace. Data is isolated under `<workspace>/.convolvex-ms`, and the
`convolvex_workbench` agent tool reads the same records. See its README for
build, configuration, and workspace details.

Install from npm:

```bash
dsh plugin --profile desktop add dsh-convolvex-ms-workbench
```
