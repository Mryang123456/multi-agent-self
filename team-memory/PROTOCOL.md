# 团队记忆与工作区协议
## 下载即用原则

本架构默认是“Agent 读取文件即可使用”。新环境只需要先读仓库根目录的 `AGENT_ENTRY.md` 和本协议，就可以开始按角色、任务契约、文件结构门和机器证据 Gate 工作。

除非当前任务涉及启动服务、真实数据库、浏览器验收、端口/PID/session 管理或多 Agent 争用本机运行环境，否则不需要先运行 `runtime-init`，也不需要配置 `runtime/services.local.json`。

## 结构化编排事实源（v1）

多 Agent 执行使用四类机器可校验事实源：

- `shared/tasks/<task-id>.task.json`：目标、角色、路径范围、验收标准、检查项及数据/提交策略。
- `shared/gates/*.gate.json`：S1-S5 准入、输出、退出条件和阻断等级。
- `shared/ownership/*.ownership.json`：任务期间的文件读写租约。
- `runtime/*.json` 与 `runtime/events.jsonl`：运行快照和追加式事件；最终决策仍写 `team-lead/decisions.md`。

### 接单与执行顺序

1. 主 Agent 派单前创建或更新任务契约，确认依赖、gate 和路径范围。
2. 写任务派发前登记 ownership；重叠独占写租约未收敛前不得并行派发。
3. 子 Agent 先校验 task ID、允许/禁止路径、数据与提交策略。聊天消息不得隐式扩大权限，范围变化必须先更新契约。
4. 开工后状态置为 `working`；长命令使用 `waiting-command` 并记录句柄或动作，不因短暂无输出判定失联。
5. 阻塞记录原因、责任方、重试次数和是否需要用户；完成时附命令、退出码或证据路径。
6. 主 Agent 核验 gate 后释放 ownership，再把任务标为 `completed`。跳过阶段必须记录理由。

### 一致性与并发

- 任务契约是派单范围事实源，runtime 是实时状态事实源，`WORKING.md` 是人类可读视图，`decisions.md` 是收敛后的决策记录。
- 多 Agent 不并发覆盖同一 runtime 快照；子 Agent 追加事件或回传状态，由单一协调者生成快照。
- ownership 是可过期租约。Agent 中断后先核对实际文件和最近事件，再由主 Agent释放或转交。
- 初期采用“记录 + 校验”；现有工作树基线校准前，不自动抢占租约或删除状态。

本文件定义虚拟研发团队(pm/frontend/backend/qa/team-lead)的 **workspace 隔离**、**双维度记忆系统**、**git worktree 并行隔离**、**共享契约**、**可追溯**规则。所有 agent 启动时先读本文件。

## 0. 记忆系统的两个维度

记忆系统沿**两个正交维度**组织,务必分清:

### 维度一:检索深度(渐进披露,管 token 成本)
取一条记忆要付几次检索成本。分层隔离膨胀——记忆再多,顶层导航也恒定短小。

| 检索层 | 文件 | 加载方式 | 内容 | 成本 |
|--------|------|---------|------|------|
| **导航** | `<role>/MEMORY.md` | 自动注入 system prompt / 启动读 | 分类导航 + 每类核心话题关键词 | 恒定(~20 行) |
| **索引** | `<role>/_index.md` | 主 agent 按需 Read | 该角色所有长期记忆的一行指针 + description | 按需 |
| **正文** | `<role>/mem/<name>.md` | 主 agent 按需 Read | 完整正文(带 frontmatter) | 按需,单条 |

> 召回靠主 agent 主动 Read + Grep,不依赖智能召回(参考系统验证过原生 findRelevantMemories 在代理环境下 0 注入,故采用可控、可审计的主动检索范式)。

### 维度二:时间生命周期(管记忆生灭)
一条记忆在生命周期哪个阶段。

| 生命层 | 文件 | 内容 | 生命周期 |
|--------|------|------|---------|
| **日志** | `<role>/memory/YYYY-MM-DD.md` | 当日任务流水:做了什么、产出路径、报错 | 短期滚动 |
| **工作** | `<role>/WORKING.md` | 进行中任务:目标、待办、阻塞 | 任务级,完成清空 |
| **沉淀** | `<role>/mem/<name>.md` + `_index.md` | 精炼的长期记忆(决策/契约/教训/偏好) | 长期 |

> 两个维度正交:一条"沉淀"记忆既在时间轴 L3,也在检索轴有导航→索引→正文三跳。日志/工作记忆**不进检索索引**(它们是流水,不是可复用知识)。

## 1. Workspace 隔离

每个角色独立工作目录,产出物落各自目录,互不污染:

| 角色 | workspace |
|------|-----------|
| pm | `~/.claude/team-workspaces/pm/` (PRD、需求文档) |
| frontend | `~/.claude/team-workspaces/frontend/` (前端代码、方案) |
| backend | `~/.claude/team-workspaces/backend/` (后端代码、接口文档) |
| qa | `~/.claude/team-workspaces/qa/` (用例、测试报告) |

- agent 只在自己 workspace 内读写产出物。
- 代码类产出若属于某个 **git 仓库**,改由 team-lead 用 **worktree 隔离**(见 §3),agent 在 team-lead 指定的 worktree 路径内工作。

## 2. 记忆目录结构(每角色)

```
~/.claude/team-memory/<role>/
├── MEMORY.md          检索·导航层(自动注入,恒定短小)
├── _index.md          检索·索引层(所有沉淀记忆的一行指针)
├── mem/               检索·正文层(每条长期记忆一个文件,带 frontmatter)
│   └── <name>.md
├── WORKING.md         生命·工作层(进行中任务,完成清空)
└── memory/            生命·日志层(当日流水,按日期)
    └── YYYY-MM-DD.md
```

### WORKING.md 结构化模板(状态字段,支撑断点续传)
`WORKING.md` 不是自由文本备忘,进行中任务必须按下面结构记录,任务完成才清空:
```markdown
# <role> 工作记忆 (L2)

> 当前进行中任务的目标、待办、阻塞、临时上下文。任务完成清空。

## 任务目标
<一句话:这次要交付什么>

## 进度清单(多步/多文件任务必填,每完成一个子项就更新,不要等任务全部完成才写)
| 子项 | 状态 | 产出路径 | 备注 |
|------|------|----------|------|
| 如: login() | done | src/auth.ts | |
| 如: logout() | done | src/auth.ts | |
| 如: refreshToken() | in_progress | src/auth.ts | 中断/崩溃时以此行为续写起点 |
| 如: session 清理 | todo | src/auth.ts | |

## 阻塞
<无 或 具体阻塞项>
```
- 状态取值:`todo` / `in_progress` / `done`。**只有 done 的子项才算完成**,`in_progress` 明确标出"崩溃时正写到哪一项",避免恢复时无从判断。
- 这张进度清单是**断点续传**(见下方"执行中协议")和**§6.0 子 agent 复用**共同依赖的基础设施——没有它,进程/会话一断,新实例除了整个任务重做没有别的路可走。

team-lead 的 `WORKING.md` 额外加两段(支撑 §6.0 子 agent 复用 + 5 阶段流水线可查询):
```markdown
## 流水线状态
- 当前阶段: S3
- 阶段 gate: 未达成 / 达成

## 已派单 agent 清单(§6.0 子 agent 复用)
| name | role | 阶段 | 状态 | 备注 |
|------|------|------|------|------|
| backend | backend | S3 | alive | 存活,可 SendMessage 恢复 |
| frontend | frontend | S3 | done | 已收口,勿恢复到旧上下文 |

## 待确认路由状态(§6.3 三轮上限)
| 问题 | 提问方 | 目标角色 | 轮次 | 状态 |
|------|--------|----------|------|------|
| envelope 是否复用 | pm | backend | 1/3 | pending |
```
- `已派单 agent 清单`的"状态"列取值:`alive`(可 `SendMessage` 恢复)/ `done`(该实例阶段性任务已收口,换名开新实例,勿恢复到旧上下文)。
- `轮次`列用 `<当前轮>/3`,到 3 未收敛 → team-lead 仲裁兜底(§6.3),不再判断"是不是已经问第 3 遍了"全凭记忆。

### frontmatter(记忆正文唯一事实源)
每条 `mem/<name>.md` 必须带 frontmatter:
```yaml
---
name: <kebab-case-id>
description: <一句话:这条记忆讲什么,何时相关。索引和召回都靠它>
type: user | feedback | project | reference
status: active | completed   # 仅 project 类用,驱动归档(B 期)
---
<正文>
```
- **`description` 是唯一事实源**。`_index.md` 的描述列由它单向同步(B 期 cron 自动;A 期手写时必须与 frontmatter 一致)。
- `type` 四类封闭分类:user(用户画像)/feedback(工作方式纠正)/project(项目背景)/reference(外部指针)。user/feedback/reference 长期有效,project 完结可归档。

### 启动协议(agent 被调用时)
1. Read 本 PROTOCOL.md。
2. Read 自己的检索·导航 `MEMORY.md` —— 知道有哪几类、每类关键词。
3. 判断可能命中哪类 → Read 检索·索引 `_index.md` 看有哪些记忆。
4. 定位到具体记忆 → Read 检索·正文 `mem/<name>.md` 拿正文。
5. Read 生命·工作 `WORKING.md`。**非"(空闲)" → 判定为断点续传场景,先走下面"执行中协议 → 断点恢复"再动手,不要当新任务从头做。**
6. **不全量读日志层** `memory/*.md`,只在追溯某次细节时按日期读。

### 执行中协议(增量记录进度 + 断点恢复)
解决"写到一半被打断(终端崩溃/会话意外关闭/进程被杀)"场景——之前唯一能救命的只有已落盘的文件本身,新实例不知道断在哪,只能整个任务重做。

**执行中(推进任务时)**:
- 多步/多文件任务,每完成一个子项(如写完一个函数、一个文件)就更新 `WORKING.md` 的进度清单一行(`todo → in_progress → done`),**不要攒到任务全部完成才写**——攒到最后写等于中途崩溃时清单还是空的,起不到任何作用。
- 正在写的子项标 `in_progress` 且先于"实际把它写完"落盘——这样即使写这一项时中断,清单也留着"断在这一项"的痕迹。

**断点恢复(启动协议第 5 步判定为续传场景后)**:
1. 读 `WORKING.md` 进度清单,定位 `done` / `in_progress` / `todo` 各子项。
2. **以实际产出文件的当前内容为准复核**(Read 目标文件),不要只信 `WORKING.md`——它可能滞后于真实文件状态(比如崩溃发生在"写完文件"和"更新清单"之间)。文件里已存在的部分才算数。
3. 只续写 `todo` 和"清单说 in_progress 但文件里其实还没写完"的子项;已经在文件里的部分不重做。
4. 复核完成后按下面"写入协议"节奏继续增量更新清单,直到全部 `done`。
- **跨会话/跨进程同样适用**:§6.0 讲的是"同会话内子 agent 复用"(SendMessage 续存活实例);这里讲的是"进程/实例本身没了"时,靠磁盘上的 `WORKING.md` + 实际文件兜底续传,两者互补,不是同一个机制。

### 写入协议(沉淀新记忆)
两步式,保持索引与正文不漂移:
1. **Write 正文** `mem/<name>.md`,带 frontmatter(name/description/type)。
2. **Edit 索引** `_index.md`,追加一行指针:`| [<name>](mem/<name>.md) | <description> |`。
3. 若是全新分类/关键词变化 → 更新导航 `MEMORY.md` 的关键词列。
- 不把正文写进 _index(它是索引不是记忆);不直接改 _index 的描述列(以 frontmatter 为准)。

### 收尾协议(任务完成)
1. 追加生命·日志 `memory/今天.md`:本次流水(产出路径、关键决策、报错)。
2. 若产出值得长期复用 → 按写入协议沉淀进 `mem/` + 更新 `_index.md`。
3. 确认进度清单全部 `done` → 清空生命·工作 `WORKING.md`。
4. 向 team-lead 返回:产出物路径 + 关键决策摘要(供 decisions.md 追溯)。

### 精炼原则
- 日志层可冗余,沉淀层去噪。
- 沉淀记忆每条尽量短,带日期和来源任务。
- 沉淀层不存易变细节(具体代码行),只存决策和教训;易变细节留日志层。

## 3. 代码隔离:同仓库 worktree / 不同仓库天然隔离

多个 agent 并行改代码时,按**是否同一仓库**分两种隔离方式:

### 3.1 同一仓库(monorepo)→ git worktree 隔离
多个 agent 同时改同一个 git 仓库,共享文件系统会冲突。此时:
- team-lead 用 `Agent` 工具的 `isolation: "worktree"` 派单,每个 subagent 在独立 worktree 工作。
- 各 agent 在自己 worktree 改代码,互不踩踏。
- 完成后 team-lead 收集各 worktree 改动,合并/审查(处理冲突)。

### 3.2 不同仓库(前后端各自仓库)→ 天然隔离,不用 worktree
前后端在不同仓库时,本就不存在"抢同一仓库"的冲突,**不需要 worktree**——直接用各自的工作目录:
- team-lead 派单时把各自仓库的本地路径传给对应 agent(如 frontend 在 `~/repos/web`,backend 在 `~/repos/api`)。
- 各 agent 在自己仓库工作目录改代码,各自 git 操作,零冲突。
- **不要给不同仓库硬加 worktree**——会在该仓库建临时工作树,多一层无谓合并。

### 3.3 通用要点
- 不论同/不同仓库,**契约先行**是并行的前提:S2 把接口契约定好落 `shared/contracts/`,S3 前后端各自按契约开发,互不等候。
- 不同仓库的代价在 S4:qa 集成验证时要同时拉多个仓库联调,比同仓库重。
- **仅改代码且并行时才需隔离**;写文档/单 agent 串行时不必。

## 4. 5 阶段流水线(标准化协作流程)

任务标准化为 5 阶段,team-lead 按阶段编排,阶段间有 gate(满足条件才进下一阶段)。消除"想到哪做到哪"的无序协作。

| 阶段 | 名称 | 主责 | 输入 | 输出(产出物路径) | 进入下一阶段 gate |
|------|------|------|------|-------------------|-------------------|
| S1 | 需求澄清 | pm | 用户原始需求 | PRD(workspace/pm/) | 验收标准明确、无未决待确认项 |
| S2 | 契约定义 | backend | PRD | 接口契约(shared/contracts/)+ 技术方案 | 契约落 shared,字段/错误码定齐 |
| S3 | 并行实现 | frontend+backend | 契约 + PRD | 代码(workspace或worktree)+ 自检报告 | 各自 frontend/backend-review 通过 |
| S4 | 集成验证 | qa | 代码 + 契约 + 验收标准 | 测试用例 + 测试报告(workspace/qa/) | P0/P1 缺陷归零 |
| S5 | 交付收口 | team-lead | 测试报告 + 各产出物 | decisions.md 追加 + 向用户汇报 | 决策日志完整、用户确认 |

- **S3 并行**:frontend 按 shared 契约实现,backend 实现契约,可并发(契约先行消除了联调依赖)。改同一仓库时用 worktree 隔离(§3)。
- **阶段 gate**:team-lead 检查上一阶段产出物存在且满足 gate 条件,才派下一阶段。gate 不满足 → 退回或路由待确认项(见 §6)。
- **例外**:非研发全流程任务(如纯写文档、单点修改)可跳过不相关阶段,team-lead 灵活裁剪,但需在 decisions.md 注明跳过原因。

### 4.1 已知限制:team-lead 派不出 subagent(方案A 范式)

**设计意图**:team-lead 通过 Agent 工具派 pm/frontend/backend/qa 子 agent(其 frontmatter 声明 tools 含 Agent)。

**实际限制**:team-lead 派不出 subagent——subagent 嵌套深度受限(team-lead 本身是主会话派的 subagent,再往下派被运行时拦)。2026-07 多租户登录 MVP 实战验证:team-lead 全程派不出,S3 真并行靠主会话直接派才实现。

**实际范式(方案A)**:
- **team-lead 退协调位**:S1/S2/S5 协调 + 仲裁 + 判 gate + 维护 decisions.md(单点代答需求/契约可,这些不重)。
- **主会话直接并行派**:S3 一条消息并发派 backend+frontend subagent(各改各目录,前后端分目录天然隔离);S4 实现 qa 串在后面。
- **别让 team-lead 试派 subagent**——它会单点代答,丢并行价值。

下次团队任务直接照搬方案A,不用再踩。详见 memory:[[team-lead-cannot-spawn-subagent]] [[team-lead-coordination-pattern]]。

**§6.0 子 agent 复用规则同样适用于方案A下的主会话**:S3 由主会话直接并发派单时,同样要给每个实例起 `name`,后续同角色的追问/待确认路由由主会话用 `SendMessage` 恢复,不重新 `Agent()`——谁实际执行了派单,谁就负责维护"本次任务已派单 agent 清单"和后续的恢复调用,不局限于 team-lead 自己。

## 5. 共享契约(shared/contracts)

跨角色共享的接口契约、数据模型、错误码字典放:
```
~/.claude/team-memory/shared/contracts/
```
- 任何角色产出契约 → Write 到此目录(如 `resume-api.md`),带 frontmatter。
- 其他角色需要契约时 → Read 此目录,不各自维护副本。
- 契约变更:由产出方(通常 backend)更新,team-lead 通知消费方(frontend)。
- 契约是单一事实源,避免前后端各记一份导致不一致。
- `shared/` 也有自己的 `_index.md`(索引所有共享契约)。

## 6. 结构化通信协议 + 可追溯

### 6.0 子 agent 复用(同会话内持久化,而非每次重新派单)

`Agent()` 派单是一次性拉起子进程,用完即散——默认下一次再找同一个角色,是一个从零开始、没有任何上文记忆的全新实例。这在"待确认路由"这类需要跟同一角色多轮来回的场景里代价很高:每轮都要重新喂一遍背景,3 轮仲裁还可能因为对方"失忆"而失真。

**机制**:`Agent()` 派单时带一个稳定 `name`(建议直接用角色名 `pm`/`frontend`/`backend`/`qa`,同角色并行多实例时加后缀如 `backend-2`)。此后在**同一 Claude Code 会话内**,用 `SendMessage(to=<name>, message=...)` 可以恢复该实例——它带着之前的完整对话上下文继续,不需要重新介绍背景。

**使用规则**:
- 派单前先看该角色本次任务是否已经开过实例(team-lead/主会话的 `WORKING.md`"已派单 agent 清单",结构化格式见 §2)。已开过且状态 `alive` → `SendMessage` 恢复;没开过或状态 `done` → `Agent(name=<role>, ...)` 新开并记入清单。
- 同一任务内的后续追问、返工、待确认路由,一律走 `SendMessage` 恢复,不重新 `Agent()` 派单。
- 例外:该角色阶段性任务已收口(如从 S2 换到 S5,要处理的是全新独立子任务),值得开新实例时换名区分(`backend-s2` vs `backend-s5`),清单里旧实例标 `done`,避免恢复到一个"已经交完活"的旧上下文里造成混乱。
- **边界**:这只解决同一会话内、实例仍存活时的多轮持久化。**跨会话(隔天、新开一次 Claude Code 对话)或实例本身崩溃(终端被杀、进程异常终止)不能靠 `SendMessage` 续命**——子 agent 进程没了,`name` 也不再可解析,清单里这行应视为不可恢复(状态改 `done` 或标注"进程已丢失",不要反复尝试 `SendMessage`)。这种情况下:
  - 长期知识(编排经验/团队踩坑)靠 §0-2 的 team-memory 文件,agent 每次被重新派单时通过"检索三跳"主动读回。
  - **半途而废的具体任务进度**(比如代码写到一半)靠 §2"执行中协议(增量记录进度 + 断点恢复)"——新实例启动协议第 5 步会读 `WORKING.md` 进度清单 + 核对实际产出文件,只续写未完成的子项,不是整个任务重做。

### 6.1 待确认问题标记格式
agent 在产出中遇到需要其他角色确认的问题,**必须用固定标记**,便于 team-lead 自动识别和路由:
```
【待确认→<目标角色>】<问题描述>(背景: <为什么需要确认>)
```
- `<目标角色>`:pm / frontend / backend / qa 之一(不能是 team-lead,team-lead 是路由者不是回答者;需要用户决策的标 → user)。
- 例:`【待确认→backend】简历字段 education 是否要拆成多行?PRD 只说"教育经历"(背景: 前端表单要决定单输入还是列表输入)`

### 6.2 自动路由流程
1. 子 agent 产出含 `【待确认→X】` 标记 → 返回给 team-lead。
2. team-lead 扫描标记,按 §6.0 规则把问题路由给目标角色 X:X 本次任务内已有存活实例 → `SendMessage(to=X, ...)` 恢复;没有 → `Agent(name=X, ...)` 新开,带上原问题 + 上下文。
3. X 回答后,team-lead 用 `SendMessage` 把答复回传给提问方的原实例,提问方据此继续(不是重新派单)。
4. 路由记录追加 decisions.md(谁问了谁、问什么、答复)。

### 6.3 3 轮上限 + 仲裁兜底
同一个待确认项**最多路由 3 轮**:
- **轮内收敛**(3 轮内双方达成一致)→ 继续流程。
- **3 轮未收敛** → team-lead **仲裁兜底**:基于双方论据做决策,或升级给用户(user)决策。不再无限路由,消除联调猜测性返工。
- 仲裁决策记 decisions.md,标注"仲裁"及理由。被仲裁方即使不同意也按决策执行(后续可在收口阶段反馈)。

### 6.4 为何这套协议
- **标记格式化** → team-lead 可机械识别,不靠自然语言猜。
- **显式目标角色** → 路由无歧义,不广播浪费。
- **3 轮上限** → 防止两个 agent 无限拉扯消耗 token;仲裁兜底保证流程不卡死。
- **路由日志进 decisions.md** → 通信可追溯,出问题能回溯"这个问题问了几轮、谁说了什么、最后怎么定的"。

### 6.5 可追溯(team-lead/decisions.md)
team-lead 维护 `~/.claude/team-memory/team-lead/decisions.md`,记录每次协作:
- 日期、用户原始需求
- 5 阶段执行情况(哪些阶段、是否跳过)
- 派单了谁、各自产出物路径
- 接口契约路径
- **待确认项路由记录**(谁→谁、问什么、答复、第几轮收敛 or 仲裁)
- 关键决策及理由(含仲裁决策)
- 阻塞与风险

这是整个团队协作的审计日志,出问题可回溯"谁在什么时候基于什么决策做了什么"。

## 7. 自动归档(B 期)

记忆只增不删会腐化成垃圾堆。归档由 cron 自动执行,业务完结标记驱动,不靠时间老化。

### 归档规则
- **只归 `type: project` 类**:user/feedback/reference 长期有效,永不归档(用户画像和反馈按时间归档会误删)。
- **必须显式 `status: completed`**:没标的永不归档——零误归风险(漏归只是索引稍乱,误归是把在用的藏起来,前者代价小得多)。
- **30 天反悔期**:标了 completed 且填了 `completed_at` 的,30 天内不归档,可改回 `active` 反悔;无 `completed_at` 则立即归档(未启用反悔期)。
- **只移不删**:归档文件移入 `<role>/_archive/`,保留结构,任何时候可恢复。
- `WORKING.md` / `memory/` 日志不参与归档(它们是流水不是知识)。

### project 类完结示例
```yaml
---
name: some-project
description: ...
type: project
status: completed        # active | completed
completed_at: 2026-07-21  # 可选,启用 30 天反悔期
---
```
项目完结时,改 `status: completed`(可选加 `completed_at`),其余归档全自动。

## 8. 自动运维(B 期)

**零人工索引维护**。每周一 10:15 一个 cron 任务跑 `update_indexes.py`,完成四步:

| 步骤 | 做什么 | 由谁 |
|------|--------|------|
| Step 1 结构同步 | 扫 `mem/*.md`,与 `_index.md` 对账:新文件追加行、删文件删行 | cron |
| Step 2 描述同步 | 读 `mem/*.md` frontmatter `description`,单向同步到 `_index.md`(frontmatter 是唯一事实源) | cron |
| Step 3 自动归档 | 按 §6 规则归档 completed 的 project 记忆到 `_archive/` | cron |
| Step 4 导航刷新 | 用各 `_index.md` 的记忆清单重建 `MEMORY.md` 的"当前沉淀"区 | cron |

- 日常人机协作点极简:agent 对话中写新记忆(两步式)→ cron 自动同步索引/归档/刷新导航;人只需项目完结时改两个字段(status + completed_at)。
- 手动触发:`cd ~/.claude/team-memory && python3 update_indexes.py`(加 `--dry-run` 只看计划不改文件,加 `--role pm` 只跑某角色)。
- 运维日志:`~/.claude/team-memory/.ops.log`。
- **诚实限制**:Step 4 真正的关键词提炼需 LLM(提炼每类 8-15 个核心话题),当前无 API key,降级为"记忆清单替代"——导航层至少反映该类有哪些记忆,辅助判断是否下钻。预设的分类关键词表由人工维护。接 LLM 后可升级为自动关键词提炼。

### 寄生原生 auto-memory 的评估结论
参考的单用户系统用 `autoMemoryDirectory` 重定向寄生原生 auto-memory,白嫖 system prompt 自动注入 / 文件写放行 / staleness 注记。**本多 agent 系统保守不重定向主目录**,原因:
- 原生 auto-memory 期望"顶层 MEMORY.md + 平铺 topic 文件"结构,会与我们的双维度结构(分角色 + mem/_index)冲突,可能被原生逻辑误操作。
- system prompt 注入面向主会话,subagent 派单时未必继承,收益不保证。
- 风险(原生接管多 agent 共享目录)明确大于收益(省 agent 主动读)。故保留"agent 启动主动读导航层"的范式,可控可审计。未来若验证 subagent 能继承注入,可 reconsider。

## 9. Red Lines
- 不把 secrets 写进任何 memory 文件。
- 不读其他角色 workspace 的私产(除非通过 shared 契约)。
- memory 文件是团队内部上下文,不外发。
- 沉淀记忆的 `_index.md` 描述列必须与正文 frontmatter `description` 一致(单一事实源)。
## 10. 机器证据 Gate：机器证据优先的子 Agent 交付协议

本节是 2026-08-10 ProcureFlow 结构化重构暴露问题后的架构迭代。问题本质：子 Agent 曾报告“前端结构化完成”，但主 Agent 通过 `git status --short` 与 `rg --files` 核查发现磁盘没有对应文件移动或仍为旧结构。结论：自然语言报告不能作为事实源，必须以机器证据为准。

### 10.1 子 Agent 最小交付包

子 Agent 交付不得只有 final answer，必须提供可复核的 `machineEvidence`：

- `git status --short`：列出实际变更。
- `rg --files` / 目录快照：列出关键产物路径，尤其是“移动/重构/新增目录”类任务。
- 验证命令、退出码和摘要：test、lint、typecheck、build、Playwright、数据库核查等。
- 关键产物路径：代码、报告、截图、日志、测试数据 ID。
- 若未执行某项验证，必须说明原因、风险和替代证据。

### 10.2 主 Agent 机器证据 Gate

主 Agent 不接受未经核验的“完成”。进入下一阶段前必须：

1. 把子 Agent final answer 初始标记为 `CLAIMED_DONE_UNVERIFIED`。
2. 对照 task contract 的 `machineEvidence.expectedArtifacts` 检查路径是否存在、结构是否匹配。
3. 运行或复核 `machineEvidence.commands`，记录退出码和关键输出。
4. 对比“声明”与“磁盘/命令事实”。
5. 只有一致时标记 `VERIFIED_DONE` 并允许进入下一阶段。

### 10.3 结果分类

- `CLAIMED_DONE_UNVERIFIED`：子 Agent 声称完成，但尚未被主 Agent 机器核验。
- `EVIDENCE_MISMATCH`：声明与磁盘文件、目录快照、git 状态或验证命令不一致。
- `VERIFIED_DONE`：声明、产物路径、git 状态和验证命令一致。
- `STALE_REPORT`：报告基于旧目录、旧 commit、旧服务状态或无法在当前工作区复现。

### 10.4 超时与无状态输出处理

长时间运行或超时的子 Agent 不得被默认视为失败或完成。主 Agent 先要求状态快照：

- 当前阶段、正在执行的命令、已产生的文件、阻塞点、下一步。
- 连续超时且无状态输出时，主 Agent 可以 interrupt。
- 中断后先只读盘点：`git status --short`、`rg --files`、关键文件读取、必要的只读日志检查。
- 根据盘点结果决定续派原任务、重派新 Agent，或由主 Agent 做最小兜底。

### 10.5 Incident 归档规则

“报告与事实不一致”是 P1 流程缺陷，不是业务缺陷。必须登记到 defect/incident ledger，分类为 `PROCESS`，并记录：

- 子 Agent 声明。
- 主 Agent 机器核验证据。
- 实际影响：是否阻断 gate、是否误导进度、是否需要重派。
- 修复动作：补充 machineEvidence、重派、回归验证、协议更新。

### 10.6 Incident case：frontend_structure_refactor

- 日期：2026-08-10。
- 任务：将前端从平铺结构重构为 `src/app`、`src/features`、`src/shared`。
- 现象：第一轮子 Agent 报告结构化完成，但主 Agent 使用 `git status --short` 与 `rg --files` 核对，发现磁盘无实际文件移动或仍为旧结构。
- 分类：`PROCESS / P1 / EVIDENCE_MISMATCH`。
- 处置：不进入下一阶段；重派 real agent；完成后由主 Agent 验证目录结构、测试、lint、typecheck、build。
- 经验：子 Agent final answer 只是线索，主 Agent 的 gate 必须以机器证据为准。
