# API 与数据合同

服务根地址 `http://127.0.0.1:8765`。API `/api/v1`。已设置令牌时每个 API 请求需要 `Authorization: Bearer TOKEN`。默认本地单用户。

| 方法 | 路径 | 行为 |
|---|---|---|
| GET | /health | 软件版本与存活 |
| GET | /capabilities | C++ / CUDA 可用性和服务限额 |
| GET | /demo/{kind}?seed=7 | 具有真值的合成实验，kind=signal/image/volume/dems/baseline/poisson |
| POST | /jobs | 提交 Problem JSON，202 返回 id |
| GET | /jobs | 最近100项任务 |
| GET | /jobs/{id} | queued/running/completed/failed/cancelled/interrupted 与进度 |
| POST | /jobs/{id}/cancel | 协作式取消 |
| GET | /jobs/{id}/input | 原始有效请求 |
| GET | /jobs/{id}/result | 完成后的结果，未完成返回409 |
| GET | /benchmarks | 随版本发布的实测基准，并非当前访问机器的测量 |

Problem 顶层字段：schema_version、task、operator、observed、source、method、parameters、weights、baseline、basis、metadata。未知顶层字段拒绝。任务支持 forward / inverse / kernel / blind / gcv / bootstrap。observed 与source可为1D/2D/3D数组。

算子 kind 支持 convolution / matrix / mixing / spectrotemporal / nonuniform / identity。各参数与 Python 类一致，详见示例。复杂稀疏复合算子在 Python 中构造；REST 不接受 pickle、可执行函数或任意 Python 字符串。

参数按求解器调用签名解释，未知参数导致任务 failed 并返回错误，不会静默丢弃。basis 为 `(观测元素数, 背景基函数数)`。权重可广播为观测形状；观测与模型必须遵循相同 flatten 顺序（C order）。metadata 仅作追溯，不自动修正单位。

限制：请求32 MB、主要数据最多1e6元素、卷积填充最多4e6元素、核最多1e5元素、非均匀矩阵最多2e6元素、背景基最多128列；最大迭代5000，队列最多8，工作线程2。GCV≤256未知数（同时受显式矩阵限额）；大数组可通过 Python API 使用，但依然受机器内存约束。

自动可辨识性 SVD 限≤100未知数；更大问题记录“未评估”和算子范数上界。不能据此宣称大问题满秩。取消为数值步骤间检查，不会中断正在执行的单次 BLAS/FFT 调用。

重启恢复：保留输入、结果与 SQLite 状态；queued/running 转为 interrupted，需要显式重新提交。任务是一次不可变计算，修改参数后生成新的 id。输入散列不包括运行机器信息，但结果另存 Python/NumPy/SciPy 版本。
