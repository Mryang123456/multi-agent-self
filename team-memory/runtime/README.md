# 运行环境状态说明

这里保存可变的调度状态，不保存长期知识或最终决策。

- `runtime-state.schema.json`：流水线、Agent、阻塞状态的快照格式；
- `example.runtime.json`：示例快照；
- `event.schema.json`：追加式事件格式。真实运行时建议写入 `events.jsonl`，由单一协调者生成快照，避免多个 Agent 覆盖同一个 JSON。

`WORKING.md` 可作为人类可读视图，但运行状态以符合 schema 的快照和事件为准。

禁止把 token、密码、完整数据库 URL 或其他 secret 写入 runtime 状态。
