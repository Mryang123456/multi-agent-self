---
name: multi-tenant-login-api
description: 多租户登录功能后端接口契约(登录/登出/鉴权/租户上下文/错误码/session store)。前后端联调单一事实源。MVP:路径租户识别 + 账密 + 一用户一租户 + 共享库 tenant_id 行级隔离。
type: project
status: active
produced_by: backend
---

# 多租户登录接口契约 v1.1

> 日期: 2026-07-24 | 产出: backend(S2,单点代理产出) | 关联 PRD: `~/.claude/team-workspaces/pm/multi-tenant-login-prd.md` v0.2
> 适用 MVP 范围:路径方式租户识别(`app.com/:tenantId`)、仅账密登录、一用户一租户、不做租户切换。
> v1.1 变更: §8 四项契约级待确认全部收敛(envelope 基准 / session store=DB 表 / 限流进 MVP / 前端状态码消费)。

## 0. 通用约定

- **传输**: HTTPS(MVP 本地 localhost 可裸 HTTP)。请求/响应体 `application/json`;UTF-8。
- **字段命名**: 请求/响应字段统一 **camelCase**(`tenantId`、`expiresAt`)。DB 列名 **snake_case**(`tenant_id`、`expires_at`),仓储层做映射。
- **时间格式**: 一律 **ISO 8601 / UTC**,带 `Z`(如 `2026-07-24T12:00:00Z`)。时间戳类字段(createdAt/expiresAt/revokedAt)统一此格式。
- **响应 envelope(项目首个契约基准,已确认/user)**: 成功响应直接返回业务对象(如 `{token, user, expiresAt}`),HTTP 状态码表语义;错误响应统一为
  ```json
  { "error": { "code": "<ERROR_CODE>", "message": "<面向用户的可展示文案>", "details": { /* 可选,机器可读补充,不泄露敏感信息 */ } } }
  ```
  `message` 文案须安全(不泄露账号是否存在,见 §4)。**前后端均按此形态联调,作为项目 envelope 基准**(见 decisions.md 该笔决策)。
- **分页**: 本期登录/登出接口不分页。后续列表接口(如租户成员)采用 `?page=1&pageSize=20`,响应 `{ items, page, pageSize, total }`(预留,本期不实现)。
- **幂等**: 登录非幂等(每次签发新 session);登出 effect idempotent——重复登出返同一 401(已吊销/无效 session,与 §2/§3 一致),状态不变(见 §3)。
- **租户路径参数**: `:tenantId` 为租户 slug/短标识(如 `acme`),全小写、`^[a-z0-9][a-z0-9-]{1,63}$`。path 与 token tenantId 须一致(见 §2、§4)。

## 1. POST /api/:tenantId/login

账号密码登录,签发不透明 session。

**请求**
- Path: `:tenantId`
- Header: `Content-Type: application/json`
- Body:
  ```json
  { "username": "alice", "password": "••••••" }
  ```
  - `username`: 必填,1~64 字符。MVP 不约束邮箱/手机格式(账密登录)。
  - `password`: 必填,明文传输(依赖 HTTPS),服务端用 argon2/bcrypt 存储。长度 8~128。

**处理**
1. 取 path `:tenantId`。
2. **限流前置(已确认/user,见 §7)**: 键 `tenantId+ip`,窗口 60s,阈值 5,超限即拒 `429 RATE_LIMITED`。
3. 按 `(username)` 查用户(用户名在租户内唯一,见 §6);若不存在或密码不匹配 → `401 INVALID_CREDENTIALS`。
4. 校验 `user.tenantId == path :tenantId`;不等 → `401 TENANT_MISMATCH`(但对外响应与 INVALID_CREDENTIALS 同文案,见 §4,防探查)。
5. 写 session store(见 §5):`{sessionId(新), userId, tenantId, createdAt, expiresAt, revokedAt:null}`。
6. 返回 token(= sessionId,不透明,无业务语义)、user、expiresAt。

**成功 200**
```json
{
  "token": "sess_8f3c...opaque",
  "user": { "id": "u_123", "tenantId": "acme" },
  "expiresAt": "2026-07-24T14:00:00Z"
}
```
- `token`: 不透明 session id 字符串,客户端仅作 Bearer 凭证,不解析。
- `user.id`: 用户标识。
- `user.tenantId`: 必等于 path `:tenantId`。
- `expiresAt`: session 过期时间;客户端可据此做续期/重登提示。

**失败**
- `401` `INVALID_CREDENTIALS`(凭据错)或 `TENANT_MISMATCH`(租户不匹配)——**两者对外响应体完全相同**:
  ```json
  { "error": { "code": "INVALID_CREDENTIALS", "message": "用户名或密码错误" } }
  ```
  即租户不匹配也回 `code: INVALID_CREDENTIALS`、同文案,不暴露"账号存在但租户不对"。内部日志可区分(见 §7),对外不可区分。
- `400` `INVALID_REQUEST`(缺字段/格式错)。
- `429` `RATE_LIMITED`(**已启用**,阈值 5 次/60s·(tenantId+ip),见 §7)。

## 2. 鉴权约定(所有受保护接口)

- 客户端在受保护请求带 `Authorization: Bearer <token>`。
- backend 中间件:
  1. 取 token,查 session store;无记录/已过期/`revokedAt != null` → `401 UNAUTHENTICATED`。
  2. 得 `session.tenantId`、`session.userId`,挂请求上下文(`req.tenantId`/`req.userId`)。
  3. **复核 path**: 若请求 path 含 `:tenantId` 且 `path.tenantId != session.tenantId` → `403 TENANT_FORBIDDEN`(跨租户越权,见 §4)。
  4. 后续业务查询由 ORM 全局行级过滤按 `req.tenantId` 强制带 `tenant_id` 谓词(见 PRD §4.5)。

## 3. POST /api/:tenantId/logout

吊销当前 session。

**请求**
- Path: `:tenantId`
- Header: `Authorization: Bearer <token>`

**处理**
1. 鉴权流程同 §2;未认证 → `401`。
2. 复核 path `:tenantId == session.tenantId`,不符才允许登出;不符 → `403 TENANT_FORBIDDEN`。
3. 置 `session.revokedAt = now`;旧 token 立即不可用(下次请求 §2 步 1 拒)。

**成功 204**: 无响应体。

**幂等(effect idempotent,已仲裁/user → 401)**: 对已吊销/无效 session 再请求登出 → `401 UNAUTHENTICATED`(与 §2 一致,logout 为受保护端点)。重复登出每次返同一 401、状态不变,即 effect idempotent。注:204 仅对首次有效登出;非有效(含已吊销)token 一律 401,不泄露"已吊销 vs 从未有效"(防枚举)。

## 4. 错误码表 + 前端状态码消费约定

| HTTP | code | 触发 | message(对外,安全) |
|------|------|------|----------------------|
| 400 | `INVALID_REQUEST` | 缺字段/格式错 | "请求格式错误" |
| 401 | `UNAUTHENTICATED` | 无 token / token 无效 / 过期 / 已吊销 | "未登录或会话已失效" |
| 401 | `INVALID_CREDENTIALS` | 登录凭据错 | "用户名或密码错误" |
| 401 | `INVALID_CREDENTIALS` | 登录租户不匹配(内部 `TENANT_MISMATCH`,对外折叠) | "用户名或密码错误" |
| 403 | `TENANT_FORBIDDEN` | path 租户 ≠ token 租户(跨租户越权) | "无权访问该租户" |
| 404 | `RESOURCE_NOT_FOUND` | 资源不在当前租户(或不存在) | "资源不存在" |
| 429 | `RATE_LIMITED` | 登录限流(已启用,5 次/60s·tenantId+ip) | "请求过于频繁,稍后再试" |

- **安全要点**: `INVALID_CREDENTIALS` 与 `TENANT_MISMATCH` 对外同体;`RESOURCE_NOT_FOUND` 对"不存在"与"属于别的租户"不可区分(防列举)。内部日志保留真实 code(`TENANT_MISMATCH`)便于审计(§7)。

### 4.1 前端状态码消费约定(已确认→frontend,契约侧记录;交互细节 S3 由 frontend 定)

| code | 前端 UI 处理 |
|------|-------------|
| `INVALID_CREDENTIALS` / `UNAUTHENTICATED` | 直接展示 `error.message` |
| `RATE_LIMITED` | 触发限流提示 UI(倒计时/"稍后再试"态,非裸 message) |
| `TENANT_FORBIDDEN` | 触发跨租户提示 UI(引导回正确租户/重登,非裸 message) |
| `INVALID_REQUEST` / `RESOURCE_NOT_FOUND` | 直接展示 `error.message` |

> 契约侧定 code→UI 映射基准;具体文案/倒计时样式/交互流由 frontend 在 S3 定。web 骨架已预留 ErrorBanner/RateLimitNotice/TenantMismatchNotice 占位组件对应此映射。

## 5. session store schema

存储:服务端 session store,**已确认/user = DB 表**(与业务库同事务,登出即时生效);Redis 不进 MVP,留后续横向扩展。

```
sessions {
  sessionId    string  PK        // 不透明,如 sess_<random>,无业务语义
  userId       string  index     // 所属用户
  tenantId     string  index     // 绑定租户(MVP 一用户一租户,= user.tenantId)
  createdAt    timestamp         // 签发时间 ISO8601/UTC
  expiresAt    timestamp         // 过期时间;过期的鉴权按 401 处理
  revokedAt    timestamp  null   // 登出置 now;null=有效
}
```

- **登录写入**: 新增一行,`revokedAt=null`,`expiresAt=now+TTL`。
- **登出**: 置 `revokedAt=now`(不删行,留审计)。
- **鉴权判定有效**: `revokedAt==null AND now<expiresAt`。
- **TTL**: 默认 2h(可配,见 config);续期策略 MVP 不实现。
- **索引**: `(userId)`、`(tenantId)` 便于按用户/租户审计与吊销。

## 6. "一用户一租户" MVP 约束对契约的影响

- 用户表 `users` 有 `tenant_id` 列;`username` 在**租户内唯一**(`unique(tenant_id, username)`),非全局唯一。故登录查询按 `(username)` 命中后必须复核 `user.tenantId == path.tenantId`。
- 一个用户 MVP 只能属于一个租户;`user.tenantId` 即其唯一归属。登录时 path 必须与归属一致,否则 `TENANT_MISMATCH`(对外折叠)。
- session 绑定单一 `tenantId`;MVP 不签发"多租户可访问列表"。后续多租户成员关系需扩 `user_tenants` 关系表 + session 预留 `accessibleTenantIds` + 切换端点,届时**向前兼容**:现 `tenantId` 字段语义不变,新增可选字段。本期契约不为切换留端点(仅 schema 留口)。

## 7. 安全与审计

- 密码:服务端 argon2/bcrypt 存储,不明文。
- 防探查:§4 错误码折叠;登录响应时序应避免用户名存在/不存在造成可观测时序差(建议恒定耗时或加随机抖动——实现细节,非契约强制)。
- 审计日志(内部,不外发):登录成功/失败、`TENANT_MISMATCH`、`TENANT_FORBIDDEN`、登出,记 `userId/tenantId/ip/ts/reason`。memory 文件不含 secrets(PROTOCOL §9)。
- **限流(已确认/user 进 MVP)**: 键 = `tenantId + ip`;窗口 = 60s;阈值 = 5;命中即拒 `429 RATE_LIMITED`。实现用内存滑动/固定窗口(MVP)还是中间件层属 S3 backend 实现范畴,契约只给约束。

## 8. 待确认(全部收敛)

- **Q-1 envelope → 已确认/user**: 以本契约自定形态(成功裸对象 + 错误 `{error:{code,message,details}}`)作为**项目首个契约基准**,前后端按此联调(记 decisions.md)。
- **Q-2 session store → 已确认/user**: = DB 表(与业务库同事务);Redis 不进 MVP。
- **Q-3 登录限流 → 已确认/user**: 进 MVP;5 次/60s·(tenantId+ip),超限 `429 RATE_LIMITED`。
- **Q-4 失败 UI → 已确认/frontend**: 直接展示 `error.message`;429 限流提示 UI、403 跨租户提示 UI;交互细节 S3 由 frontend 定(见 §4.1)。

> 其余实现细节(session TTL 默认值、密码哈希算法选型、CORS 生产策略、限流内存窗口实现)属 backend S3 实现范畴,契约只给约束不强行定死。

## 9. S2 gate 自评

- 可联调性: 登录/登出/鉴权/租户复核/错误码/session schema/限流约束/前端状态码消费链路完整,字段/格式/错误码定齐,前后端可据此分别开发联调。
- 未决: **无**。§8 四项契约级待确认全部收敛(Q-1/Q-2/Q-3 user,Q-4 frontend)。
- gate 判定: **S2 严格 gate 达成("无未决待确认"满足),可进 S3**。
