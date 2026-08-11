# QA 缺陷台账

- runId：
- 项目/版本：
- 最后更新：

> P0/P1 为缺陷严重度，不是需求优先级。工具与环境阻塞单独登记，不计作产品缺陷。

| defectId | caseId | 分类 | 严重度 | 状态 | 标题 | 角色/环境 | 复现步骤 | 预期 | 实际 | 证据引用 | 修复版本 | 回归结果 |
|----------|--------|------|--------|------|------|-----------|----------|------|------|----------|----------|----------|

分类：`PRODUCT` / `TOOL_BLOCKER` / `ENV_BLOCKER`。
状态：`Open` / `Fixed Pending Retest` / `Verified Closed` / `Reopened` / `Accepted Risk`。

## 分级或降级记录

| defectId | 原级别 | 新级别 | 依据 | 批准人 | 时间 |
|----------|--------|--------|------|--------|------|
## 流程缺陷登记

流程类问题也必须登记，但不要混入产品缺陷统计：

- 分类新增：`PROCESS`
- 适用场景：`CLAIMED_DONE_UNVERIFIED` 超时未补证、`EVIDENCE_MISMATCH`、`STALE_REPORT`、子 Agent 连续超时无状态快照。
- 严重度：默认 P1，因为它会导致主 Agent 误判 gate、错误推进阶段或向用户报告不真实进度。

流程缺陷示例：

| defectId | caseId | 分类 | 严重度 | 状态 | 标题 | 角色/环境 | 复现步骤 | 预期 | 实际 | 证据引用 | 修复版本 | 回归结果 |
|----------|--------|------|--------|------|------|-----------|----------|------|------|----------|----------|----------|
| PROC-20260810-frontend-structure-claim | frontend_structure_refactor | PROCESS | P1 | Verified Closed | frontend 子 Agent 第一轮报告结构化完成但磁盘无对应文件移动 | frontend/team-lead | 子 Agent final answer 声称完成；主 Agent 执行 git status 与 rg --files 核验 | 声明、文件结构、验证命令一致后才进入下一阶段 | git status/rg 显示仍为旧结构或无实际变更 | git status --short; rg --files src/app src/features src/shared | architecture-v2.1 | 已重派 real agent，最终验证通过 |
