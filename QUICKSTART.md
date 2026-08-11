# 快速开始

## 方式一：零配置使用

适合写代码、审查代码、写文档、设计方案、更新架构、做测试计划。

```powershell
git clone https://github.com/Mryang123456/multi-agent-claude-code.git
cd multi-agent-claude-code
```

然后对 Agent 说：

```text
请先读取 AGENT_ENTRY.md，然后按这套多 Agent 架构工作。
```

如果你要指定角色：

```text
请按 agents/team-lead.md 作为主控 Agent 执行。
```

或者：

```text
请按 agents/frontend.md 的规则处理前端任务。
```

## 方式二：导入到支持自定义 Agent 的工具

把这些文件复制或导入到目标工具：

- `agents/team-lead.md`
- `agents/pm.md`
- `agents/frontend.md`
- `agents/backend.md`
- `agents/qa.md`
- `agents/runtime.md`
- `team-memory/PROTOCOL.md`

如果工具支持项目知识库，把 `team-memory/shared/` 一起作为知识库或项目文件提供。

## 方式三：启用本机 runtime

只有需要服务编排、端口检查、真实数据库、浏览器验收时使用。

```powershell
node scripts/runtime-init.mjs --project my-project
node scripts/runtime-status.mjs
node scripts/runtime-health.mjs
```

然后按本机实际情况修改：

```text
runtime/services.local.json
```

这个文件不要提交 Git。

## 最小心智模型

```text
AGENT_ENTRY.md：告诉 Agent 从哪里开始读
agents/：每个角色怎么工作
team-memory/PROTOCOL.md：团队协作总规则
team-memory/shared/：任务、Gate、adapter、workspace、证据协议
runtime/：可选，本机服务状态和运行环境管理
```

## 推荐第一句话

对新的 Agent 会话可以这样说：

```text
这是我的多 Agent 架构仓库。请先读取 AGENT_ENTRY.md，再根据任务选择合适角色和协议执行；如果任务不涉及本机服务，不要要求我配置 runtime。
```
