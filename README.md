# Convolvex-MS

面向质谱 / DEMS 的可审计数值后端，提供 Python API、MCP stdio/HTTP 和兼容 Web 工作台。MIT 许可。

此仓库保留两个版本：`v1.1.0` 是用户提供的原始源码快照；`v1.1.0-deploy.1` 是在 macOS、WSL2 与原生 Windows 部署、调试后的修复版。数值包版本保持 **1.1.0**，`deploy.1` 表示部署修订。Release 提供通用源码包及三个平台的源码部署包；运行仍需安装对应 Python 依赖。

## 已完成的本地验证

| 平台 | Python | 实测回归 | 能力 |
|---|---|---|---|
| macOS ARM64 / Apple M5 | 3.13.13 | 151 passed，1 skipped | CPU FFT、C++；网页 DEMS 操作通过 |
| WSL2 x86_64 / i7-12700H | 3.12.3 | 153 passed，0 skipped | CPU FFT、C++、RTX 3070 Ti CUDA 一致性 |
| Windows 11 x86_64 | 3.13.5 | 147 passed，6 skipped | CPU FFT、官方 MCP SDK、stdio 与 HTTP |

macOS 与跨平台测试记录包含不同阶段的用例数量。Windows 的 6 个跳过项为 4 个缺少原生 DLL 的测试、1 个未安装 CuPy 的 GPU 测试，以及 1 个账户无符号链接创建权限的测试。原始记录见 [reports](reports/)，方法与边界见 [实测报告](docs/DEPLOYMENT_RESULTS.md)。

三端合成联合反演 RMSE 均约 **0.010632**，质量线形恢复 RMSE 约 **0.003221**。WSL GPU 小负载计时在现有 GRASPA 任务约占用 97% GPU 时执行；65536 点 / 257 核点的卷积含传输约加速 1.18×，4096 点短信号则较慢。MS 联合反演和背景消元仍使用 CPU。合成数据测试不代表真实实验定量精度。

## 安装和使用

macOS / Linux CPU（Python 3.12 或 3.13；原生构建需 C++17 编译器）：

```bash
python3 -m venv .venv
.venv/bin/python scripts/build_native.py
.venv/bin/python -m pip install -c requirements-tested.txt '.[test]' 'mcp==1.26.0'
.venv/bin/python scripts/local_services.py start
```

WSL CUDA：先选择项目本机端口，再安装。该方式只安装项目虚拟环境的用户态 CUDA 库，不替换驱动。

```bash
mkdir -p runtime
printf '{"web":8865,"mcp":8866}\n' > runtime/ports.json
bash scripts/deploy_wsl.sh --cuda
```

Windows 原生（PowerShell）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy_windows.ps1
```

脚本将 Python/uv 与依赖放在项目目录中。受限网络的官方安装包中转方法见 [部署指南](docs/DEPLOYMENT.md)。后续双击 `start_windows.cmd` / `stop_windows.cmd`。Windows 尚未部署 C++ DLL 或 CuPy；有 MinGW 编译器时可自行构建 DLL。

| 配置 | Web | MCP HTTP |
|---|---|---|
| macOS / 通用 Unix 默认 | `http://127.0.0.1:8765` | `http://127.0.0.1:8766/mcp` |
| WSL CUDA 部署包 | `http://127.0.0.1:8865` | `http://127.0.0.1:8866/mcp` |
| Windows 原生默认 | `http://127.0.0.1:8875` | `http://127.0.0.1:8876/mcp` |

服务只绑定本机回环地址；HTTP MCP 使用 `runtime/mcp-token.txt` 中生成的令牌。stdio MCP 用法及协议说明见 [原版技术说明](README_UPSTREAM.md)。Web 为兼容工作台，MS 1.1.0 专用功能通过 MCP 调用。源码仓库不包含运行令牌、用户工作区、个人绝对路径配置或预装虚拟环境。

## 复现

```bash
# 当前环境的回归、CPU 基准、合成精度、MCP/HTTP 分析：依次执行
.venv/bin/python scripts/validate_deployment.py --output-dir validation_local
# WSL 上的小负载 GPU 卷积（保留并发负载快照）
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 .venv/bin/python benchmarks/gpu_small_benchmark.py --output validation_local/gpu_small_benchmark.json
```

[修复清单](docs/DEPLOYMENT.md) · [详细成绩](docs/DEPLOYMENT_RESULTS.md) · [版本记录](CHANGELOG.md) · [标定合同](docs/CALIBRATION.md)。`benchmarks/ms_results.json` 和 LaTeX 报告保留原包 Linux 参考记录，未改为本次跨平台成绩。GitHub Actions 验证另有运行记录，不把本地通过等同于 CI 已通过。
