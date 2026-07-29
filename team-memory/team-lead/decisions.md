# 团队协作日志 (可追溯)

> team-lead 记录每次协作:需求 → 派单 → 产出 → 决策 → 风险。

| 日期 | 需求 | 派单 | 产出物 | 关键决策 | 风险 |
|------|------|------|--------|---------|------|
| 2026-07-24 | 多租户登录功能 PRD(仅 S1) | team-lead 代 pm | `team-workspaces/pm/multi-tenant-login-prd.md` | 见下详;6 项待确认未收敛 | 无 subagent 派发工具,team-lead 直接代 pm 产出 |

## 2026-07-24 多租户登录功能 PRD(S1 单阶段)

- **用户原始需求**: 派 pm 产出一"多租户登录功能"的简短 PRD;不拉完整 5 阶段流水线。
- **5 阶段执行**: 仅执行 S1(需求澄清);S2-S5 未启动(单阶段文档任务,裁剪符合协议 §4 例外)。未进 S2 因 S1 gate 未满足(仍有未决待确认)。
- **派单**: 本会话工具集无 subagent 派发能力(无 Agent/Task 子代理工具),按 team-lead "单点小任务直接自己做"原则,team-lead 直接代 pm 产出,遵循 pm 启动协议与产出约定。**已就此向用户说明**。
- **产出物**: `~/.claude/team-workspaces/pm/multi-tenant-login-prd.md`(PRD v0.1 草稿)。
- **契约路径**: 无(S2 未启动)。
- **待确认路由记录**(均为 pm 首轮提出,尚未路由/未答复):
  - 【待确认→user】Q1 租户识别方式(子域名/独立域名/路径/邮箱推断)
  - 【待确认→backend】Q2 租户隔离模型(物理库/共享库+tenant_id/独立 schema)
  - 【待确认→user】Q3 登录方式 MVP 范围(验证码/SSO 是否进 MVP)
  - 【待确认→backend】Q4 会话/租户上下文契约
  - 【待确认→backend】Q5 防越权实现层
  - 【待确认→user】Q6 多租户成员切换是否进 MVP
  - 状态: 第 1 轮,待 user 决策落地后,Q2/Q4/Q5 路由 backend 一次答复。
- **关键决策及理由**: PRD 对关键设计点(识别方式/隔离模型/登录方式/会话/安全)均给选项与 pm 倾向而非定死,理由=用户要求"让 pm 给选项和待确认项,不擅自定死"。
- **风险**: (1) 待确认未收敛前不能进 S2,流水线会在此卡住;(2) team-lead 代 pm 产出而非独立 pm agent,后续若恢复 subagent 能力需复核此 PRD 是否符合 pm 角色范式。

## 2026-07-24 多租户登录 PRD 续:user 拍板 + backend 答复 + S1 收敛

- **user 拍板(产品决策收敛)**:
  - Q1 租户识别方式 → 路径方式 `app.com/:tenantId`(理由:MVP 最小原型、localhost 可跑;子域名留后续演进)。
  - Q3 登录方式 MVP 范围 → 仅账号密码(验证码/SSO 不进 MVP)。
  - Q6 多租户成员切换 → 不进 MVP(一用户一租户)。
- **backend 路由(第 1 轮,单点代理产出)**: 因无 subagent 派发能力,team-lead 遵 backend 启动协议直接以 backend 视角答复 Q2/Q4/Q5(标注"单点代理产出"):
  - Q2 租户隔离模型 → **共享库 + tenant_id 行级隔离**。匹配"路径+一用户一租户"MVP,成本最低、开通=加行;代价=隔离依赖应用层强制(Q5),需防泄漏测试;未来可演进独立 schema/库,无物理隔离边界。
  - Q4 会话/租户上下文契约 → **不透明 session id**(服务端 session store 存 {userId, tenantId,...}),客户端不可篡改租户,登出/吊销简单(优于自包含 JWT)。tenantId 由路径取并校验=用户所属租户。切换留口:预留 active tenant + 可访问列表 claim,切换=重签;MVP 不暴露端点。
  - Q5 防越权实现层 → **分层防御**:路由/网关(path≠token 即拒)+ 中间件(解析 tenantId 挂上下文、复核 path)+ **ORM/仓储全局行级过滤(主防线,强制 tenant_id 谓词,绕过需 opt-in 审计)** + 可选 Postgres RLS 兜底。不靠前端。
- **backend 是否反抛新待确认**: 否。三项均给出明确方案,无新未决项。
- **S1 gate 判定**: 6 项待确认全部收敛(Q1/Q3/Q6 user 拍板;Q2/Q4/Q5 backend 答复且无新未决)→ **"无未决待确认"满足,S1 收敛,可进 S2 契约定义**。
- **路由轮次**: user 决策 1 轮收敛;backend 1 轮收敛。未触发 3 轮仲裁。
- **PRD 更新**: 文件升 v0.2,§4 各节由"选项/→X 定"改为"已确认(决策方): 结论";§3 边界、§5 验收项 5(切换改后续非 MVP)、§6 收敛表同步。
- **S2 契约落盘计划(暂不真落文件)**: 待进 S2 时,由 backend 在 `~/.claude/team-memory/shared/contracts/multi-tenant-login-api.md` 落契约,含:
  - `POST /api/:tenantId/login` {username,password} → 200 {token(不透明 session id), user:{id,tenantId}, expiresAt} / 401(凭据错或租户不匹配)。
  - 鉴权: `Authorization: Bearer <token>`;backend 解析 tenantId 挂请求上下文 + 复核 path。
  - `POST /api/logout` → 吊销 session。
  - 错误码: 401(未认证/凭据错/租户不匹配)、403(跨租户越权)、404(资源不在本租户)。
  - session store schema: {sessionId, userId, tenantId, createdAt, expiresAt, revokedAt}。
- **风险更新**: (1) 共享库行级隔离无物理边界,隔离正确性 100% 依赖 ORM 强制层,Q5 实现 + 测试是安全关键路径;(2) team-lead 单点代 pm/backend 产出,后续恢复 subagent 能力需复核;(3) 切换/SSO 后续引入时契约需向前兼容(已留口)。

## 2026-07-24 S2 契约定义(user 启动 S2)

- **user 决策**: 启动 S2,把 S2 落盘计划真落为可联调契约。
- **既有约定排查**: 落盘前查 team-memory——shared/contracts 空、无既有契约模板;backend 唯一沉淀记忆 job-filler-server(浏览器扩展 /parse /fill 端点,领域不同)无 envelope/错误码/时间格式约定可沿用。结论:本契约自定约定并注明(无既有约定,不另起炉灶前提不成立)。
- **派单**: 无 subagent 工具,team-lead 遵 backend 启动协议直接产出并落盘(标注"单点代理产出 S2 契约")。
- **产出物**: `~/.claude/team-memory/shared/contracts/multi-tenant-login-api.md`(v1.0),并更新 `shared/_index.md` 索引。
- **契约要点**: login/logout/鉴权/租户复核(path≠token→403)/错误码表(401 INVALID_CREDENTIALS 与 TENANT_MISMATCH 对外折叠同文案防探查;403/404/429 预留)/session store schema/一用户一租户对契约影响(username 租户内唯一、登录复核归属)/通用约定(camelCase、ISO8601/UTC、自定 envelope、幂等)。
- **新增待确认(契约级,第 1 轮,未路由)**:
  - 【待确认→user】envelope 沿用(是否以本契约自定形态为项目首个基准)
  - 【待确认→user】session store 选型(DB 表 vs Redis,backend 倾向 DB)
  - 【待确认→user】登录限流是否进 MVP 及阈值(429 预留)
  - 【待确认→frontend】失败 UI 文案与 429/403 呈现
- **S2 gate 判定**: 主链路(login/logout/鉴权/错误码)字段定齐、可联调;4 项待确认属实现细节,不影响主链路联调但影响实现。**判 S2 gate 基本达成但带未决项**:严格按"无未决待确认"则未完全收敛,因待确认不阻塞主链路联调,team-lead 判"可进 S3 联调,但 4 项待确认需在 S3 实现前收敛(尤其 envelope/限流影响实现)"。是否强行等全部收敛再进 S3,交 user 定(见返回)。
- **路由轮次**: 新抛 4 项第 1 轮,尚未路由;未触发仲裁。
- **不进 S3**: 遵 user 指令,S2 落盘+gate 判定即停,等下一步指令。
- **风险**: (1) envelope 未拍板前若前后端各按自己理解实现会返工,建议 S3 前收敛;(2) 限流是否进 MVP 影响安全基线,建议早定;(3) 单点代理产出,后续复核。

## 2026-07-24 S2 严格收敛 + scaffold 骨架

- **user 三组决策**: (一)收敛契约 4 项;(二)scaffold ~/saas-erp 骨架(api/web);不进 S3。
- **契约 4 项收敛(落 multi-tenant-login-api.md v1.1)**:
  - Q-1 envelope → 已确认/user: **项目首个契约基准**(成功裸对象 + 错误 `{error:{code,message,details}}`),前后端按此联调。**本笔作为 envelope 基准决策**。
  - Q-2 session store → 已确认/user: = **DB 表**(与业务库同事务);Redis 不进 MVP。
  - Q-3 限流 → 已确认/user: **进 MVP**,5 次/60s·(tenantId+ip),超限 `429 RATE_LIMITED`;实现(内存窗口 vs 中间件)属 S3。
  - Q-4 失败 UI → 已确认/frontend: 直接展示 message;429/403 特定 UI;交互细节 S3 frontend 定。契约 §4.1 记 code→UI 映射。
  - §9 更新: **S2 严格 gate 达成(无未决待确认),可进 S3**。
- **scaffold(~/saas-erp,单点代理产出)**:
  - 顶层: .gitignore / README.md / git init + 初始 commit "chore: scaffold saas-erp monorepo skeleton"。**git remote 暂不设**(用户 GitHub `https://github.com/Mryang123456` 疑似 profile 页非 repo URL,且当前网络 push 不稳),待网络恢复 + 用户补完整 repo URL 后 add origin & push。
  - api(TS+Express+SQLite): package.json(deps express/cors/dotenv/better-sqlite3/argon2/zod;devDeps tsx/typescript/@types/*;选型理由见 api/README)、tsconfig、src/{server,routes/auth,middleware/auth,middleware/rateLimit,db/index,db/schema.sql,config}.ts、.env.example、README。占位+TODO 引契约,不写真实现。
  - web(React+TS+Vite,手搭等价骨架): package.json/vite.config.ts(proxy /api→:3000)/tsconfig/index.html/src/{main,App,pages/Login,api/client,components/*}.tsx、.env.example、README。占位+TODO 引契约。
  - 选型标注"可改": api/backend TS(与前端一致)、sqlite 驱动 better-sqlite3(同步、MVP 简单)、密码 argon2(若 native 装失败 fallback node crypto.scrypt)。
  - npm 依赖: 探测 registry 可达(NPM_ONLINE),尝试 npm install;结果见回报。
  - **安装实测结果**: web 装齐(70 包,package-lock 已生成,exit 0)。api 装约 28 分钟后 better-sqlite3 原生 `node-gyp rebuild` 挂起(0% CPU、无 build 产物、疑 node 头下载卡住),已 kill(exit 144);纯 JS 包(express/argon2[prebuilds]/zod/cors/dotenv/tsx/typescript/@types)已落(node_modules 118 项),但 better-sqlite3 原生二进制未构建、`api/package-lock.json` 未生成。S3 处置见 `api/README.md`「依赖状态」(重试/prebuild 标志/fallback node:sqlite 或 sqlite3),契约不受影响。
- **路由轮次**: 契约 4 项第 1 轮即收敛(user/frontend 直答);未触发仲裁。
- **不进 S3**: 遵 user 指令,scaffold 完即停;S3 由主会话方案 A 并行派 backend+frontend(本 agent 不动)。
- **风险**: (1) remote 未设,代码暂只在本地;(2) 依赖若装不上需网络恢复后补 npm install(不阻塞写码);(3) 单点代理产出骨架,后续 S3 实现需复核占位与契约一致。

## 2026-07-24 S3 并行实现完成 + logout 矛盾待仲裁

> 由主会话方案 A 派 backend(陈浩)/ frontend(张晨)实现;本 agent(team-lead)未下场写码,只汇总+判 gate+仲裁。归档为 decisions.md 续篇(不另建 s3-summary.md,遵"不写独立 summary 文件"约定)。

- **backend(~/saas-erp/api,陈浩)**: 严格按契约 v1.1 实现。server.ts(挂路由/cors/health/errorHandler envelope)/config.ts;db/index.ts(fallback `node:sqlite`,WAL+foreign_keys,schema init,幂等种子 2 租户 2 用户,MVP 约定 tenants.id==slug 免 join);db/repo.ts(行级隔离:tenant-scoped 查询 tenantId 必填形参,SQL 带 `AND tenant_id=?`);middleware/rateLimit.ts(键 tenantId:ip,60s/5 内存窗口,第 6 次 429);middleware/auth.ts(Bearer→findSessionById,有效判定 `revoked_at==null AND now<expires_at`,无效 401,挂上下文,path≠session.tenantId→403);routes/auth.ts(login:zod→查→argon2 verify+burnVerify 恒定耗时→写 sess_随机→200;logout:auth→revoke→204);errors.ts(ErrorCode§4+INTERNAL_ERROR 兜底/asyncHandler/errorHandler:ZodError→400+fields,json SyntaxError→400,500 兜底);audit.ts(JSON log 不记 secrets)。自测 7 curl 全过(① 登录 200 ② 密码错 401 ③ 租户不匹配 401 对外折叠+内部 TENANT_MISMATCH 审计 ④ 限流第 6 次 429 ⑤ 跨租户 path≠token→403 ⑥ logout→204 ⑦ 登出后旧 token→401);边缘 400 zod/400 malformed/401 no-token/404 unknown 全过。tsc 0 错。fallback: better-sqlite3→`node:sqlite`(启用,native 未构建,补 ambient 类型);argon2 未 fallback(prebuilds ok)。test 脚本 TODO(S3 用 curl)。dev.sqlite 留种子(qa 可删重建)。
- **frontend(~/saas-erp/web,张晨)**: api/client.ts(类型守卫无 as,envelope§0 解析,NETWORK_ERROR 兜底)/routeError.ts(code→UI 纯函数)/Login.tsx(三输入+格式校验+限流倒计时+a11y)/ErrorBanner/RateLimitNotice(250ms 倒计时)/TenantMismatchNotice/App.tsx(态切换+sessionStorage hydrate+logout 失败也 finally 强制登出)。自测 typecheck 0/build 0(32 modules)/test 14 过(错误码→Notice 路由双重覆盖)。token 权衡: sessionStorage(MVP)/httpOnly cookie(生产)。无待拍板。
- **契约对齐**: 双方均对齐 v1.1;envelope(§0)、错误码(§4)、状态码消费(§4.1)、限流(§7)、session schema(§5)、租户复核(§2)逐项落实。
- **logout 幂等矛盾(契约§3 自相矛盾,待 user 仲裁)**:
  - §3 注记: 已吊销 session 再登出→204(不报错)。
  - §3 step1(鉴权同§2)+§3 step3(下次请求 §2 步1 拒)+§2 step1(`revokedAt != null`→401)→ 已吊销→401。
  - 即注记说 204,step1/step3/§2 说 401(3 处 vs 1 处)。backend 选 401。
  - **本 agent 独立复核代码确认**: auth.ts `authMiddleware`(L33-36)对 `revoked_at!==null` 抛 401,在 logout handler 之前执行 → 已吊销 token 再登出**实际就是 401**;routes/auth.ts L118 注释"幂等:已吊销再登出也 204"为**不可达死注释**,与契约§3 注记同源过时。
- **team-lead 独立仲裁意见(第 2 意见,帮 user 拍板)**: **同意 401**。理由:
  1. 多数一致:§2/§3 step1/§3 step3 + 实际 authMiddleware 代码(4 处)均 401,唯§3 注记(1 处)说 204,疑起草笔误。
  2. 安全:401 对"从未有效 token"与"曾有效已吊销 token"**同体**(均 401 UNAUTHENTICATED),不泄露;若 204-for-revoked 则两者可区分(轻微枚举泄漏),可避免故应避免。
  3. 语义:logout 是受保护端点,需有效 token,无效(含已吊销)→401,与其余受保护端点一致;204-for-all(含从未有效)语义怪且跳过 403 路径复核。
  4. 幂等性不要求 204:重复登出每次都返同一 401,状态不变,本即幂等(effect idempotent)。
  5. UX 已在客户端解决:App.tsx finally 块对 logout 失败(含 401 重试)强制本地登出,"重试得 success"的体验诉求由前端层吸收,无需放松服务端语义。
  - **落地动作(若 user 定 401)**: 修契约§3 注记自洽(改"已吊销→204"为"已吊销→401,与§2 一致;logout 需有效 token")+ 修 auth.ts L118 死注释。**均 doc/注释级,无逻辑改动,backend 代码不动**(已是 401)。若 user 定 204:backend 需在 logout 前置跳过 authMiddleware 的 revoked 判定(或特例)+ frontend 调整,再进 qa。
- **S3 gate 判定**: 协议§4 S3 gate="各自 frontend/backend-review 通过"。双方均自检过(backend tsc 0+7 curl+边缘;frontend typecheck/build/test 0)+契约对齐 → **S3 实现 gate 达成**。但 qa 启动前需 logout 仲裁落地(qa 需确定性验收 oracle):仲裁=401(我+backend 推荐)→ qa 可立即进(仅需 doc 级修契约注释+auth.ts:118 注释,不阻塞);仲裁=204 → backend+frontend 改逻辑后进 qa。
- **路由轮次**: logout 矛盾第 1 轮,backend 已表态(401)+ team-lead 第 2 意见(同意 401),交 user 仲裁落地。未达 3 轮上限。
- **约束**: 不进 qa(qa 由 user 派)、不动 S3 实现代码,等 user 仲裁结果落地后再继续。
- **风险**: (1) logout 仲裁未落地前不能进 qa;(2) auth.ts:118 死注释与契约§3 注记同源,若不同步清理会持续误导;(3) better-sqlite3 native 未构建,qa 联调前需确认 node:sqlite fallback 可用(backend已启用);(4) dev.sqlite 留种子,qa 用例需可控删重建。

## 2026-07-24 logout 仲裁落地(401,四方一致,第 1 轮收敛)

- **user 拍板**: logout 幂等性定 **401**。四方一致(user + backend + 主会话 + team-lead),第 1 轮收敛,未触发 3 轮仲裁上限。
- **team-lead 第 2 意见**: 同意 401(见上节,理由:多数一致+代码佐证+安全不泄露+语义一致+effect idempotent+UX 客户端已吸收)。
- **代码佐证(独立复核)**: `auth.ts` `authMiddleware`(L33-36)对 `revoked_at!==null` 抛 401,在 logout handler 前执行 → 已吊销 token 再登出本就是 401;原 `routes/auth.ts:118` 注释"幂等:已吊销再登出也 204"为不可达死注释,与契约§3 注记同源过时。
- **落地动作(doc/注释级,backend 逻辑代码不动)**:
  - 契约 `multi-tenant-login-api.md` §3 幂等注记改自洽——原"对已吊销 session 再请求登出→204(不报错)"改为"对已吊销/无效 session 再请求登出→401 UNAUTHENTICATED(与§2 一致),重复登出每次返同一 401、状态不变即 effect idempotent;204 仅首次有效登出,非有效 token 一律 401 防枚举"。§3 step1/step3 不变(本就说 401)。§9 无 logout 自评项(S2 gate 自评),无需标。
  - `api/src/routes/auth.ts:118` 死注释改为"幂等:重复登出返同一 401,状态不变(effect idempotent);已吊销/无效 token→401 与§2一致(由 authMiddleware 在本 handler 前拦截)"。
- **实现侧就绪进 qa 状态**: **就绪**。双方实现完成 + 自测过(backend tsc 0/7 curl/边缘;frontend typecheck/build/test 0)+ 契约自洽(logout 矛盾已落地 401,契约与代码注释一致)。better-sqlite3 native 未构建但 backend 已 fallback `node:sqlite`(启用),qa 联调前需确认 fallback 可用(已知风险,不阻塞)。
- **约束**: 不进 qa(qa 由 user 派)、不碰 qa 测试代码。等 user 派 qa。

## 2026-07-24 S4 qa 通过 + 最终 gate 判定 + D-1 补改 + D-2 待拍板

- **qa 结论(消息传递,未落 qa workspace)**: S4 gate 通过——55/55 全过,P0/P1=0,跨租户安全无越权/泄漏。过程观察:qa 报告以消息回报,未写 `~/.claude/team-workspaces/qa/`(该目录空),追溯弱;建议后续 qa 报告落盘。
- **缺陷清单 D-1~D-7(qa 报告权威;本日志记已知项,D-4/D-6 细节见 qa 报告)**:
  - D-1 文本同步(契约§0 残留 logout 204): P2 不阻塞。**已补改**(见下)。
  - D-2 TENANT_NOT_FOUND 张力: P2。§4 列 404 + §4.1 登录入口可展示,但 backend login 不查租户存在性(未知租户→无用户→401 INVALID_CREDENTIALS 折叠),前端 routeError 映射成死代码。**待 user 拍板**(见下)。
  - D-3 CORS 收紧: 生产 must-fix(backend P3,本轮不处理)。当前 `cors()`(本地 *,参考 backend 记忆 job-filler-server:CORS=* 本地可、生产不应暴露)。
  - D-5 backend P3(细节见 qa 报告,本轮不处理)。
  - D-7 业务端点 tenant-scoped: 生产 must-fix(backend P3,本轮不处理)。当前仅 login/logout/health,业务端点待加且须挂 auth + 行级过滤。
  - D-4 / D-6: 见 qa 报告(本日志未展开细节)。
- **D-1 残留补改对账(team-lead 执行)**: 读契约 §0+§3+auth.ts:118——§3(L97)与 auth.ts:118 已正确改为 401 effect idempotent;**§0 L26 仍残留"登出幂等(对已吊销 session 再登出返 204,不报错)"(上轮漏改)**,现补改为"登出 effect idempotent——重复登出返同一 401(已吊销/无效 session,与 §2/§3 一致),状态不变(见 §3)"。至此契约内"已吊销→204"残留全部清零(§0+§3 一致 401),auth.ts:118 一致。backend 逻辑未动。
- **D-2 team-lead 独立意见(第 2 意见,待 user 拍板)**: **同意 401(防探查)**——删 §4 TENANT_NOT_FOUND 行 + §4.1 死映射,backend 代码不改。理由:(1) 不变量一致:login 全流以"折叠 401"防探查(USER_NOT_FOUND/TENANT_MISMATCH/PASSWORD_MISMATCH 对外同 INVALID_CREDENTIALS),TENANT_NOT_FOUND(404 登录入口可展示)是唯一破口,独立于凭据泄漏租户存在性;(2) 安全:404-at-entry 允许无凭据枚举有效租户 slug(定向攻击侦察前置);(3) 死代码风险:§4 行+§4.1 映射当前死(backend 不发、前端不可达),死契约行诱导未来 dev"实现"而重新引入泄漏;(4) 与 logout 401 同一防探查哲学;(5) UX 取舍:401-ambiguous(租户错/密码错不分)MVP 接受,后续强需则限流+邮箱前置查询(非 MVP)。落地(若 user 定 401):删 §4 该行+§4.1 映射行;backend 不动;frontend 删 routeError 死映射。若 user 定保留 404:backend 需前置查租户存在性+接受枚举泄漏(与 §7 冲突,不推荐)。**未改,待 user 拍板。**
- **最终 gate 判定**:
  - 本地发布 gate: **通过**(P0/P1=0,D-1/D-2 是 P2 不阻塞;D-1 已补改,D-2 待拍板不阻塞本地基线)。55/55 测试 + 跨租户安全无越权/泄漏。
  - 生产 gate: **待 4 项 must-fix**:D-1 文本同步(✓ 已补改)、D-2 拍板落地(待 user)、D-3 CORS 收紧(backend P3)、D-7 业务端点 tenant-scoped(backend P3)。
- **commit 时机建议(给 user 参考)**: 主会话倾向"等 D-2 拍板 + D-1 补改落地一起 commit 作干净基线";亦可"现在 commit qa 测过的版本作基线"。team-lead 补充:当前 S3 实现 + 各轮 doc/注释改全部未提交(仅 `011e30f` scaffold),无论哪种时机都需尽快 commit 以免工作树累积;若 D-2 短期内能拍板,等一并 commit 更干净;若 D-2 拖延,先 commit qa 过的基线(含 D-1 补改)保快照更稳,后续 D-2/D-3/D-7 作为新 commit 增量。
- **约束**: 不进修复(D-3/D-5/D-7 属 backend 后续 P3,不在此轮处理);不动 qa 测试代码。等 user:① D-2 拍板;② 决定 commit 时机。
- **风险**: (1) qa 报告未落盘 qa workspace,仅消息传递,追溯弱;(2) S3+各轮改动全未提交,工作树累积;(3) D-2 未定前若有人据 §4 实现 TENANT_NOT_FOUND 会引入枚举泄漏;(4) D-3/D-7 未做,生产不可直接上。

## 2026-07-24 D-2 落地(401,五方一致,第 1 轮收敛)

- **user 拍板**: D-2 TENANT_NOT_FOUND 张力定 **401**(防探查)。五方一致(user + backend + 主会话 + qa + team-lead),第 1 轮收敛。
- **team-lead 第 2 意见**: 同意 401(见上节:折叠-401 不变量一致 + 防租户 slug 枚举 + 删死代码 + 与 logout 同哲学)。
- **落地动作(doc/映射/测试级,backend 逻辑不动)**:
  - 契约 `multi-tenant-login-api.md` §4 错误码表:删 `TENANT_NOT_FOUND`(404)行。
  - 契约 §4.1 前端状态码消费约定:删 `TENANT_NOT_FOUND → 登录入口可提示` 映射行。
  - `web/src/lib/routeError.ts`:删注释中 TENANT_NOT_FOUND 引用(无实际 switch/map 分支,本就走默认 banner);**`ErrorCode.TENANT_NOT_FOUND` 常量保留**(避免 client.ts 类型连锁改,无害)。
  - `web/src/__tests__/Login.routing.test.tsx`:删 cases 数组中 `TENANT_NOT_FOUND → ErrorBanner` 用例(死 code 场景,backend login 永不发该 code)。routeError 纯函数测试 loop 仍引用保留的常量(→ banner,仍过,未动);describe 块未空(余 success + 其他 code + 格式校验 + routeError 块)。
  - backend: 不动(login 早已 401 INVALID_CREDENTIALS 折叠)。
- **契约自洽**: §4/§4.1 与 impl 一致——login 未知租户→无用户→401 INVALID_CREDENTIALS(折叠,§7 防探查);TENANT_NOT_FOUND 死 code 已从契约/映射/测试清除,常量保留作向后兼容类型占位。
- **约束**: 不 commit(等 qa 回归后一起 commit 干净基线)、不进 qa。下一步:qa 快速回归 → commit → S5 收口。
- **风险更新**: (1) `ErrorCode.TENANT_NOT_FOUND` 常量保留,若未来 dev 误据此发该 code 会重新引入枚举(impl 不发,仅类型占位);(2) D-3/D-7 仍待 backend P3;(3) 仍未 commit。

## 2026-07-24 S5 收口(全程里程碑 + commit 基线 + 最终 gate + 交付物 + 后续)

- **全程里程碑**:
  - S1 需求澄清: PRD v0.2(pm;Q1/Q3/Q6 user 拍板 + Q2/Q4/Q5 backend 答复,6 项待确认收敛)。
  - S2 契约定义: 契约 v1.1 严格收敛(envelope 基准 / session=DB 表 / 限流进 MVP / 前端状态码消费;Q1~Q4 全收敛)。
  - scaffold: `~/saas-erp` monorepo `git init` + 初始 commit `011e30f`(api TS+Express+SQLite / web React+TS+Vite 骨架)。
  - S3 并行实现: 主会话方案 A 派 backend(陈浩)+ frontend(张晨);backend 7 curl+边缘自测、frontend typecheck/build/test 13 过、tsc 0。fallback `node:sqlite`(better-sqlite3 native 未构建)、argon2 prebuilds。
  - S4 集成验证: qa 55/55 全过,P0/P1=0,跨租户安全无越权/泄漏。
  - 仲裁(均第 1 轮收敛,五方一致): logout 幂等→401 effect idempotent(防枚举);TENANT_NOT_FOUND→删 401 折叠(防探查不泄漏租户存在)。
  - 回归: qa 12/12 自洽零回归;S4 报告落盘 `~/.claude/team-workspaces/qa/multitenant-login-test-report.md`。
  - commit 干净基线: `fcadcaf feat: 多租户登录 MVP 实现(S3)+ 仲裁落地`(26 文件,+5682/-166)。
- **commit 基线哈希**: `fcadcaf`(full `fcadcaff62086019b4aba4a75c3c34929f06931d`)。两 commit:`011e30f`(scaffold)+ `fcadcaf`(S3 基线)。工作树干净。**remote 未设**(用户 GitHub `https://github.com/Mryang123456` 疑 profile 页 + 网络问题;待补完整 repo URL + 网络恢复后 `git remote add origin <url> && git push -u origin main`)。
- **最终 gate**:
  - 本地发布 gate: **通过**(P0/P1=0,55+12 测试,跨租户安全,D-1/D-2 落地)。
  - 生产 gate: 待 must-fix:D-3 CORS 收紧(backend P3)、D-7 业务端点 tenant-scoped(backend P3);D-1✓ / D-2✓ 已落地。
  - P3 遗留:D-4 / D-5 / D-6(细节见 qa 报告)。
- **最终交付物清单**:
  - PRD: `~/.claude/team-workspaces/pm/multi-tenant-login-prd.md`(v0.2)
  - 契约: `~/.claude/team-memory/shared/contracts/multi-tenant-login-api.md`(v1.1;§3 logout 401 / §4 删 TENANT_NOT_FOUND / §0 幂等自洽)
  - 代码: `~/saas-erp`(api + web,commit `fcadcaf`)
  - 测试: backend 7 curl+边缘(见 `api/README.md`);frontend vitest 13(`web/src/__tests__/`)
  - qa 报告: `~/.claude/team-workspaces/qa/multitenant-login-test-report.md`(55/55 + 12 回归)
  - 决策日志: `~/.claude/team-memory/team-lead/decisions.md`(全程可追溯)
- **后续与风险**:
  - P3 排期建议:D-3(CORS 生产收紧,上线前)、D-7(业务端点 tenant-scoped,随首批业务接口)、D-4/D-5/D-6 按 qa 报告优先级。
  - remote push 待网络恢复 + user 补完整 repo URL(`https://github.com/<user>/<repo>.git`)。
  - better-sqlite3 native 未构建,backend 跑 `node:sqlite` fallback;若长期用 node:sqlite 可移除 better-sqlite3 依赖。
  - `ErrorCode.TENANT_NOT_FOUND` 常量保留(类型占位),impl 不发,注意勿据此重新引入枚举。
  - 本会话无 subagent 派发工具,pm/backend 仲裁意见由 team-lead 代产、backend/frontend 实现由主会话派 subagent;后续恢复完整 subagent 能力可复核范式。
- **S5 gate**: 用户确认(本 agent 收口产出,等 user 确认闭环)。
