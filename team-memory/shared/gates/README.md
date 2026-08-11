# 五阶段质量门

Gate 定义阶段准入、退出和阻断条件，不保存业务契约。

- `gate.schema.json`：Gate 定义 schema；
- `default-five-stage.gate.json`：通用 S1-S5 基线；
- 项目可以新增 `<project>.gate.json` 覆盖命令和证据要求，但不得静默放宽阻断项。

所有 Gate 定义必须符合 `gate.schema.json`。

Gate 结果必须包含可复核证据，例如命令、退出码、测试报告或产物路径，不能只写“已通过”。跳过阶段时必须记录 `skipped` 和理由。

当任务涉及文件创建、移动或结构化重构时，Gate 必须包含 Structure Gate，并引用 `team-memory/shared/contracts/file-placement-policy.md`。
