# Windows / WSL deployment

This directory keeps the measured cross-platform deployment notes for the
backend and the two stdio MCP examples used on the target machines.

- `WSL与Windows部署实测报告.md` — measured WSL2 / native Windows deployment, test counts and limitations.
- `mcp-client.windows.json` — example stdio MCP configuration for native Windows. Replace the absolute paths with your checkout and `.venv\Scripts\python.exe`.
- `mcp-client.wsl.json` — example stdio MCP configuration for WSL2. Replace the absolute paths with your checkout and `.venv/bin/python`.

The scripts are `scripts/deploy_windows.ps1` (PowerShell) and
`scripts/deploy_wsl.sh` (bash). Both install only into the project directory;
they do not modify global Python, PATH, CUDA drivers or login startup items.

The DSH workbench plugin detects `.venv\Scripts\python.exe` on Windows and
`.venv/bin/python` on Linux/WSL. For a checkout that is not adjacent to the
plugin, set the plugin row's `appRoot` or the `CONVOLVEX_MS_ROOT` environment
variable to the repository root.
