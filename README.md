# Convolvex-MS 1.1.0

面向 **质谱 / DEMS** 的可审计数值后端与 MCP 服务。MIT 许可。以明确的前向算子、严格伴随、正则化和标定条件为基础；不依赖云服务或语言模型。附真实 MCP 子进程参考工作流和 LaTeX 技术报告。

本版的公开 MS 工作流不包含图像去模糊。**m/z × 时间矩阵是质谱数据，不是空间图像**；只沿时间正则化，不把任意质量通道或组分标签当作连续空间坐标。旧通用内核和界面资产保留用于调用兼容，本版不改写前端，也没有前端报告章节。

## 快速开始

Python 3.11+。本次测试 Python 3.13.5 / Linux x86_64。

```bash
python -m venv .venv
# Linux / macOS
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -e .

# 可选：编译 C++17 直接卷积，需要 g++ 或 clang++
python scripts/build_native.py

# 给 MCP 宿主启动；stdin/stdout 专用于协议
convolvex-mcp --workspace /absolute/path/ms-workspace
```

不编译 C++ 也可运行 CPU FFT。初次安装需要访问 Python 包索引，或已有兼容依赖的离线环境；不承诺一个 ZIP 自动提供所有系统依赖。

### 运行无需 LLM 的参考 agent

```bash
python scripts/prepare_ms_demo.py --workspace ./ms-workspace
convolvex-agent examples/mcp/workflow.json \
  --workspace ./ms-workspace --output ./agent_trace.json
```

参考客户端自己启动 MCP 子进程，**不要同时启动另一个服务占用相同工作区**。它运行三个事先规定的正则化分支，保存完整关键调用轨迹。所有演示数据明确标记为合成；脚本不创建实验标定。

### MCP 宿主配置

`examples/mcp/client-config.json` 是通用配置模板。将 Python 和工作区替换为绝对路径：

```json
{
  "mcpServers": {
    "convolvex-ms": {
      "command": "/absolute/path/.venv/bin/python",
      "args": ["-u", "-m", "convolvex.mcp_server", "--workspace", "/absolute/path/ms-workspace"]
    }
  }
}
```

不同宿主的配置入口可能不同。配置模板不是对某个第三方客户端的已完成兼容性认证。`skills/mass-spectrometry/SKILL.md` 是供宿主采用的工作说明，不会自动安装到 ChatGPT 或其它 agent。

### 本地 HTTP

```bash
export CONVOLVEX_MCP_TOKEN='replace-with-a-random-token-at-least-32-chars'
convolvex-mcp --workspace ./ms-http-workspace \
  --transport streamable-http --host 127.0.0.1 --port 8766
```

端点 `/mcp`，Bearer 令牌，JSON POST；HTTP 仅允许 loopback 绑定，检查 Host/Origin。现代版本请求还需匹配的 `MCP-Protocol-Version`、`Mcp-Method`、必要时 `Mcp-Name` 及请求体 `_meta`。不提供 GET SSE、不实现 OAuth，不是多用户公网服务。

## 实现的 MCP 范围

协议层是轻量直接实现，**不要求官方 MCP SDK**。

- `2026-07-28`：自包含请求元数据、`server/discover`、`resultType=complete`。
- `2025-11-25` / `2025-06-18`：旧版 initialize / initialized 兼容路径。
- tools、resources、prompts；stdio 与 JSON 响应的 Streamable HTTP。
- 应用任务队列不是 MCP Tasks 扩展。没有 sampling、elicitation、subscriptions 或多轮输入请求功能。

已通过实际本地子进程及 HTTP 测试客户端验证。官方 SDK 测试因未安装依赖跳过；未完成 Claude/Codex/ChatGPT 等第三方宿主的端到端测试，未宣称协议认证。

| 工具 | 用途 |
|---|---|
| `ms_capabilities` | 能力、单位、版本和资源限制 |
| `ms_import_dataset` / `ms_import_file` | 标准数组或 inbox 内 JSON/CSV 导入 |
| `ms_inspect` / `ms_check_response` | 时间/单位/掩码审计；秩与共线性 |
| `ms_background` | 指定空白窗口回归与带符号残差 |
| `ms_submit_analysis` | 谱混合或谱—时间反演 |
| `ms_submit_mass_profile` | 一维质量轴线形反卷积 |
| `ms_get_job` / `ms_get_result` / `ms_read_array` | 状态、紧凑诊断、按需数组切片 |
| `ms_list_jobs` / `ms_cancel_job` | 工作区任务列表与协作式取消 |
| `ms_integrate_charge` / `ms_quantify` | 原始 EC 电荷；有条件的绝对定量 |

资源：三个 schema、workflow、limitations；数据集/任务摘要模板；一个 `analyze_mass_spectrometry` 提示模板。输入 schema 可由 `tools/list` 或资源发现。

## 数学合同

联合模型：`Y = S [h_j * X_j] + B beta + noise`。

- 组分为行、时间为列；观测为 m/z 通道 × 时间。`S` 的每列对应显式候选，不自动鉴定分子。
- `spectral` 只恢复传输后的组分贡献；`spectrotemporal` 才以给定核尝试恢复源项。
- `discrete` 核按离散 FIR 使用；`density` 核显式乘时间间隔。没有静默归一化。
- FFT 路径要求均匀时间；非零通道扫描偏移会被拒绝。不会静默插值或对齐。
- Gaussian 目标为 `0.5 ||W(Ax+b-y)||² + l2/2 ||D x||² + l1 ||x||₁`；`W` 是逆标准差，掩码位置权重为零。
- 正则化只沿时间；差分按样点索引定义，不声称相同参数跨采样率等效。
- FISTA 支持 L1/L2、非负和 Huber；另有 Tikhonov、时间 TV 和分通道背景消元 PARS。平方损失下投影精确；PARS 不接受 Huber。
- `completed` 不等于 `converged`；原始负值和带符号残差保留。
- 质量轴恢复只支持均匀、局部平移不变、显式居中线形；不是多电荷反卷积或 MS/MS 分子鉴定。

## 本次优化

**批量谱—时间 FFT**：缓存各组分核，一次批量变换并进行谱矩阵乘法；严格伴随与逐组分参考一致。

**分通道背景消元**：薄 SVD 投影代替整体稠密块矩阵；主存储从 `O(M² N p)` 降为 `O(M N p)`。这是变量投影与 FISTA 的工程实现改进，不将既有理论宣称为首创。

**小量信号数值修复**：回溯舍入余量与驻点判据改为尺度相容形式。测试覆盖幅值 1、1e-6、1e-9、1e-12，避免固定绝对阈值对纳安级数据失去约束。

**agent 上下文控制**：不可变内容哈希、结果数组分离、紧凑诊断与最多 2048 值的按行切片。完整数组参与计算；预览不替代原数据。

## 定量门槛

`ms_quantify` 要求操作者在 `workspace/calibrations/<id>.json` 提供核验标定。**工具不能创建或核验标定**。检查收敛、谱共线性、A 单位、原始 EC 电流、仪器和实验条件、参考通道、响应/核指纹、单位核质量、包含收集效率的 C/mol 灵敏度、电子数和完整窗口声明。

无标定则不输出绝对产率或 FE。结果仍条件于所给模型与标定；总电荷可能包含电容贡献，FE>1 保留并警告。哈希不是签名，`verified_by` 不是身份认证系统。记录格式见 `docs/CALIBRATION.md`。

## 验证结果

本次编译 C++ 后的完整回归：**147 passed, 2 skipped**。两个跳过项为 GPU 和官方 MCP SDK。没有 GPU 加速数字，没有真实实验回收率和 LLM 推理评测。

CPU：AMD EPYC 9V74，float64，BLAS/OpenMP 单线程，预热 2 次、测量 9 次取中位数；暖调用不含核 FFT 初始化。完整原始样本和环境见 `benchmarks/ms_results.json`。

| 任务 | 对照 / 优化 | 加速 |
|---|---:|---:|
| 谱—时间前向，24 通道/12 组分/8192 点/257 核点 | 1.7497 / 0.8572 ms | 2.04× |
| 分通道背景投影 | 0.7846 / 0.1408 ms | 5.57× |
| 固定 100 次 FISTA | 122.7308 / 79.3912 ms | 1.55× |
| 一维长核直接法 / FFT | 13.6948 / 2.1130 ms | 6.48× |

固定 100 次实验两者都未满足极严收敛阈值，不能称为“收敛时间”加速。短核案例 FFT 没有优于直接法，C++ 也不在所有大小上最快。背景因子存储约减少 23.96 倍，这不是进程峰值内存测量。

合成谱—时间实验：源 RMSE 0.010632；忽略背景对照 0.125152。实际 MCP 参考流程完成 3 组参数，关键轨迹 16 步，未调用任何 LLM，未尝试无标定 FE。响应矩阵为构造值，不是 NIST。

## 复现实验和报告

```bash
python -m pip install -e '.[test,report]'
python scripts/build_native.py
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 pytest -q --junitxml=validation/pytest.xml
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python benchmarks/ms_benchmark.py
python scripts/ms_simulate.py --allow-font-fallback \
  --agent-workspace ./separate-simulation-workspace
python scripts/report_metrics.py
cd docs/latex
latexmk -xelatex -interaction=nonstopmode -halt-on-error main.tex
```

**图表默认字体为 Arial。** 本环境未安装 Arial，本次 PDF 预览实际使用 **Arimo**，收据见 `simulations/font_receipt.json`。严格默认不静默回退；去掉 `--allow-font-fallback` 时缺 Arial 会报错。在已合法安装 Arial 的机器上重绘，再编译即可使用真正 Arial。包内不含字体文件。

报告使用 XeLaTeX，含主文件、11 个章节/附录源文件、BibTeX、16 组 PDF/SVG/PNG 科学图与 2 个 TikZ 流程图。所用 CJK/正文系统字体及构建要求见 `docs/latex/README.md`。正文无前端章节，无图像去模糊/三维图像实验。

## 安全与限制

私有单进程工作区，inbox 路径限制、符号链接拒绝、严格有限 JSON、任务与磁盘配额；没有任意代码执行、外部 URL 抓取或删除工具。标准输出只含协议，日志走 stderr。本机令牌和配额不等于恶意用户强沙箱或多用户权限系统。不要无认证公开到网络。

本版不包含供应商二进制读取、自动 mzML 流程、多电荷蛋白反卷积、MS/MS 结构鉴定、通道异步重建、非线性饱和模型及完整实验不确定度预算。保留的通用数学能力不等于这些领域任务已验证。未经标准品/空白/重复实验，不得把软件测试通过解释为实验定量认证。
