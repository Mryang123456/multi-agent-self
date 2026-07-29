---
name: saas-erp-api
description: saas-erp 多租户登录后端(TS/Express/node:sqlite/argon2)架构要点与已知坑。当涉及 ~/saas-erp/api 的 login/logout/鉴权/限流、node:sqlite fallback、§3 logout 幂等矛盾时相关。
type: project
status: active
---

# saas-erp/api 后端架构

## 选型与 fallback(2026-07-24 实测)
- better-sqlite3 native `.node` 在本机未构建(npm install 挂起 28min,node-gyp 卡 node 头下载)→ fallback Node22 内置 `node:sqlite`(实验性,stderr 一条 ExperimentalWarning 不影响)。补丁在 `src/db/index.ts`,ambient 类型在 `src/types/node-sqlite.d.ts`(@types/node≥22 后可删)。
- node:sqlite vs better-sqlite3:无 `.pragma()`(用 `exec("PRAGMA journal_mode=WAL")`)、无 `prepare().changes`(本实现不依赖)、`.get()` 空结果返 `undefined`(同 better-sqlite3,`!row` 判空 OK)、命名参 `$x` 传 object、位置参 `?` 传散列。多语句 `exec` OK。
- argon2 有 prebuilds,正常(`$argon2id$`),未 fallback。

## 架构要点
- envelope(契约§0,项目基准):成功裸对象,错误 `{error:{code,message,details?}}`。统一在 `src/errors.ts`(errorHandler 转 ZodError→400+fields、express.json SyntaxError→400、ApiError→对应码、兜底 500 INTERNAL_ERROR 非§4码)。
- MVP 约定 **tenants.id==slug**:session/user 的 tenant_id 直接即 path slug,免 id↔slug join;`slug` 列保留(冗余但任务要求)。后续若 admin 端点建 id≠slug 的租户,需在 auth 加 slug 解析。
- 行级隔离(§2.4/§4.5):repo 的 tenant-scoped 查询把 tenantId 作必填形参(TypeScript 强制传),业务查询 SQL 带 `AND tenant_id=?`;登录按 username 跨租户查、鉴权按 session PK 查为例外(契约允许)。
- 限流(§7):键 `${tenantId}:${ip}`(req.params.tenantId + req.ip),内存固定窗口 60s/5,count>max 拒第6次→429;`setInterval` unref 清桶。
- 审计:console.log JSON,字段 ts/event/userId/tenantId/realTenantId/ip/username/reason;不记 secrets。

## 已知坑 / 待仲裁
- **§3 logout 幂等性契约内部矛盾**:step1"鉴权流程同§2(revoked→401)"+step3"下次请求§2步1拒"vs 幂等注记"已吊销再登出→204(不报错)"。brief 同样自相矛盾(impl 行 204 vs 自测⑦ 401)。S3 选 **401**(过 brief 自测⑦闸 + §2/§3step1/step3 多数 + 更安全),flag §3 幂等注记【待确认→team-lead】仲裁。若判 204:auth 加 `allowRevoked` flag,logout 用之,revoked-非过期 放行→204。
- TENANT_NOT_FOUND(§4)定义但 login 不发(§1 失败列表无404;未知租户→无用户→401 INVALID_CREDENTIALS),预留给未来租户预检端点。

## 关联
- 契约:`~/.claude/team-memory/shared/contracts/multi-tenant-login-api.md` v1.1。
- PRD:`~/.claude/team-workspaces/pm/multi-tenant-login-prd.md` v0.2。
- 自测详见 `backend/memory/2026-07-24.md`。
