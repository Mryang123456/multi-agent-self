# 多 Agent 协作架构 · Multi-Agent Operating Layer

这是一套可迁移的多 Agent 研发协作架构。它不绑定某一台电脑、某一个业务系统，也不绑定 React、Nest、Playwright、MySQL 等具体技术栈。

它的目标是：下载到任意电脑后，通过初始化本机 runtime 与 workspace，就能复用同一套主控 Agent、子 Agent、质量 Gate、证据协议、文件结构门和运行环境所有权规则。

## 架构分层

```text
多 Agent 架构
├── 角色层：team-lead / pm / frontend / backend / qa / runtime
├── 协议层：task / gate / ownership / evidence / file placement
├── 适配层：project adapter / workspace
├── 运行时层：service registry / lease / health check / runtime scripts
└── 项目层：具体前端、后端、数据库、测试代码
```

## 仓库结构

```text
├── agents/                         # 主控、PM、前端、后端、QA、Runtime Agent 规则
├── runtime/                        # 本机服务注册表 schema、示例、租约和日志目录
├── scripts/                        # 可移植初始化、状态检查、健康检查脚本
├── skills/                         # 前后端检查与项目维护 skill
├── team-memory/                    # 分角色记忆、共享协议、任务/Gate/适配器/工作区契约
│   ├── PROTOCOL.md                 # 总协议：记忆、派单、ownership、证据 Gate
│   ├── shared/
│   │   ├── adapters/               # 技术栈适配器
│   │   ├── contracts/              # 共享契约与质量协议
│   │   ├── gates/                  # S1-S5 Gate 定义
│   │   ├── ownership/              # 文件/资源租约定义
│   │   ├── tasks/                  # 任务契约 schema 与示例
│   │   └── workspaces/             # 工作区 schema 与示例
│   └── runtime/                    # Runtime Agent 记忆
└── team-workspaces/                # 角色工作区与报告模板
```

## 新电脑快速使用

克隆仓库后，在仓库根目录执行：

```powershell
node scripts/runtime-init.mjs --project my-project
node scripts/runtime-status.mjs
node scripts/runtime-health.mjs
```

第一条命令会生成本机私有文件：

- `runtime/services.local.json`

这个文件描述“这台电脑上实际有哪些服务、端口和健康检查”。它已被 `.gitignore` 忽略，不会上传 GitHub。

如果你要为某个具体项目配置工作区，可以复制：

```powershell
Copy-Item team-memory/shared/workspaces/example.workspace.json team-memory/shared/workspaces/my-project.workspace.json
```

然后修改里面的组件路径、技术栈、端口、QA 策略和 artifact 路径。

## 哪些文件可迁移

可以提交到 Git、跨电脑复用：

- `agents/*.md`
- `runtime/services.schema.json`
- `runtime/services.local.example.json`
- `team-memory/shared/**/*.schema.json`
- `team-memory/shared/**/example*.json`
- `team-memory/shared/contracts/*.md`
- `team-workspaces/qa/templates/*.md`
- `scripts/runtime-*.mjs`

每台电脑单独生成，不应提交：

- `runtime/services.local.json`
- `runtime/locks/*`
- `runtime/leases/*`
- `runtime/logs/*`
- 本机绝对路径、PID、sessionId、真实数据库密码、token、cookie、完整连接串

## 核心规则

1. 主控 Agent 不默认某个技术栈。任务必须带 `workspaceId`、`component`、`projectAdapter`、`qaStrategies` 和 `filePlacementPolicy`。
2. 子 Agent 不得把代码全部平铺在一个目录，必须按 adapter 和文件作用放入对应文件夹。
3. 自然语言报告只算 `CLAIMED_DONE_UNVERIFIED`，必须由机器证据 Gate 核验后才能变成 `VERIFIED_DONE`。
4. 真实数据库写入必须有明确授权；默认保留测试数据，清理必须单独授权并精确枚举目标。
5. 浏览器、数据库、端口、服务进程等有状态资源需要 runtime ownership/lease，避免多 Agent 互相抢环境。

## 详细文档

- [可移植安装与迁移指南](PORTABLE.md)
- [运行环境说明](runtime/README.md)
- [技术栈无关架构](team-memory/shared/contracts/technology-agnostic-agent-architecture.md)
- [文件放置策略](team-memory/shared/contracts/file-placement-policy.md)
- [机器证据 Gate](team-memory/shared/contracts/agent-evidence-gate.md)
- [质量 Gate](team-memory/shared/contracts/quality-gates.md)
- [QA 证据协议](team-memory/shared/contracts/qa-evidence-protocol.md)

## 维护命令

```powershell
node scripts/runtime-status.mjs --json
node scripts/runtime-health.mjs --json
```

`runtime-health` 只做只读探测，不会启动、停止、重启或修复服务。
