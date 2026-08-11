# 工作区配置

工作区用于隔离不同客户、项目或系统的运行状态。全局 Agent 规则可以共享，但任务、运行环境、证据、记忆和仓库引用必须按 workspace 隔离。

推荐结构：

```txt
workspaces/
  <workspace-id>/
    workspace.json
    tasks/
    runtime/
    memory/
    artifacts/
```

`workspace.json` 负责声明：

- workspace ID 和名称；
- tenant/customer 标识；
- system type；
- components；
- 每个 component 的角色、技术栈、路径和适配器；
- runtime 端口和健康检查；
- QA 策略；
- 数据写入策略；
- secrets 引用。

不要在 `workspace.json` 中保存明文密码、token 或完整连接串。只保存 secret 名称或本机安全存储引用。
