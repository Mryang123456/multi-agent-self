# 事故复盘：子 Agent 声称重构完成，但磁盘证据不一致

Incident ID：`INC-20260810-agent-evidence-mismatch`

日期：2026-08-10

分类：

- 类别：`PROCESS`
- 严重度：`P1`
- 状态：`Closed`
- 交付结果：`EVIDENCE_MISMATCH`

## 摘要

在前端结构化重构任务中，子 Agent 汇报已经把代码整理为目标渐进式结构：

```txt
src/app
src/features
src/shared
```

主 Agent 随后执行机器核验：

```txt
git status --short
rg --files src
```

核验结果显示，并没有对应的文件移动，旧平铺结构仍然存在：

```txt
src/pages
src/lib
src/components
```

因此该报告不能被接受为完成。

## 影响

这次错误报告没有被提交或推送，没有直接影响产品代码。但如果没有机器证据核验，可能造成：

- 向用户误报进度；
- 跳过实际重构；
- 错误通过 Gate；
- 在发布或 QA 阶段产生返工。

## 遏制动作

主 Agent 执行了以下动作：

1. 将子 Agent final answer 分类为 `CLAIMED_DONE_UNVERIFIED`；
2. 运行 `git status --short` 和 `rg --files`；
3. 判定为 `EVIDENCE_MISMATCH`；
4. 重新派发更严格的 real agent，并要求 machine evidence；
5. 最终用测试、lint、typecheck、build、git status 和目录快照完成验证。

## 恢复结果

第二轮执行产生了真实磁盘变化并通过验证：

- 前端结构调整为 `src/app`、`src/features`、`src/shared`；
- 后端结构调整为 `src/common`、`src/config`、`src/infrastructure`、`src/modules`；
- 前端 test / lint / typecheck / build 通过；
- 后端 test / lint / typecheck / build 通过。

## 架构更新

本事故引入 Agent Evidence Gate：

- 子 Agent final answer 只是声明，不是证据；
- 每次交接必须包含 `machineEvidence`；
- 主 Agent 必须核验磁盘、git 状态、产物和命令结果；
- 只有 `VERIFIED_DONE` 可以推进 Gate；
- `EVIDENCE_MISMATCH` 和 `STALE_REPORT` 是 P1 流程缺陷。

相关文件：

- `team-memory/shared/contracts/agent-evidence-gate.md`
- `team-memory/shared/tasks/task.schema.json`
- `team-memory/PROTOCOL.md`
