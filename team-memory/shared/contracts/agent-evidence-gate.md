# Agent 机器证据门契约

日期：2026-08-10

本契约用于升级主 Agent / 子 Agent 协作架构。核心原则：子 Agent 的自然语言汇报只是“声明”，不是事实证据；是否完成必须以磁盘、命令、产物和运行状态等机器证据为准。

## 1. 暴露的问题

在 ProcureFlow 前端结构化重构中，第一轮子 Agent 汇报已经把仓库整理为：

```txt
src/app
src/features
src/shared
```

但主 Agent 使用以下命令核验后发现，磁盘仍然是旧的平铺结构：

```txt
git status --short
rg --files src
```

旧结构仍为：

```txt
src/pages
src/lib
src/components
```

分类：

- 类型：`PROCESS`
- 严重度：`P1`
- 结果：`EVIDENCE_MISMATCH`
- 产品影响：没有直接影响产品代码，但如果没有主 Agent 核验，可能导致误报完成、错误推进 Gate、后续返工。

## 2. 新的不变量

任何阶段都不能只凭子 Agent 的 final answer 推进。每个子 Agent 的交付初始状态都是：

```txt
CLAIMED_DONE_UNVERIFIED
```

只有主 Agent 完成 机器证据门 核验后，才能标记为：

```txt
VERIFIED_DONE
```

## 3. 子 Agent 最小交付包

所有实现、重构、QA、部署、文档任务，子 Agent 交付时必须提供：

1. 人类可读总结；
2. 修改文件或产物路径；
3. `git status --short`；
4. 目录快照，通常为 `rg --files <target>`；
5. 验证命令、退出码和关键输出摘要；
6. 未执行检查项的原因、风险和替代证据；
7. 是否写入数据、改变运行状态、提交 commit 或 push。

结构化重构任务必须提供目录快照；QA 任务必须提供 evidence manifest、截图或 trace 路径；部署任务必须提供 runtime owner、PID/session、health check 和 build fingerprint。

## 4. 主 Agent 机器证据门

主 Agent 在推进阶段或向用户报告“完成”之前，必须核验子 Agent 的声明。

最低核验命令：

```txt
git status --short
rg --files <target>
<required test/lint/typecheck/build/QA commands>
```

主 Agent 需要对比：

- 子 Agent 声明 vs 实际文件树；
- 声称修改的路径 vs `git status`；
- 声称执行的检查 vs 命令输出；
- 声称存在的产物 vs 磁盘上的真实文件；
- 声称的运行状态 vs 只读 health/status 探测。

只有证据一致时，才可以标记为 `VERIFIED_DONE`。

## 5. 交付状态

| 状态 | 含义 | Gate 影响 |
|---|---|---|
| `CLAIMED_DONE_UNVERIFIED` | 子 Agent 声称完成，但主 Agent 尚未核验机器证据。 | 不得推进 |
| `EVIDENCE_MISMATCH` | 声明与磁盘、git 状态、命令输出、产物或运行状态冲突。 | 阻断 Gate，登记流程事故 |
| `VERIFIED_DONE` | 声明、文件、命令、产物和运行证据一致。 | 可以推进 |
| `STALE_REPORT` | 报告基于旧目录、旧 commit、旧服务状态，或当前无法复现。 | 阻断 Gate，要求刷新证据 |

## 6. 超时与心跳策略

对子 Agent 的长任务：

1. 主 Agent 只等待有限时间；
2. 超时后先要求状态快照，而不是继续追加工作；
3. 状态快照必须包含当前命令、已修改文件、阻塞点和下一步安全动作；
4. 如果子 Agent 连续不回应状态请求，主 Agent 可以 interrupt；
5. interrupt 后，主 Agent 必须先做只读磁盘/运行状态盘点，再决定续派、重派或兜底。

这样可以避免静默卡死、重复编辑和误判完成。

## 7. 事故台账规则

`EVIDENCE_MISMATCH` 和 `STALE_REPORT` 是流程缺陷，不是产品缺陷。它们必须登记到 incident ledger，记录：

- incident ID；
- task ID；
- agent 名称；
- 子 Agent 声明；
- 主 Agent 机器证据；
- 影响；
- 遏制动作；
- 协议更新；
- 恢复后的验证结果。

它们不计入产品 P0/P1 缺陷统计，但会阻断多 Agent 流水线。

## 8. 未来派单 Prompt 规则

主 Agent 派单时，必须显式要求 `machineEvidence`：

```txt
Return git status --short, rg --files for the touched tree, and command results.
Natural-language completion without machine evidence is CLAIMED_DONE_UNVERIFIED.
Do not submit final PASS unless the evidence is reproducible from disk.
```

## 9. 主 Agent 职责变化

主 Agent 不再只是消息路由器，也必须是团队的证据核验者。职责包括：

- 路由任务；
- 维护 ownership 和资源租约；
- 收集子 Agent 声明；
- 核验机器证据；
- 分类交付状态；
- 推进或阻断 Gate；
- 登记流程事故。

这不改变“主 Agent 负责编排、子 Agent 负责实施”的模型，但会防止假完成。
