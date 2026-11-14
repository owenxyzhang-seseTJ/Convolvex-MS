# 操作者标定记录

MCP 没有创建或批准标定的工具。记录必须来自操作者独立的标准实验和审查，保存在私有工作区 `calibrations/<record_id>.json`。这个目录不接收 agent 导入的数据。

以下仅为字段说明，不是可用于实验的标定，也没有可直接使用的“已批准”默认文件：

```json
{
  "record_id": "operator-chosen-record-id",
  "verified": false,
  "verified_by": "",
  "species": "operator-confirmed species label",
  "instrument_id": "matching-instrument-id",
  "conditions_id": "matching-conditions-id",
  "reference_mz": 2,
  "sensitivity_C_per_mol": null,
  "electrons": null,
  "includes_collection": false,
  "response_sha256": "sha256-of-the-full-response-matrix",
  "kernel_sha256": "sha256-of-kernel-and-convention",
  "synthetic": false,
  "valid_until": "2030-01-01T00:00:00+00:00"
}
```

`null`、未审核、缺审核者、未包含收集效率等会被拒绝。时间只是格式示例，不是建议有效期。有效灵敏度定义为：参考通道等效源信号 (A) / 电极生成通量 (mol/s)，单位 C/mol，已包含收集效率；不能使用未经换算的 A/Pa。

指纹由规范化 JSON 计算，与 `convolvex.massspec.digest` 完全相同：

```python
from convolvex.massspec import digest
response_sha256 = digest(response)
kernel_sha256 = digest({"kernel": kernels[species_index], "convention": kernel_convention})
```

摘要中输入/模型信息应当先由操作者核对，再建立对应记录。SHA-256 只检查一致性，不证明标定真实性，也不是身份数字签名。拥有文件系统写权限的人可以修改记录，需由部署方控制权限。

额外检查：响应参考系数为 1，核积分质量在当前接口允许的 1% 相对误差内接近 1；灵敏度为有限正数；电子数为正整数；合成数据不能使用实验记录，实验数据不能使用合成记录；有时区的有效期尚未过期；完整响应窗明确确认；有正的方向电荷分母；源项不含负值；数值求解收敛且谱响应诊断没有未分辨列。

即使全部通过，结果仍条件于所提供响应、传输、背景与标定。当前工具不传播核/标定系统不确定度，也不自动扣除电容电荷。FE 超过 1 不裁剪。
