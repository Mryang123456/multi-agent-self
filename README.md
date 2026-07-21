# 多 Agent 协作架构 · Multi-Agent Architecture for Claude Code

一套基于 Claude Code subagent + skill 体系的虚拟研发团队,面向软件研发全流程:workspace 隔离 + 双维度记忆系统 + 并行 worktree + 可追溯 + 自动化运维。

## 仓库内容

```
├── multi-agent-architecture.html   # 面试介绍文档(12 节,含架构图/演进时间线)
├── agents/                         # 5 个 subagent 定义
│   ├── team-lead.md                #   主控/编排/worktree/可追溯
│   ├── pm.md                       #   产品经理 王磊
│   ├── frontend.md                 #   前端工程师 张晨
│   ├── backend.md                  #   后端工程师 陈浩(契约产出方)
│   └── qa.md                       #   测试工程师 张伟
├── skills/                         # 4 个 skill
│   ├── frontend-review/            #   前端代码检查(6类+安全阻断)
│   ├── backend-review/             #   后端代码检查(7类+安全/一致性阻断)
│   ├── job-fill/                   #   job-filler 项目维护
│   └── new-skill/                  #   创建新 skill 的脚手架
├── team-memory/                    # 双维度记忆系统 + B期自动化运维
│   ├── PROTOCOL.md                 #   协议(所有 agent 启动必读)
│   ├── update_indexes.py           #   四步运维脚本
│   ├── update-memory-indexes.sh   #   cron wrapper
│   ├── {pm,frontend,backend,qa,team-lead}/  # 每角色:导航/索引/正文/工作/日志
│   └── shared/contracts/           #   跨角色接口契约(单一事实源)
├── team-workspaces/                # workspace 隔离(每角色独立工作目录)
└── job-filler/                     # 实践项目:自动填招聘表单的 Chrome 扩展
    ├── extension/                  #   MV3 扩展(content/background/sidepanel)
    └── agent-server/               #   本地 agent 服务(/parse /fill,mock+LLM双模式)
```

## 三大支柱

1. **Workspace 隔离** — 每角色独立工作目录;改 git 仓库代码并行时由 team-lead 用 `isolation:"worktree"` 派单。
2. **双维度记忆系统** — 时间生命周期轴(日志/工作/沉淀,管生灭)× 检索深度轴(导航/索引/正文,管 token 成本)正交。检索三跳,frontmatter 为唯一事实源。
3. **可追溯** — team-lead 维护 `decisions.md` 记录每次协作链路。

## B 期自动化运维

每周一 10:15 cron 跑 `update_indexes.py` 四步流水线:结构同步 / 描述同步 / 自动归档(四重安全:只归 project + 显式 completed + 30天反悔 + 只移不删)/ 导航刷新。零人工索引维护。

## 演进

V1 单维度(时间轴)→ V2 A期加检索深度轴(双维度,治膨胀+漂移)→ V3 B期自动化运维(cron+归档,治腐化)。

## 使用

将 `agents/`、`skills/`、`team-memory/`、`team-workspaces/` 放到 `~/.claude/` 下,在 Claude Code 新会话中即可被加载。详细介绍见 `multi-agent-architecture.html`(浏览器打开)。

## .gitignore 说明

排除:`node_modules/`、`.env`、`.ops.log`、`_archive/`(归档区,运行时生成)、macOS `.DS_Store`。
