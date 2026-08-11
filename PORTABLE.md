# 可移植安装与迁移指南

本指南用于把这套多 Agent 架构迁移到另一台电脑、另一个项目或另一个团队环境。

## 1. 设计原则

这套架构分成两类文件。

### 可迁移文件

这些文件定义规则、协议、schema 和模板，可以放进 GitHub：

- Agent 角色规则：`agents/*.md`
- 任务、Gate、ownership、workspace、adapter schema
- QA 证据协议、文件结构门、质量 Gate
- runtime schema 和 example
- 初始化和只读检查脚本
- 报告模板

### 本机文件

这些文件只属于当前电脑，不能提交：

- `runtime/services.local.json`
- 当前 PID、sessionId、进程所有者
- 当前本机端口占用状态
- 当前数据库密码、token、cookie、完整连接串
- 当前浏览器路径、Playwright cache、系统服务路径

## 2. 新电脑初始化

```powershell
git clone https://github.com/Mryang123456/multi-agent-claude-code.git
cd multi-agent-claude-code
node scripts/runtime-init.mjs --project my-project
node scripts/runtime-status.mjs
```

如果你已经有 `runtime/services.local.json`，初始化脚本默认不会覆盖。需要重建时显式使用：

```powershell
node scripts/runtime-init.mjs --project my-project --force
```

## 3. 配置本机服务

打开：

```text
runtime/services.local.json
```

按当前电脑实际情况修改：

- 服务名；
- host；
- port；
- HTTP 健康检查 URL；
- 依赖关系；
- 是否 required。

不要写入：

- 明文密码；
- token；
- cookie；
- 完整数据库 URL；
- 环境变量 dump。

## 4. 配置项目工作区

复制工作区示例：

```powershell
Copy-Item team-memory/shared/workspaces/example.workspace.json team-memory/shared/workspaces/my-project.workspace.json
```

然后修改：

- `workspaceId`；
- `components[].path`；
- `components[].stack`；
- `components[].adapter`；
- `qaStrategies`；
- `artifactRoot`；
- secret 引用名。

`workspace.json` 只写 secret 引用，不写 secret 明文。

## 5. 适配不同技术栈

如果项目不是已有 adapter 覆盖的技术栈，不要硬套 React/Vite 或 Nest/Prisma。

正确做法：

1. 在 `team-memory/shared/adapters/` 下新增对应 adapter；
2. 写清楚目录结构、允许根文件、检查命令、测试策略；
3. 在 workspace 的 component 中引用新 adapter；
4. 主控 Agent 派单时把 adapter 带给子 Agent。

示例：

- Vue 项目：新增 `frontend/vue-vite.adapter.json`
- Next 项目：新增 `frontend/next.adapter.json`
- Spring Boot 项目：新增 `backend/spring-boot.adapter.json`
- FastAPI 项目：新增 `backend/fastapi.adapter.json`
- 移动端项目：新增 `qa/mobile-app.adapter.json`

## 6. 验证架构可用

```powershell
node scripts/runtime-status.mjs --json
node scripts/runtime-health.mjs --json
```

`runtime-status` 验证注册表能读取。

`runtime-health` 验证必需服务是否可达。它只读探测，不会自动修复环境。

如果 health 失败，可能是：

- 服务还没启动；
- 端口配置不对；
- 健康检查 URL 不对；
- 依赖服务不可达；
- 当前电脑没有对应数据库或浏览器环境。

这属于 `BLOCKED_ENV` 或待配置状态，不代表架构不可移植。

## 7. 迁移检查清单

- [ ] 仓库已 clone 到新电脑；
- [ ] 已运行 `runtime-init`；
- [ ] `runtime/services.local.json` 已按本机修改；
- [ ] 工作区配置已复制并改名；
- [ ] component 路径、技术栈、adapter 已正确；
- [ ] 本机 secret 存储已配置；
- [ ] `runtime-status` 可读取；
- [ ] `runtime-health` 输出可解释；
- [ ] 没有把 `services.local.json`、密码、token 提交到 Git。

## 8. 面试表达

可以这样介绍：

> 我把多 Agent 架构拆成全局协议层、项目适配器层和本机 runtime 层。协议和 adapter 可以随仓库迁移；端口、PID、服务状态、数据库密码等本机信息通过初始化脚本生成到 Git 忽略的 local 文件。这样同一套主子 Agent 架构可以下载到其他电脑后快速落地，而不会绑定我的个人机器。
