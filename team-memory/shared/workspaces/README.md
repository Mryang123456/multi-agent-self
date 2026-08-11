# 工作区配置

工作区用于隔离不同客户、项目或系统的运行状态。全局 Agent 规则可以共享，但任务、运行环境、证据、记忆、仓库引用和本机配置必须按 workspace 隔离。

## 推荐结构

```text
workspaces/
  <workspace-id>/
    workspace.json
    tasks/
    runtime/
    memory/
    artifacts/
```

当前仓库提供的是 schema 和示例。实际项目可以把 `workspace.json` 放在上面的结构里，也可以先放在 `team-memory/shared/workspaces/` 下管理。

## workspace.json 负责声明什么

- workspace ID 和名称；
- tenant/customer 标识；
- system type；
- components；
- 每个 component 的角色、技术栈、路径和 adapter；
- runtime 端口与健康检查；
- QA 策略；
- 数据写入策略；
- artifacts 路径；
- secrets 引用。

不要在 `workspace.json` 中保存明文密码、token 或完整连接串。只保存 secret 名称或本机安全存储引用。

## 跨电脑迁移原则

可以迁移：

- workspace schema；
- workspace example；
- adapter 引用；
- 组件相对路径约定；
- QA 策略；
- artifact 目录规则。

每台电脑需要重新确认：

- repo 实际落盘路径；
- 端口；
- 本机数据库和浏览器；
- secret 存储；
- runtime/services.local.json。

## 使用方式

复制示例：

```powershell
Copy-Item team-memory/shared/workspaces/example.workspace.json team-memory/shared/workspaces/my-project.workspace.json
```

然后修改：

- `workspaceId`
- `name`
- `components[].path`
- `components[].stack`
- `components[].adapter`
- `components[].runtime`
- `qaStrategies`
- `artifactRoot`

主 Agent 派单时必须把 `workspaceId`、目标 `component`、`projectAdapter`、`qaStrategies` 和 `filePlacementPolicy` 带给子 Agent。
