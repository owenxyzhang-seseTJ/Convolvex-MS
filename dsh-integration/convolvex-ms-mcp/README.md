# Convolvex-MS MCP connection

Configuration-only DSH bundle that connects the local Convolvex-MS server as a
stdio MCP server.

- Server name: `convolvex-ms`
- Tools: `mcp__convolvex-ms__ms_capabilities`, `ms_import_dataset`,
  `ms_import_file`, `ms_inspect`, `ms_check_response`, `ms_background`,
  `ms_submit_analysis`, `ms_submit_mass_profile`, `ms_get_job`, `ms_get_result`,
  `ms_read_array`, `ms_list_jobs`, `ms_cancel_job`, `ms_integrate_charge`,
  `ms_quantify`
- Python: `Convolvex_MS_1.1.0/.venv/bin/python`
- Workspace: `Convolvex_MS_1.1.0/runtime/ms-stdio` (separate from the HTTP
  service workspace, because Convolvex-MS allows one server per workspace)
- Transport: stdio, so no port or bearer token is needed.

The connection is local only. Convolvex-MS returns numerical fits, not compound
identities, and no tool creates or verifies a calibration.


## Windows / WSL

The patch contains checkout-specific absolute paths so it works as a local
bundle. For a different checkout, edit `cordis.patch.yml`:

- Windows: `command: C:\path\to\Convolvex-MS\.venv\Scripts\python.exe`
  and a Windows `cwd`/`--workspace`.
- WSL/Linux: `command: /path/to/Convolvex-MS/.venv/bin/python`
  and the matching POSIX `cwd`/`--workspace`.

The MCP stdio workspace must remain separate from the loopback HTTP service
workspace; Convolvex-MS permits one active server per workspace directory.
