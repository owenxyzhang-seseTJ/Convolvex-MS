# athena-wsl 与 Windows 原生部署及实测

2026-11-14，Asia/Shanghai。目标为同一台 i7-12700H / RTX 3070 Ti Laptop 8 GB 电脑。两套部署完成，服务均保持运行；MCP 官方 SDK、stdio 参考工作流和实际 HTTP 分析均已通过。

| 环境 | 安装目录 | Python | 测试结果 | 运行能力 |
|---|---|---|---|---|
| WSL2 | `/home/xiaoyu/apps/convolvex-ms-1.1.0` | 3.12.3 | **153 passed，0 skipped** | CPU FFT、Linux C++、CUDA 数值一致性 |
| Windows 11 原生 | `C:\Users\owenz\apps\convolvex-ms-1.1.0` | 3.13.5 | **147 passed，6 skipped** | CPU FFT、原生 Python/MCP/HTTP |

Windows 跳过项是 4 个未编译 C++ DLL 用例、1 个未安装 CuPy 的 GPU 用例，以及 1 个普通账户无法创建符号链接的用例（WinError 1314）。其余路径限制、CSV 导入约束和认证测试仍实际执行；未修改 Windows 开发者模式或申请管理员权限。

## 使用入口

当前 Mac 已建立到 WSL 的本地 SSH 转发，可打开 [WSL 工作台](http://127.0.0.1:18865)。该转发依赖 Mac 与目标电脑在线。停止转发可用 `ssh -S /private/tmp/convolvex-athena-01a1d886.sock -O exit athena-wsl`，不影响远端服务。

| 访问位置 | Web 工作台 | MCP HTTP |
|---|---|---|
| 目标电脑 WSL 环境 | `http://127.0.0.1:8865` | `http://127.0.0.1:8866/mcp` |
| 目标电脑 Windows 原生 | `http://127.0.0.1:8875` | `http://127.0.0.1:8876/mcp` |
| 当前 Mac 的 WSL SSH 转发 | `http://127.0.0.1:18865` | `http://127.0.0.1:18866/mcp` |

MCP URL 是协议端点；HTTP 令牌各自位于项目 `runtime/mcp-token.txt`，未写入报告。stdio 宿主配置各自位于 `mcp-client.local.json`，使用独立工作区。未修改全局 Codex/MCP 配置。Web 是原有兼容工作台，MS 1.1.0 工具通过 MCP 调用；Web 基准页仍显示原包历史参考成绩。

WSL 的原默认端口 8765 已被其他程序占用，因此通过 `runtime/ports.json` 将新服务配置为 8865/8866。已有程序和计算保持运行。

## 必要修复与环境准备

- 延用 Mac 阶段已修复的版本号及非 ASCII 认证头处理。
- 启动器增加 Windows `.venv\Scripts\python.exe`、Windows 原生进程归属检查与后台启动，使用不同端口避免 WSL/Windows 冲突。
- 将符号链接测试从普通文件导入测试中分离；Windows 无创建权限时只跳过该独立用例。
- Windows 初次访问 GitHub 下载失败，通过 Mac 中转官方 python.org CPython 3.13.5 安装程序与 PyPI uv。Python 安装到项目 `.tools/python`，没有更改全局 PATH、文件关联或安装系统启动器。依赖安装进项目 `.venv`。
- WSL 驱动识别到 CUDA 13.0，但该项目环境缺少 CuPy 运行时库。项目 `.venv` 中安装 CuPy 14.2.0 与 CUDA 12.9 runtime/NVRTC/cuFFT/nvJitLink/cuBLAS。初次 GPU FISTA 因缺少 libcublasLt 失败，补装后完整回归全部通过。未修改 NVIDIA 驱动或现有计算环境。
- WSL 通过完整数值评测后才发现端口冲突；仅补跑受端口配置影响的服务链，保留已经通过的测试、精度与 CPU 计时。原始失败记录也已保留。

## CPU 实测

以下是各平台 float64、单线程上限设置下的暖调用中位数，单位 ms；每个加速倍数比较该平台逐组分/稠密对照实现与优化实现。普通算子预热 2 次、测量 9 次；固定 FISTA 预热 1 次、测量 3 次。

| 任务 | WSL 优化 ms | WSL 对照/优化 | Windows 优化 ms | Windows 对照/优化 |
|---|---:|---:|---:|---:|
| 谱—时间前向 24×12×8192 / 257 核点 | 1.1671 | 1.59× | 2.0333 | 0.94× |
| 背景投影 24 通道×2048 点 | 0.1253 | 9.19× | 0.1508 | 9.06× |
| 固定 100 次 FISTA | 79.7605 | 1.78× | 81.8987 | 1.64× |

Windows 该前向案例加速为 0.94×，即本次略慢；不隐去该结果。100 次 FISTA 使用固定迭代预算和 `tol=1e-30`，两者均未达到该阈值，因此不能称为收敛时间加速。

同一电脑的两个环境顺序运行评测，但 Python、BLAS、操作系统和运行负载不同，结果是本次环境测量，不能只归因为操作系统差异。CPU 前向/伴随/投影/迭代与直接卷积对照的最大绝对差：WSL 1.03e-15，Windows 5.28e-16。

## WSL CUDA 小负载实测

用户授权在两个 GRASPA 任务仍运行时测试。开始和结束的 NVIDIA-SMI 利用率均约 **97%**，温度 74–75°C；未暂停其他任务。因此下表不是空闲 GPU 峰值性能。

| 信号点 / 核点 | CPU FFT ms | GPU 驻留 ms | GPU 含 H2D+D2H ms | 含传输加速 |
|---|---:|---:|---:|---:|
| 4096 / 31 | 0.0548 | 0.4107 | 0.4256 | 0.13× |
| 65536 / 257 | 0.8310 | 0.4670 | 0.7024 | 1.18× |

全部计时都同步 CUDA stream。驻留时间不含输入/输出传输；含传输时间显式包含两者。最大测试信号仅 0.5 MiB，CuPy 内存池占用约 4.92 MiB。GPU 前向/伴随与 CPU 最大绝对差不超过 1.00e-15。4096 点时 GPU 较慢；65536 点时含传输约加速 1.18×。

项目 GPU 模块支持零延拓/循环 `Convolution` 与 identity L2 的 GPU FISTA；核心 MS `BatchedSpectroTemporal`、背景消元及 MCP 联合反演仍执行 CPU 路径。此处的 GPU 加速不能推为整个质谱流程的加速。GPU FISTA 已通过原项目 CPU/GPU 一致性测试，没有做其端到端速度比较。

## 合成恢复与实际服务

| 项目 | WSL | Windows |
|---|---:|---:|
| 联合反演 RMSE | 0.0106320576 | 0.0106320576 |
| 五个新噪声种子平均 RMSE | 0.0098206874 | 0.0098206874 |
| 五个新噪声种子样本标准差 | 0.0004451486 | 0.0004451486 |
| 所有 9 个联合反演案例 | 均收敛 | 均收敛 |
| HTTP 联合反演及质量线形 | 均收敛 | 均收敛 |
| stdio agent | 3 组参数 / 16 步 / 均收敛 | 3 组参数 / 16 步 / 均收敛 |
| 官方 MCP SDK 1.26.0 | 通过 | 通过 |

两端质量线形恢复 RMSE 均为 0.0032210896，联合反演 HTTP 全数组读回结果与直接计算一致。缺少认证及非 ASCII 认证头均返回 401。所有精度用例来自合成真值，未执行真实实验定量或 FE；参考 agent 没有调用 LLM。远端验证通过 HTTP/协议客户端完成，没有对这两套远端页面额外作浏览器视觉检查。

## 启动、停止与复现

WSL：

```bash
cd /home/xiaoyu/apps/convolvex-ms-1.1.0
./启动本地服务.sh
./停止本地服务.sh
.venv/bin/python scripts/local_services.py status
# 单独复现 GPU 小负载测试
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 .venv/bin/python benchmarks/gpu_small_benchmark.py --output validation_wsl/gpu_small_benchmark.json
```

Windows 原生：双击项目目录里的 `start_windows.cmd` / `stop_windows.cmd`。PowerShell 也可执行：

```powershell
Set-Location 'C:\Users\owenz\apps\convolvex-ms-1.1.0'
& '.\.venv\Scripts\python.exe' 'scripts\local_services.py' status
& '.\.venv\Scripts\python.exe' 'scripts\validate_deployment.py' --output-dir validation_windows
```

服务日志在两端项目 `runtime/web.log` 与 `runtime/mcp.log`；数据分别在各自 `runtime/web-data`、`runtime/ms-http`。均只绑定本机回环地址；没有作为系统/登录启动项安装。重启电脑后可使用上述入口启动。

当前 Mac 的交付证据在本报告同目录 `results/wsl/`、`results/windows/`；远端原始证据分别位于项目 `validation_wsl/` 与 `validation_windows/`。关键文件为 `pytest.xml/txt`、`deployment_result.json`、`ms_benchmark.json`、`accuracy.json`、`http_end_to_end.json`、`agent_trace.json`，GPU 文件为 `gpu_small_benchmark.json/txt`。代码差异在 `source_changes.patch`。仅保留并运行程序内置的一致性机制，没有额外执行交付文件 SHA-256 验证。
