# Agent 启动入口

这是所有主 Agent / 子 Agent 下载本仓库后优先读取的入口文件。

目标：让 Agent 不需要先配置本机 runtime，也能直接理解并使用这套多 Agent 架构。

## 1. 默认启动流程

进入仓库后，先按顺序读取：

1. `AGENT_ENTRY.md`：当前入口；
2. `team-memory/PROTOCOL.md`：总协议；
3. 当前角色文件：
   - 主控：`agents/team-lead.md`
   - 产品：`agents/pm.md`
   - 前端：`agents/frontend.md`
   - 后端：`agents/backend.md`
   - QA：`agents/qa.md`
   - Runtime/DevOps：`agents/runtime.md`
4. 和任务相关的共享协议：
   - 文件结构：`team-memory/shared/contracts/file-placement-policy.md`
   - 机器证据：`team-memory/shared/contracts/agent-evidence-gate.md`
   - 质量门：`team-memory/shared/contracts/quality-gates.md`
   - QA 证据：`team-memory/shared/contracts/qa-evidence-protocol.md`
   - 技术栈无关架构：`team-memory/shared/contracts/technology-agnostic-agent-architecture.md`

## 2. 零配置可用范围

下面这些任务不需要 runtime 初始化：

- 需求分析；
- PRD 和验收标准；
- 架构设计；
- 前端/后端代码开发；
- 代码审查；
- 文档更新；
- 测试计划设计；
- 静态检查；
- 目录结构重构；
- 面试材料整理；
- 不启动本机服务的调研和方案设计。

这些任务只需要读取架构文件和角色规则即可开始。

## 3. 什么时候需要 runtime

只有任务涉及本机运行环境时才启用 runtime：

- 启动、停止、重启服务；
- 检查端口、PID、session；
- 真实数据库读写；
- 浏览器 UI 验收；
- 多 Agent 同时操作同一服务；
- 需要判断环境阻塞、工具阻塞或产品缺陷。

启用命令：

```powershell
node scripts/runtime-init.mjs --project my-project
node scripts/runtime-status.mjs
node scripts/runtime-health.mjs
```

如果当前任务不涉及这些，不要强制用户配置 runtime。

## 4. 主控 Agent 规则

主控 Agent 的职责：

- 拆解任务；
- 选择角色；
- 建立或复用 task contract；
- 指定 workspace/component/adapter；
- 控制 ownership；
- 执行机器证据 Gate；
- 判断 S1-S5 阶段是否推进；
- 汇总子 Agent 结果。

主控 Agent 不应默认某个项目技术栈，也不应把 React/Nest/Playwright/MySQL 写死为默认。

## 5. 子 Agent 规则

子 Agent 开工前必须确认：

- 当前角色；
- 任务范围；
- 允许/禁止路径；
- 文件结构策略；
- 适用 adapter；
- 必需检查命令；
- 是否允许写真实数据；
- 是否需要 runtime。

子 Agent 的自然语言报告不是事实源。交付必须附机器证据，例如：

- 实际文件路径；
- `git status --short`；
- `rg --files` 或目录快照；
- 测试/lint/typecheck/build 结果；
- QA 截图、网络、console、业务 ID 或证据 manifest。

## 6. 文件放置原则

不要把所有文件平铺在同一个目录。

按文件作用放置：

- app/bootstrap；
- features/modules；
- shared/common；
- infrastructure；
- config；
- tests；
- docs；
- artifacts。

具体目录名称由 project adapter 决定。

## 7. 迁移原则

可以跨电脑迁移：

- 角色规则；
- 协议文档；
- schema；
- adapter；
- workspace 示例；
- QA 模板。

每台电脑单独生成：

- runtime local 文件；
- PID/session；
- 端口状态；
- secret 引用；
- 浏览器/数据库本机配置。

一句话：先读架构文件就能工作；只有碰到本机运行环境，才启用 runtime。
