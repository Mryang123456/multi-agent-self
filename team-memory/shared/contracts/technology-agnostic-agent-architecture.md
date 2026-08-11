# 技术栈无关的多 Agent 架构

日期：2026-08-11

本架构的目标不是服务某一个固定系统，而是提供一层可迁移的 Multi-Agent Operating Layer。业务系统、技术栈、测试工具和运行环境都通过适配器接入；主 Agent 和子 Agent 的协作协议保持稳定。

## 1. 分层模型

```txt
Global Layer
  全局角色、通信协议、机器证据门、结构门、质量门、安全边界

Project Adapter Layer
  按技术栈注入目录规范、检查命令、构建方式、运行方式和测试策略

Workspace Runtime Layer
  每个客户/项目/工作区自己的仓库、运行状态、证据、记忆和任务注册表
```

## 2. 核心原则

- Agent 角色稳定，技术栈可插拔；
- 质量门不绑定工具，但必须理解项目技术栈；
- 文件放置规范不写死某个业务系统，而由技术栈适配器提供；
- QA 不绑定 Playwright，可根据系统类型选择 API、UI、性能、安全、可访问性、数据一致性等组合；
- registry、runtime、workdir、memory、artifact、QA evidence 必须按 workspace 隔离；
- 全局 schema、角色规范和通用 Gate 可以共享。

## 3. 全局层负责什么

全局层只保存跨项目稳定规则：

- Agent 角色边界；
- task contract；
- ownership / lease；
- machine evidence；
- file placement policy；
- quality gates；
- runtime owner 协议；
- incident ledger；
- secrets 不落盘规则。

全局层不得写死：

- 具体业务系统名称；
- 具体仓库路径；
- 具体端口；
- 具体数据库密码；
- 某个项目的唯一技术栈。

## 4. 项目适配层负责什么

Project Adapter 用于声明“这个项目怎么开发、怎么检查、怎么测试”。

适配器至少包含：

- 技术栈 ID，例如 `react-vite`、`vue-vite`、`nextjs`、`nest-prisma`、`spring-boot`；
- 推荐目录结构；
- 禁止平铺模式；
- 默认检查命令；
- 构建命令；
- 运行命令；
- QA 策略建议；
- 允许的例外。

适配器不是业务需求文档。业务需求仍由 PRD、API contract 和 task contract 承载。

## 5. 工作区层负责什么

Workspace 是某个客户、项目或系统的隔离运行单元。

每个 workspace 应保存：

- `workspace.json`：项目、组件、技术栈、仓库路径和运行配置；
- `tasks/`：任务契约；
- `runtime/`：服务注册表、锁、租约、事件；
- `memory/`：该 workspace 的项目记忆和决策；
- `artifacts/`：QA 证据、截图、报告索引；
- `repos/` 或本地 repo 引用；
- secrets 引用，不保存明文 secrets。

## 6. 用户与工作区关系

多租户 SaaS 场景下，用户与工作区通常是多对多关系：

```txt
User 1 --- N Membership N --- 1 Workspace
```

因此权限应挂在 membership 上，而不是只挂在 user 上。一个用户在不同 workspace 可以有不同角色。

## 7. 技术栈适配示例

前端可支持：

- `react-vite`
- `nextjs`
- `vue-vite`
- `angular`
- `svelte`
- `plain-html`
- `mobile-web`
- `mini-program`

后端可支持：

- `nest-prisma`
- `express`
- `spring-boot`
- `django`
- `fastapi`
- `go-gin`
- `rails`
- `laravel`
- `serverless`

数据库可支持：

- `mysql`
- `postgres`
- `sqlite`
- `mongodb`
- `redis`
- `mixed`

## 8. QA 策略多样性

QA 不绑定某一个工具。项目可以声明多个 QA strategy：

| 测试类型 | 可选工具 |
|---|---|
| API 契约 | Postman/Newman、pytest、supertest、REST Assured |
| 单元测试 | Vitest、Jest、JUnit、pytest、go test |
| 集成测试 | Testcontainers、Docker Compose、Spring Test、pytest |
| Web E2E | Playwright、Cypress、Selenium |
| 移动端 | Appium、设备 smoke、平台测试工具 |
| 可访问性 | axe、Lighthouse、Playwright a11y |
| 视觉回归 | Percy、Chromatic、Playwright screenshot |
| 性能 | k6、JMeter、Locust |
| 安全 | OWASP ZAP、Semgrep、npm audit、Snyk |
| 数据一致性 | SQL probes、migration checks、reconciliation scripts |

主 Agent 根据 workspace 的系统类型和风险选择组合，而不是固定“所有项目都跑浏览器 E2E”。

## 9. 主 Agent 调度流程

1. 读取 workspace 配置；
2. 识别 components 和 stack；
3. 加载对应 project adapters；
4. 生成 task contract；
5. 为子 Agent 附带技术栈结构规范、检查命令和 QA 策略；
6. 子 Agent 执行并返回 `machineEvidence`；
7. 主 Agent 执行机器证据门和结构门；
8. QA 根据策略矩阵执行验收；
9. 通过质量门后交付。

## 10. 面试表述

可以这样描述：

> 我设计的是技术栈无关的 Multi-Agent Operating Layer。Agent 角色、通信协议、机器证据门、结构门和质量门是全局能力；React/Vue/Next、Nest/Spring/FastAPI、MySQL/Postgres 以及不同 QA 工具通过 Project Adapter 注入。这样同一套主子 Agent 协作架构可以迁移到不同业务系统，而不是绑定某个 demo 项目。
