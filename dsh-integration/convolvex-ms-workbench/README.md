# Convolvex-MS 工作台（DSH 插件）

在 DSH 左侧栏打开 **Convolvex-MS 质谱工作台**。插件直接复用 `Convolvex_MS_1.1.0/src/convolvex/web` 的原 Web 前端（HTML、CSS、`app.js`、`ms.js`、`dems.js`），由插件 Host 启动项目自带的 Python 服务，不另开端口给浏览器，也不需要访问令牌。

## 安装

npm 包：`dsh-convolvex-ms-workbench`（公开包）。在 DSH 中安装：

```bash
dsh plugin --profile desktop add dsh-convolvex-ms-workbench
```

安装后把插件行配置中的 `appRoot` 指向 Convolvex-MS 仓库检出目录；从本仓库内的
`dsh-integration` 目录运行时则无需配置。插件不会自动安装 Python 依赖。

## 工作区绑定

- 面板顶部的工作区选择器列出 DSH 已注册工作区。
- 每个工作区的数据独立保存在 `<workspace>/.convolvex-ms/`：
  - `jobs.sqlite3`：任务索引；
  - `<job-id>.input.json` / `.result.json`：项目输入与完整结果；
  - `last-project.json`：最近一次从面板提交的项目，便于恢复；
  - `nist-spectra/`：NIST 公开谱缓存。
- 切换工作区会重建面板并加载该工作区的任务记录；不同工作区互不共享任务。
- Python 服务按工作区懒启动，一个工作区一个进程；插件卸载时停止。

## Agent 集成

- 插件注册 `convolvex_workbench` 工具，与面板共享同一 `.convolvex-ms` 工作区：
  - `status`：工作区、服务能力、任务统计和最近记录；
  - `jobs`：任务列表；
  - `result`：某个任务的结果摘要；
  - `project`：面板最近提交的项目（省略大数组）。
- 面板的「复制 Agent 说明」把当前工作区路径和工具用法写入剪贴板，便于在对话里让 Agent 读取同一批结果。
- 数值分析仍复用 Convolvex 原有求解器与接口；插件不创建或验证标定记录。

## 复用方式

`build.mjs` 从 `web/` 读取原文件并生成 `client.js`：

- 原始 HTML 作为 Shadow DOM 内的静态标记；
- 原始 CSS 限定在 Shadow DOM 中，并补充 DSH 主题映射；
- 原始三段脚本合并为一个挂载函数，`/api/v1` 的 `fetch` 被重定向到 Host RPC；
- 面板外层的工作区栏由 React 渲染，跟随 DSH 明暗主题；工作台内部保留原浅色纸张画布，避免半暗色覆盖造成图表文字不可读。

重新生成：

```bash
node build.mjs
node --check client.js
```

## 配置

插件行支持可选配置：

| 键 | 说明 |
|---|---|
| `appRoot` | Convolvex-MS 源码目录；默认由插件目录上两级推导 |
| `python` | Python 可执行文件；默认 `<appRoot>/.venv/bin/python`（Windows 为 `.venv/Scripts/python.exe`） |

## 限制

- 需要 Convolvex 的 Python 依赖已安装（`fastapi`、`uvicorn`、`numpy`、`scipy` 等）；插件不安装依赖。
- 前端保持原 Web 工作台的中文界面；插件外层提示随 DSH 语言切换。
- 原有的 `mcp__convolvex-ms__*` MCP 工具仍使用其独立的 `runtime/ms-stdio` 工作区，与本面板不是同一个数据目录；要与面板共享记录，请使用本插件的 `convolvex_workbench` 工具。
- 浏览器可视化验证依赖 DSH 页面连接；无页面连接时只验证构建、Host RPC 与 Slot 注册。
