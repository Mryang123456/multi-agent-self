# 多 Agent 协作架构 · 下载即用版

这是一套可迁移的多 Agent 研发协作架构。默认用法不是先配置端口、数据库或 runtime，而是：

```text
下载仓库 → 让 Agent 读取 AGENT_ENTRY.md → 按角色规则和协议开始工作
```

只有当任务涉及本机服务、数据库、浏览器验收、端口争用或运行环境所有权时，才需要启用 `runtime/` 目录里的高级能力。

## 最快使用方式

```powershell
git clone https://github.com/Mryang123456/multi-agent-claude-code.git
cd multi-agent-claude-code
```

然后在 Claude、Codex 或其他开发 Agent 工具里告诉 Agent：

```text
请先读取 AGENT_ENTRY.md，然后按这套多 Agent 架构协作。
```

如果你的工具支持自定义 Agent / subagent，把 `agents/` 目录里的角色文件导入或复制到对应配置位置即可。

## 架构分层

```text
多 Agent 架构
├── 启动入口：AGENT_ENTRY.md / QUICKSTART.md
├── 角色层：team-lead / pm / frontend / backend / qa / runtime
├── 协议层：task / gate / ownership / evidence / file placement
├── 适配层：project adapter / workspace
├── 可选运行时层：service registry / lease / health check
└── 项目层：具体前端、后端、数据库、测试代码
```

## 仓库结构

```text
├── AGENT_ENTRY.md                  # Agent 下载后首先读取的入口文件
├── QUICKSTART.md                   # 人类用户快速使用说明
├── PORTABLE.md                     # 迁移与可移植说明
├── agents/                         # 主控、PM、前端、后端、QA、Runtime Agent 规则
├── runtime/                        # 可选：本机服务注册表、租约和健康检查
├── scripts/                        # 可选：runtime 初始化、状态检查、健康检查脚本
├── skills/                         # 前后端检查与项目维护 skill
├── team-memory/                    # 分角色记忆、共享协议、任务/Gate/适配器/工作区契约
└── team-workspaces/                # 角色工作区与报告模板
```

## 下载后哪些东西立刻能用

不需要任何初始化就能用：

- `AGENT_ENTRY.md`
- `agents/*.md`
- `team-memory/PROTOCOL.md`
- `team-memory/shared/contracts/*.md`
- `team-memory/shared/tasks/*.json`
- `team-memory/shared/gates/*.json`
- `team-memory/shared/adapters/*.json`
- `team-memory/shared/workspaces/*.json`
- `team-workspaces/qa/templates/*.md`

需要本机环境时才用：

- `runtime/services.local.json`
- `scripts/runtime-init.mjs`
- `scripts/runtime-status.mjs`
- `scripts/runtime-health.mjs`

## Agent 默认启动规则

任何 Agent 进入这个仓库后，优先读取：

1. `AGENT_ENTRY.md`
2. `team-memory/PROTOCOL.md`
3. 当前角色文件，例如 `agents/team-lead.md`、`agents/frontend.md`
4. 与任务有关的共享协议，例如文件结构门、机器证据 Gate、QA 证据协议

如果当前任务只是写代码、审查代码、写文档、设计方案或调研，不需要 runtime 初始化。

## 什么时候需要 runtime

只有遇到这些场景才启用：

- 需要启动/停止/重启本机服务；
- 需要真实数据库或浏览器验收；
- 多 Agent 可能争用同一个端口、进程、浏览器或数据库；
- 需要记录服务 owner、session、PID、健康检查；
- 需要区分 `BLOCKED_ENV`、`BLOCKED_TOOL` 和产品缺陷。

启用方式：

```powershell
node scripts/runtime-init.mjs --project my-project
node scripts/runtime-status.mjs
node scripts/runtime-health.mjs
```

`runtime/services.local.json` 是本机私有文件，已被 Git 忽略。

## 核心规则

1. 主控 Agent 不默认某个技术栈。任务必须声明 workspace、component、adapter、QA 策略和文件结构策略。
2. 子 Agent 不得把代码全部平铺在一个目录，必须按 adapter 和文件作用放入对应文件夹。
3. 自然语言报告只算 `CLAIMED_DONE_UNVERIFIED`，必须由机器证据 Gate 核验后才能变成 `VERIFIED_DONE`。
4. 真实数据库写入必须有明确授权；默认保留测试数据，清理必须单独授权并精确枚举目标。
5. runtime 是高级能力，不是入门前置条件。

## 详细文档

- [Agent 启动入口](AGENT_ENTRY.md)
- [快速开始](QUICKSTART.md)
- [可移植安装与迁移指南](PORTABLE.md)
- [运行环境说明](runtime/README.md)
- [技术栈无关架构](team-memory/shared/contracts/technology-agnostic-agent-architecture.md)
- [文件放置策略](team-memory/shared/contracts/file-placement-policy.md)
- [机器证据 Gate](team-memory/shared/contracts/agent-evidence-gate.md)
- [质量 Gate](team-memory/shared/contracts/quality-gates.md)
- [QA 证据协议](team-memory/shared/contracts/qa-evidence-protocol.md)
