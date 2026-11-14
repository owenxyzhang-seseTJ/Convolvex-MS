# 跨平台部署与版本

`v1.1.0` 保留原始源码，`v1.1.0-deploy.1` 保留跨平台部署修复。二者都来自同一 1.1.0 数值模型；部署修订没有修改反演算法或合成数据。

修复包括 REST health/capabilities/OpenAPI 与网页版本号一致、非 ASCII 认证头返回 401、Windows Python 路径与后台进程启动、Windows 进程归属检查、可配置 loopback 端口，以及独立的符号链接权限测试。基准脚本支持单独输出，避免覆盖原包参考成绩。

安装前选择 Python 3.12/3.13。macOS 采用普通安装，避免 Python 3.13 忽略被 macOS 标记隐藏的 editable `.pth`。修改源码后重新安装并停止/启动服务。需要 native 引擎时，在安装源码之前构建 C++ 库。

## Windows 受限网络

正常路径运行 `scripts/deploy_windows.ps1`，脚本使用官方 uv 下载 Python。实际验证使用 Python 3.13.5，脚本默认也设为此版本。

若 Windows 无法访问 GitHub，可在可联网机器从 PyPI 取得官方 uv Windows wheel，提取其中 `uv.exe` 到目标项目 `.tools/uv.exe`；从 python.org 官方目录取得 `https://www.python.org/ftp/python/3.13.5/python-3.13.5-amd64.exe` 并放入 `.tools/`，再运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare_windows_runtime.ps1
# 上一步只安装环境；此步骤执行完整验证并启动服务
& '.\.venv\Scripts\python.exe' scripts/validate_deployment.py --output-dir validation_windows
```

安装程序使用当前用户和项目 `.tools/python` 目录，不修改全局 PATH、不安装系统 launcher、不自动重启。仓库与 Release 不分发第三方 Python/CUDA 安装器。

## WSL CUDA

`bash scripts/deploy_wsl.sh --cuda` 在 `.venv` 中安装 CuPy 与 CUDA runtime/NVRTC/cuFFT/nvJitLink/cuBLAS；复用已有 NVIDIA 驱动。库不完整时应报告实际 GPU 测试失败，不能只凭识别到设备就宣称 CUDA 可用。此次 GPU FISTA 在补齐 cuBLAS 后通过一致性测试。

## 服务与工作区

通过项目 `runtime/ports.json` 选择本机端口，例如 `{"web":8865,"mcp":8866}`。`scripts/local_services.py start|status|stop` 管理本项目记录的进程。Windows 可双击 CMD 启停入口，macOS/WSL 可用相应 `.command`/`.sh`。没有安装登录或系统启动项。

HTTP 与 stdio 应使用各自独立的工作区。通用 stdio 配置模板在 `examples/mcp/client-config.json`，复制后替换为自己的 Python 和 workspace 绝对路径。项目运行令牌不进入 Git。

## 验证范围

本地原始测试、计时与合成恢复数据在 `reports/`。主机个人路径被替换为 PROJECT_ROOT/USER_HOME 占位符，数值数据保留。远端 WSL/Windows 使用真实网络客户端验证，未额外做远端浏览器视觉检查。macOS 的网页操作另有单独记录。
