# 任务契约

任务契约是一份派单时的共享事实源。主 Agent 在派单前创建或更新契约，子 Agent 在开始工作前读取并核对。聊天消息只能补充上下文，不能覆盖契约。

- `task.schema.json`：任务契约 JSON Schema；
- `example.task.json`：最小可执行示例；
- 活跃任务建议命名为 `<task-id>.task.json`，结束后可随项目状态归档。

关键约束：

- `allowedPaths` 是写入白名单；
- `forbiddenPaths` 优先级更高；
- 超出范围、数据策略变化或提交策略变化，必须由主 Agent 更新契约后再继续。

## 机器证据门

子 Agent 的自然语言 final answer 只能算“声明”，不能直接算完成。每个 task contract 必须包含 `machineEvidence`，并在交付时提供：

- `git status --short`：证明实际工作区发生了哪些变化，或证明没有意外改动；
- `rg --files` / 目录快照：证明文件结构、关键产物路径与声明一致；
- 验证命令与退出码：例如 test、lint、typecheck、build、Playwright、数据库只读核查；
- 关键产物路径：报告、截图、日志、测试数据 ID、代码文件。

主 Agent 必须执行 Evidence Gate：逐条比对子 Agent 声明、磁盘文件、命令输出和 task contract。未核验不得进入下一阶段，也不得向用户报告“已完成”。

交付状态分类：

- `CLAIMED_DONE_UNVERIFIED`：子 Agent 声称完成，但主 Agent 尚未核验；
- `EVIDENCE_MISMATCH`：声明与磁盘或命令结果不一致；
- `VERIFIED_DONE`：声明、文件、验证命令和产物路径一致；
- `STALE_REPORT`：报告基于旧状态，当前工作区已经变化或无法复现。

`EVIDENCE_MISMATCH` 和 `STALE_REPORT` 是 P1 流程缺陷，必须进入 defect/incident ledger；它们不是产品业务缺陷。

## 文件放置 / 结构门

编码任务在创建、移动或大幅修改文件时，必须包含 `filePlacementPolicy`。该策略定义：

- `expectedStructure`：任务完成后应存在的目录；
- `forbiddenFlatPatterns`：不得继续扩大的平铺目录或根级文件模式；
- `allowedRootFiles`：框架要求保留在根目录的文件，例如 `package.json`、`vite.config.ts`、`tsconfig.json`、`main.ts`、`app.module.ts`；
- `structureGateCommands`：主 Agent 用来验证结构的命令，例如 `rg --files <target>`。

自然语言说“已经重构”不够。只有主 Agent 检查磁盘证据，并确认文件按职责或业务域放置后，结构门 才能通过。

详情见 `team-memory/shared/contracts/file-placement-policy.md`。
