---
name: qa-evidence-protocol
description: QA 验收运行、证据链、结果分类与可追溯性的共享契约。
type: reference
---

# QA 证据协议

## 1. 适用范围

所有 S4 集成验证、UI/E2E、接口验收和真实数据库验收必须遵守本协议。测试结论必须能从 `runId` 追溯到环境、用例、业务数据和原始证据。

## 2. 运行标识

- `runId` 格式：`QA-<project>-<yyyymmdd>-<HHmmss>-<short-id>`，例如 `QA-procureflow-20260810-143012-a7c9`。
- 同一次恢复执行沿用原 `runId`，新增 `attempt`（从 1 递增），不得创建新 run 冒充完整重跑。
- 报告、缺陷、截图、网络日志和测试数据清单都必须包含 `runId`。
- 推荐证据根目录：`team-workspaces/qa/evidence/<runId>/`；大型二进制证据可放外部临时目录，但报告必须记录绝对路径、保留期限和摘要。

## 3. 最小运行清单

每次运行至少记录：

| 字段 | 要求 |
|------|------|
| `runId` / `attempt` | 唯一运行标识与恢复次数 |
| `scope` | 需求、版本、用例范围及明确排除项 |
| `environmentFingerprint` | 前后端版本或提交、部署时间、数据库实例标识、浏览器与视口；禁止记录密钥 |
| `authorization` | 是否获准写入真实数据库、授权来源与时间 |
| `serviceOwnership` | 服务端口、启动者/会话、是否允许重启 |
| `caseResults` | caseId、角色、结果、证据引用 |
| `businessAnchors` | 测试数据标题、业务 ID/编号、最终状态、保留策略 |
| `defects` | 缺陷 ID、严重度、状态和证据引用 |
| `consoleNetworkSummary` | console error/warning、失败请求和关键响应摘要 |
| `gateDecision` | PASS / CONDITIONAL PASS / FAIL / BLOCKED 及理由 |

## 4. 证据链

证据引用格式为 `<runId>/<caseId>/<artifact>`。每个判定至少包含：

1. 用例依据：PRD 验收标准或共享契约路径。
2. 操作证据：关键步骤、账号角色、URL/路由和时间。
3. 结果证据：DOM/响应/截图/日志中的可观察结果。
4. 数据证据：通过 UI 产生的业务 ID/编号及最终状态；不得用直接 API/SQL 代替要求中的 UI 操作。
5. 关联结论：PASS、FAIL、BLOCKED 或 NOT_RUN。

截图不能单独证明数据库状态；数据库查询不能单独证明 UI 可操作。需要跨层结论时应同时保留 UI、网络和业务锚点。

## 5. 结果分类

- `PASS`：实际结果符合验收依据，证据完整。
- `FAIL_PRODUCT`：产品可执行，但行为不符合需求/契约；必须登记缺陷并参与质量 gate。
- `BLOCKED_TOOL`：浏览器绑定、驱动、依赖、沙箱或证据工具失败，尚不能判断产品质量。
- `BLOCKED_ENV`：服务、部署、数据库、种子数据或环境配置不可用。
- `EXPECTED_DENIAL`：权限或业务规则按设计拒绝，错误清晰且数据不丢；属于通过结果。
- `NOT_RUN`：未执行，必须说明原因和风险。

工具或环境阻塞不得登记为产品缺陷，也不得被写成 PASS。产品失败不得因工具重试成功而自动关闭，必须在修复版本上回归。

## 6. 敏感信息与证据保留

- 禁止保存明文密码、访问令牌、Cookie、完整 Authorization 头或个人敏感数据。
- 网络日志和 Trace 入库前必须脱敏；无法安全脱敏时只保存字段摘要和哈希。
- 真实数据库测试数据默认保留，清理必须获得明确授权并记录清理范围。
- 报告保留轻量摘要；视频、Trace 等大文件应配置保留期限，避免仓库膨胀。

## 7. 完成条件

运行只有在用例结果、缺陷台账、业务锚点、阻塞项和 gate 决策全部落盘后才算完成。证据缺失时最高只能给出 `CONDITIONAL PASS`；关键路径证据缺失时为 `BLOCKED`。
## 8. Machine Evidence for Agent Deliverables

QA 或任何验收型子 Agent 的 final answer 不能单独作为 gate 依据。报告必须附带机器可复核证据：

- `git status --short` 或等价 VCS 快照。
- `rg --files` / 目录树快照，覆盖本次声明新增、移动、删除的关键路径。
- 每条验证命令、退出码和摘要结果。
- UI/数据库验收需要同时记录 UI 操作证据、业务数据锚点和最终状态。

主 Agent 在 S4/S5 必须把结果标为：

- `CLAIMED_DONE_UNVERIFIED`
- `EVIDENCE_MISMATCH`
- `VERIFIED_DONE`
- `STALE_REPORT`

只有 `VERIFIED_DONE` 可以进入下一阶段。`EVIDENCE_MISMATCH` / `STALE_REPORT` 是 P1 流程缺陷，应登记到 defect/incident ledger，分类为 `PROCESS`，不计作产品缺陷。
