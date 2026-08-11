# 多 Agent 协作架构 · Multi-Agent Architecture

一套面向软件研发全流程的虚拟团队示例。仓库展示了角色化 Agent、Skill、工作区隔离、分层记忆、接口契约和决策追溯，并包含一个可运行的多租户登录 SaaS MVP。

## 仓库结构

```text
├── agents/                         # Team Lead、PM、前端、后端、QA 定义
├── skills/                         # 前后端审查、项目维护和 Skill 脚手架
├── team-memory/                    # 分角色记忆、共享契约与自动维护脚本
│   ├── PROTOCOL.md                 # 协作、记忆、隔离及通信协议
│   ├── update_indexes.py           # 索引同步、归档和导航刷新
│   ├── shared/contracts/           # 跨角色接口契约（单一事实源）
│   └── {pm,frontend,backend,qa,team-lead}/
├── team-workspaces/                # 各角色独立工作区说明
├── job-filler/                     # 实践项目：多租户登录 SaaS MVP
│   ├── api/                        # Node.js + Express + SQLite + TypeScript
│   └── web/                        # React + TypeScript + Vite
├── agent-knowledge-system.html     # Agent 知识与记忆系统说明
└── agent-research-report.html      # Agent 架构研究报告
```

> `job-filler` 是历史目录名；目录中的当前实践项目是 `saas-erp` 多租户登录 MVP，并不是招聘表单 Chrome 扩展。

## 核心设计

1. **角色分工**：Team Lead 编排，PM、Frontend、Backend、QA 分别负责各自专业产出。
2. **五阶段流程**：S1 需求澄清 → S2 契约定义 → S3 并行实现 → S4 集成验证 → S5 交付收口。
3. **工作区隔离**：角色文档产出分目录保存；同仓库并行改码时使用 Git worktree。
4. **双维度记忆**：时间生命周期（日记、进行中、长期沉淀）与检索深度（导航、索引、正文）正交组织。
5. **契约优先**：跨角色接口统一写入 `team-memory/shared/contracts/`，避免前后端维护不同副本。
6. **全程可追溯**：Team Lead 通过 `team-memory/team-lead/decisions.md` 记录阶段、路由、决策与风险。

## 实践项目状态

`job-filler/` 中的多租户登录 MVP 已完成本地实现和验证：

- 后端实现登录、登出、数据库 Session、鉴权、租户复核、限流和审计。
- 前端实现登录、会话恢复、登出，以及普通错误、限流和跨租户提示。
- 决策日志记录的 S4 结果为 55/55 测试通过，随后完成 12/12 快速回归，P0/P1 缺陷为零。
- 本地交付 gate 已通过；生产使用前仍需收紧 CORS，并确保新增业务端点统一执行鉴权和 `tenant_id` 行级过滤。

具体运行方式见 [`job-filler/README.md`](job-filler/README.md)。

## 使用协作架构

在 Claude Code 环境中使用时，可将 `agents/`、`skills/`、`team-memory/` 和 `team-workspaces/` 放入 `~/.claude/`，并按 `team-memory/PROTOCOL.md` 配置团队流程。不同 Agent 平台的配置格式和工具名称可能不同，需要按目标平台适配。

## 记忆索引维护

在 `team-memory/` 下运行：

```bash
python update_indexes.py --dry-run
python update_indexes.py
```

脚本会同步长期记忆索引、归档显式完成且满足条件的项目记忆，并刷新导航文件。建议先使用 `--dry-run` 检查计划。

## 忽略文件

仓库忽略依赖、环境变量、日志、SQLite 数据库、构建产物及运行时归档等本地文件。不要将密钥或连接凭据写入 Git 或团队记忆。
