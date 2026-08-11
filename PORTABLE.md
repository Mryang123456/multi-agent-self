# 可移植安装与迁移指南

这套架构的默认目标是“下载即用”：Agent 读取架构文件后即可开始按主子 Agent 规则协作。runtime 初始化是高级能力，不是入门前置条件。

## 1. 两种使用模式

### 零配置模式

适合：

- 写代码；
- 重构；
- 代码审查；
- 文档更新；
- 架构设计；
- 测试计划；
- 面试材料；
- 不启动本机服务的任务。

步骤：

```powershell
git clone https://github.com/Mryang123456/multi-agent-claude-code.git
cd multi-agent-claude-code
```

然后让 Agent 读取：

```text
AGENT_ENTRY.md
```

### Runtime 模式

适合：

- 启动/停止服务；
- 真实数据库验证；
- 浏览器 UI 验收；
- 端口/进程/服务所有权管理；
- 多 Agent 争用本机环境。

启用：

```powershell
node scripts/runtime-init.mjs --project my-project
node scripts/runtime-status.mjs
node scripts/runtime-health.mjs
```

## 2. 可迁移文件

这些文件定义规则、协议、schema 和模板，可以放进 GitHub：

- `AGENT_ENTRY.md`
- `QUICKSTART.md`
- `agents/*.md`
- `team-memory/PROTOCOL.md`
- `team-memory/shared/**/*.md`
- `team-memory/shared/**/*.json`
- `team-workspaces/qa/templates/*.md`
- `runtime/services.schema.json`
- `runtime/services.local.example.json`
- `scripts/runtime-*.mjs`

## 3. 本机文件

这些文件只属于当前电脑，不能提交：

- `runtime/services.local.json`
- 当前 PID、sessionId、进程所有者；
- 当前端口占用状态；
- 当前数据库密码、token、cookie、完整连接串；
- 当前浏览器路径、Playwright cache、系统服务路径。

## 4. 迁移到新电脑

最小迁移：

```powershell
git clone https://github.com/Mryang123456/multi-agent-claude-code.git
cd multi-agent-claude-code
```

然后让 Agent 读取 `AGENT_ENTRY.md`。

需要本机服务时再运行：

```powershell
node scripts/runtime-init.mjs --project my-project
```

如果你已经有 `runtime/services.local.json`，初始化脚本默认不会覆盖。需要重建时显式使用：

```powershell
node scripts/runtime-init.mjs --project my-project --force
```

## 5. 配置项目工作区

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

## 6. 适配不同技术栈

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

## 7. 面试表达

可以这样介绍：

> 我把多 Agent 架构拆成下载即用的规则层和可选 runtime 层。Agent 默认只需要读取 AGENT_ENTRY、角色规则和共享协议即可工作；只有涉及本机服务、数据库、浏览器和端口争用时，才启用 runtime 初始化。这样架构既轻量可迁移，又能在复杂联调场景下提供服务所有权、证据 Gate 和环境诊断能力。
