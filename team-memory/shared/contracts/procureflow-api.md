---
name: procureflow-api
description: ProcureFlow V1 前后端并行开发的单一事实源，定义模块化单体架构、数据模型、认证、RBAC/数据范围、REST API、状态机、幂等并发、事务、错误码、配置与种子数据。
type: project
status: active
produced_by: backend
---

# ProcureFlow API 契约 v1.0

> 日期：2026-08-08｜阶段：S2｜关联 PRD：`team-workspaces/pm/procureflow-v1-prd.md` v1.0
> 后端本地仓库：`procureflow/backend`｜前端本地仓库：`procureflow/frontend`
> 本文是 V1 接口、字段、权限、状态和错误码的单一事实源；两个代码仓库不得维护语义不同的副本。

## 1. 技术方案与边界

采用 TypeScript 模块化单体，不拆微服务：

- 前端：React 18、Vite、TypeScript、React Router、TanStack Query、Ant Design、Vitest、Playwright。
- 后端：Node.js 22 LTS、NestJS（Fastify adapter）、TypeScript、PostgreSQL 16、Prisma、Argon2id、Vitest/Supertest。
- 模块：`auth`、`organization`、`applications`、`approvals`、`audit`、`dashboard`、`health`；每个模块按 controller/application/domain/infrastructure 分层。
- 数据库为唯一事务事实源；V1 不引入 Redis、队列、对象存储。所有核心写入在单个 PostgreSQL 事务内完成。
- API 前缀固定为 `/api/v1/tenants/:tenantId`；健康检查除外。`:tenantId` 为租户 slug，小写且匹配 `^[a-z0-9][a-z0-9-]{1,63}$`。
- OpenAPI 由后端 DTO/装饰器生成到 `/api/docs-json`；CI 导出 `openapi.json` artifact。前端用 `openapi-typescript` 生成 `src/api/generated/schema.d.ts`，生成文件只读，提交后由契约差异检查防漂移。

## 2. 通用协议

### 2.1 传输、命名与时间

- JSON UTF-8；生产仅 HTTPS。API JSON 字段 `camelCase`，数据库列 `snake_case`。
- 时间均为 ISO 8601 UTC（例 `2026-08-08T08:00:00.000Z`）；业务归日固定 `Asia/Shanghai`。
- ID 均为 UUID v7 字符串。服务端生成，客户端不得赋值。
- 金额均为人民币分的安全整数 `number`，字段后缀 `AmountCents`/`UnitPriceCents`；范围 `1..9_000_000_000_000_000`，不得传浮点元。
- 数量使用十进制定点字符串 `quantity`，格式 `^(?:0|[1-9]\d{0,11})(?:\.\d{1,4})?$` 且必须 `>0`。服务端用 Decimal 计算每行 `roundHalfUp(quantity × unitPriceCents)`，再求和。
- `Content-Type: application/json`；所有响应带 `X-Request-Id`。请求可传同格式 ID，不合法则服务端重建。

### 2.2 响应 envelope

成功：

```json
{ "data": { "id": "019..." }, "meta": { "requestId": "019..." } }
```

列表：

```json
{
  "data": { "items": [], "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 },
  "meta": { "requestId": "019..." }
}
```

错误：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": { "fields": [{ "field": "items[0].quantity", "reason": "必须大于 0" }] }
  },
  "meta": { "requestId": "019..." }
}
```

`details` 可省略且不可含堆栈、SQL、密码、token 或其他租户信息。`204` 无响应体。

### 2.3 分页、筛选与排序

- `page` 默认 1，最小 1；`pageSize` 默认 20，范围 1..100。
- 页码越界返回 200 空 `items`，保留真实 `total/totalPages`。
- 列表必须使用稳定次排序 `id desc`。每个端点只接受本文列出的 `sort` 值；非法值为 `VALIDATION_ERROR`。
- 文本搜索去首尾空格，不区分大小写，最长 100；空字符串等同未传。
- 多值枚举 query 使用逗号分隔，例如 `status=DRAFT,APPROVED`。

### 2.4 认证兼容策略

兼容旧契约的路径租户 + Bearer 不透明 session 语义，响应升级到本契约统一 envelope：

- `POST /api/v1/tenants/:tenantId/auth/login`
- `POST /api/v1/tenants/:tenantId/auth/logout`
- `GET /api/v1/tenants/:tenantId/auth/me`
- Header：`Authorization: Bearer <opaque-session-token>`。
- session 存 DB，只存 token 的 SHA-256 hash，不存明文；TTL 默认 8 小时，无滑动续期。登录限流为 60 秒内每 `tenantId+IP` 5 次。
- path 租户与 session 租户不符返回 `403 TENANT_FORBIDDEN`；资源 ID 不存在、属于别的租户或超出数据范围统一返回 `404 RESOURCE_NOT_FOUND`。
- 用户或租户停用后，下一次鉴权立即 `401 UNAUTHENTICATED`；会话在事务内标记 revoked。

登录请求：`{ "username": "alice", "password": "12..128 chars" }`。成功 `200`：

```json
{
  "data": {
    "token": "sess_opaque",
    "expiresAt": "2026-08-08T16:00:00.000Z",
    "tenant": { "id": "019...", "slug": "acme", "name": "Acme 演示企业", "timezone": "Asia/Shanghai" },
    "user": { "id": "019...", "username": "alice", "displayName": "Alice", "role": "EMPLOYEE", "status": "ACTIVE", "department": { "id": "019...", "name": "研发部" } }
  },
  "meta": { "requestId": "019..." }
}
```

错误凭据和错误租户都对外返回 `401 INVALID_CREDENTIALS`。logout 首次成功 `204`；无效 session 返回 `401`。`me` 返回登录响应中的 tenant/user（不含 token/expiresAt）。

## 3. 枚举、RBAC 与数据范围

```ts
type UserRole = 'TENANT_ADMIN'|'EMPLOYEE'|'DEPT_MANAGER'|'FINANCE'|'TENANT_OWNER'|'AUDITOR';
type EntityStatus = 'ACTIVE'|'INACTIVE';
type ApplicationStatus = 'DRAFT'|'PENDING_DEPT_MANAGER'|'PENDING_FINANCE'|'PENDING_TENANT_OWNER'|'APPROVED'|'REJECTED';
type ApprovalNode = 'DEPT_MANAGER'|'FINANCE'|'TENANT_OWNER';
type ApprovalAction = 'APPROVE'|'REJECT';
type AuditResult = 'SUCCESS'|'FAILURE';
```

能力矩阵：

| 能力 | ADMIN | EMPLOYEE | MANAGER | FINANCE | OWNER | AUDITOR |
|---|---:|---:|---:|---:|---:|---:|
| 组织/成员读写 | 是 | 否 | 否 | 否 | 否 | 否 |
| 创建本人申请 | 否 | 是 | 是 | 否 | 否 | 否 |
| 看申请 | 全租户 | 本人 | 本部门 | 全租户 | 全租户 | 全租户只读 |
| 审批 | 否 | 否 | 本部门一级 | 全租户二级 | 全租户三级 | 否 |
| 仪表盘 | 全租户 | 本人 | 本部门 | 全租户 | 全租户 | 全租户 |
| 审计日志 | 是 | 否 | 否 | 否 | 否 | 是 |

管理员不可代改草稿、不可审批；审计员严格只读。所有 repository 查询必须显式接收 `tenantId` 和计算后的 scope，禁止先按 ID 查再做内存鉴权。

## 4. 数据模型、约束与索引

所有业务表包含 `id uuid PK`、`tenant_id uuid NOT NULL`（tenant 表除外）、UTC `created_at`；可变聚合含 `updated_at` 与 `version int NOT NULL DEFAULT 1`。

### 4.1 表

- `tenants(id, slug, name, timezone='Asia/Shanghai', status)`；唯一 `lower(slug)`。
- `departments(id, tenant_id, name, status, manager_user_id nullable, version, created_at, updated_at)`；唯一 `(tenant_id, lower(name))`；索引 `(tenant_id,status)`；主管外键延迟约束到 users。
- `users(id, tenant_id, department_id, username, display_name, role, status, password_hash, version, created_at, updated_at)`；唯一 `(tenant_id,lower(username))`；索引 `(tenant_id,department_id,status)`、`(tenant_id,role,status)`。
- `sessions(id, tenant_id, user_id, token_hash, expires_at, revoked_at, created_at)`；唯一 `token_hash`；索引 `(tenant_id,user_id)`、部分索引 `(expires_at) WHERE revoked_at IS NULL`。
- `purchase_applications(id, tenant_id, application_no nullable, creator_id, department_id, title, reason nullable, cost_center nullable, currency='CNY', total_amount_cents, status, current_approval_node nullable, submitted_at nullable, decided_at nullable, version, created_at, updated_at)`；唯一部分索引 `(tenant_id,application_no) WHERE application_no IS NOT NULL`；索引 `(tenant_id,creator_id,updated_at DESC)`、`(tenant_id,department_id,status,updated_at DESC)`、`(tenant_id,status,updated_at DESC)`、`(tenant_id,application_no)`。
- `purchase_application_items(id, tenant_id, application_id, line_no smallint, name, quantity numeric(16,4), unit_price_cents bigint, line_amount_cents bigint, note nullable, created_at)`；唯一 `(application_id,line_no)`；索引 `(tenant_id,application_id)`。
- `approval_records(id, tenant_id, application_id, node, action, approver_id, comment nullable, from_status, to_status, created_at)`；唯一 `(application_id,node)`；索引 `(tenant_id,approver_id,created_at)`、`(tenant_id,application_id,created_at)`。
- `workflow_events(id, tenant_id, application_id, event_type, actor_id, from_status nullable, to_status, created_at)`；V1 仅 `SUBMITTED`，唯一 `(application_id,event_type)`。
- `idempotency_keys(id, tenant_id, actor_id, operation, key, request_hash, response_status, response_body jsonb, resource_id nullable, expires_at, created_at)`；唯一 `(tenant_id,actor_id,operation,key)`，过期 24h，定时清理。
- `audit_logs(id, tenant_id, event_type, actor_id nullable, target_type, target_id nullable, result, request_id, ip_hash nullable, change_summary jsonb nullable, created_at)`；仅 INSERT；索引 `(tenant_id,created_at DESC,id DESC)`、`(tenant_id,event_type,created_at DESC)`、`(tenant_id,actor_id,created_at DESC)`、`(tenant_id,result,created_at DESC)`。
- `tenant_sequences(tenant_id, sequence_date date, next_value int)`；PK `(tenant_id,sequence_date)`，用于申请编号。

### 4.2 强约束

- 所有跨表外键应包含租户一致性保障（复合唯一键 + 复合 FK，或事务内强校验）；禁止跨租户关联。
- 一个部门最多一个主管字段；被指定者必须同租户、同部门、ACTIVE 且角色 `DEPT_MANAGER`。
- 每租户必须至少一个 ACTIVE `TENANT_ADMIN`，恰有一个 ACTIVE `TENANT_OWNER`；用串行化管理事务 + 租户 advisory lock 维护（跨行规则不能只靠普通 CHECK）。
- 申请 item 1..20；title 1..100、reason 1..1000、costCenter 1..100、item.name 1..100、note 0..500。
- 已提交申请及 items 不允许产品 API 修改。`current_approval_node` 必须与 pending 状态对应，终态和草稿为 null。
- 申请编号在提交事务中生成：`PF-YYYYMMDD-NNNN`，日期按 Asia/Shanghai；每租户每日从 0001 开始，以 `tenant_sequences` 行锁保证唯一。
- 所有 bigint 金额映射为 JS safe integer；API 输出 number。数据库 CHECK 保证非负且不超过安全上限。
- Prisma migration 需在空库及已有数据升级路径测试；V1 新表 DDL 无大表锁风险。未来加 `NOT NULL`/索引必须用分阶段迁移或 PostgreSQL `CONCURRENTLY`。

## 5. DTO

### 5.1 公共简表

```ts
type DepartmentSummary = { id:string; name:string; status:EntityStatus };
type UserSummary = { id:string; username:string; displayName:string; role:UserRole; status:EntityStatus; department:DepartmentSummary };
type ApplicationItem = { id:string; lineNo:number; name:string; quantity:string; unitPriceCents:number; lineAmountCents:number; note:string|null };
type ApprovalRecord = { id:string; node:ApprovalNode; action:ApprovalAction; approver:UserSummary; comment:string|null; fromStatus:ApplicationStatus; toStatus:ApplicationStatus; createdAt:string };
```

### 5.2 申请

```ts
type ApplicationSummary = {
  id:string; applicationNo:string|null; title:string; currency:'CNY'; totalAmountCents:number;
  status:ApplicationStatus; currentApprovalNode:ApprovalNode|null;
  creator:UserSummary; department:DepartmentSummary; itemCount:number;
  version:number; submittedAt:string|null; createdAt:string; updatedAt:string;
};
type ApplicationDetail = ApplicationSummary & {
  reason:string|null; costCenter:string|null; items:ApplicationItem[];
  history:Array<
    | { type:'SUBMITTED'; actor:UserSummary; fromStatus:'DRAFT'; toStatus:'PENDING_DEPT_MANAGER'; createdAt:string }
    | ({ type:'APPROVAL' } & ApprovalRecord)
  >;
  permissions:{ canEdit:boolean; canDelete:boolean; canSubmit:boolean; canApprove:boolean; canReject:boolean };
};
```

## 6. 组织 API（仅 TENANT_ADMIN）

### 6.1 部门

- `GET /departments?page&pageSize&status&search&sort=nameAsc|createdAtDesc` → 部门列表。item：`DepartmentSummary & { manager:UserSummary|null; memberCount:number; version:number; createdAt:string; updatedAt:string }`。
- `POST /departments`，Header `Idempotency-Key` 必填；body `{name, managerUserId?:string|null}` → `201` item。创建后指定主管时，候选用户须已在该新部门不可能成立，因此 V1 创建接口的 `managerUserId` 仅允许 null；可随后移动用户并 PATCH 指定。
- `PATCH /departments/:departmentId`，body `{name?:string,status?:EntityStatus,managerUserId?:string|null,version:number}` → `200` item。至少一个变更字段。

规则：停用部门不清空主管；不可向其分配新成员或提交。重名 `DEPARTMENT_NAME_CONFLICT`。版本不符 `VERSION_CONFLICT`。

### 6.2 成员

- `GET /members?page&pageSize&status&role&departmentId&search&sort=displayNameAsc|createdAtDesc` → `UserSummary & {version;createdAt;updatedAt}`。
- `POST /members`，`Idempotency-Key` 必填；body `{username,displayName,password,departmentId,role}` → `201`，不回 password/hash。
- `PATCH /members/:userId`，body `{displayName?:string,departmentId?:string,role?:UserRole,status?:EntityStatus,password?:string,version:number}` → `200`。

规则：username 1..64；displayName 1..100；初始密码 12..128。用户名冲突 `USERNAME_CONFLICT`。部门须 ACTIVE。修改主管的部门或角色若导致部门主管引用失效，返回 `DEPARTMENT_MANAGER_CONFLICT`，需先更换/清空主管。不可停用自己、最后一个管理员、唯一负责人；分别返回 `CANNOT_DISABLE_SELF`、`LAST_ADMIN_REQUIRED`、`TENANT_OWNER_REQUIRED`。尝试创建第二个 ACTIVE OWNER 返回 `TENANT_OWNER_CONFLICT`。

## 7. 采购申请 API

基础路径均接 `/api/v1/tenants/:tenantId`。

- `GET /applications?page&pageSize&status&search&creatorId&departmentId&sort=updatedAtDesc|createdAtDesc|amountDesc` → 可见范围内 `ApplicationSummary`。员工/主管传越界筛选值仍只返回 scope 交集。
- `GET /applications/:applicationId` → `ApplicationDetail`。
- `POST /applications`，EMPLOYEE/MANAGER，`Idempotency-Key` 必填；body `{title}` → `201 ApplicationDetail(DRAFT)`。
- `PUT /applications/:applicationId`，仅创建人草稿；body：

```json
{
  "title":"研发笔记本采购", "reason":"扩充研发团队", "costCenter":"R&D-2026", "currency":"CNY",
  "items":[{"name":"笔记本电脑","quantity":"2.0000","unitPriceCents":899900,"note":"16GB 以上"}],
  "version":1
}
```

→ `200 ApplicationDetail`。保存草稿允许 reason/costCenter 为 null、items 为 0..20；若存在 item，其字段必须合法。忽略任何客户端 total/lineAmount 字段并重算。

- `DELETE /applications/:applicationId?version=1`，仅创建人草稿 → `204`。高风险 UI 须确认。
- `POST /applications/:applicationId/submit`，`Idempotency-Key` 必填；body `{version:number}` → `200 ApplicationDetail`。

提交校验完整字段、1..20 items、部门 ACTIVE、当前用户 ACTIVE、启用主管/至少一个启用财务/唯一启用负责人，且各节点不能与申请人相同。失败 `APPROVAL_CONFIGURATION_INCOMPLETE`，details：`{missing:['DEPT_MANAGER'|'FINANCE'|'TENANT_OWNER'], selfApprovalNodes:ApprovalNode[]}`；草稿不变。

## 8. 审批 API

- `GET /approval-tasks?page&pageSize&search&departmentId&sort=submittedAtAsc|submittedAtDesc` → 当前用户可处理的 `ApplicationSummary`；`total` 是当前真实待办数。
- `POST /applications/:applicationId/approval-actions`，FINANCE 多人抢占亦适用；`Idempotency-Key` 必填；body：

```json
{ "action":"APPROVE", "comment":"同意", "version":2 }
```

`APPROVE` comment 可空/0..500；`REJECT` 必填 1..500。成功 `200 ApplicationDetail`。无当前节点能力 `403 FORBIDDEN`；超出数据范围按 404；本人申请 `403 SELF_APPROVAL_FORBIDDEN`；状态或 version 已变化 `409 APPLICATION_STATE_CHANGED`，前端刷新详情；资格配置当前缺失 `409 APPROVER_CONFIGURATION_CHANGED`。

- `GET /applications/:applicationId/approval-history` → `{items: ApplicationDetail['history']}`，不分页，最多 4 条（提交 + 三级）。与详情 history 同源。

### 8.1 六状态状态机

唯一合法边：

```text
DRAFT --submit--> PENDING_DEPT_MANAGER
PENDING_DEPT_MANAGER --approve--> PENDING_FINANCE
PENDING_FINANCE --approve--> PENDING_TENANT_OWNER
PENDING_TENANT_OWNER --approve--> APPROVED
任一 PENDING_* --reject--> REJECTED
```

终态不可变；V1 无撤回、重开、跳级。`currentApprovalNode` 分别映射三个 pending 状态。

## 9. 审计 API

- `GET /audit-logs?page&pageSize&from&to&eventType&actorId&result&targetType&sort=createdAtDesc`，仅 ADMIN/AUDITOR。
- item：`{id,eventType,actor:UserSummary|null,targetType,targetId,result,requestId,changeSummary:Record<string,unknown>|null,createdAt}`。
- `from/to` 为 UTC ISO 时间且 `from<=to`，最大跨度 366 天。
- 事件枚举：`AUTH_LOGIN_SUCCESS`、`AUTH_LOGIN_FAILURE`、`AUTH_LOGOUT`、`AUTH_SESSION_REJECTED`、`TENANT_ACCESS_DENIED`、`DEPARTMENT_CREATED`、`DEPARTMENT_UPDATED`、`DEPARTMENT_STATUS_CHANGED`、`MEMBER_CREATED`、`MEMBER_UPDATED`、`MEMBER_ROLE_CHANGED`、`MEMBER_DEPARTMENT_CHANGED`、`MEMBER_STATUS_CHANGED`、`APPLICATION_CREATED`、`APPLICATION_UPDATED`、`APPLICATION_DELETED`、`APPLICATION_SUBMITTED`、`APPROVAL_APPROVED`、`APPROVAL_REJECTED`、`APPROVAL_DENIED`。
- 无修改/删除 API。`changeSummary` 仅存字段名及安全的 before/after；密码变更仅 `{passwordChanged:true}`。

## 10. 仪表盘 API

`GET /dashboard?departmentId` → 调用者 scope 内数据；P1 部门筛选已定义，前端可直接实现。越界 departmentId 返回空 scope，不扩权。

```json
{
  "data": {
    "summary": {"totalCount":100,"draftCount":5,"pendingCount":20,"approvedCount":70,"approvedAmountCents":12345678,"rejectedCount":5,"myPendingTaskCount":3},
    "submissionTrend": [{"date":"2026-07-10","amountCents":10000,"count":2}],
    "departmentRanking": [{"department":{"id":"019...","name":"研发部","status":"ACTIVE"},"amountCents":80000,"count":5}]
  },
  "meta": {"requestId":"019...","timezone":"Asia/Shanghai","range":{"from":"2026-07-10","to":"2026-08-08"}}
}
```

`totalCount` 含草稿；pending 是三个 pending 状态合计；趋势仅按 `submittedAt` 最近连续 30 个本地自然日，缺失日补零，金额含所有已提交状态；部门排行排除草稿，按金额降序/id 升序，最多 10 条。

## 11. 幂等、乐观并发与事务

- `Idempotency-Key` 为写操作必填处的 UUID，最长 64；同一 actor+operation+key+相同 body 在 24h 内重放原状态码/body，不重复业务写入；同 key 不同 body 返回 `409 IDEMPOTENCY_KEY_REUSED`。
- PUT/PATCH/DELETE/submit/approval 均携带 `version`。更新 SQL 必须含 `WHERE id=? AND tenant_id=? AND version=?` 并原子 `version=version+1`。
- submit 事务：锁 application；复核草稿/版本/所有权/配置；重算金额；锁 sequence 生成编号；更新状态；写 workflow_event、审计、幂等结果；任一步失败全部回滚。
- approval 事务：锁 application `FOR UPDATE`；复核 version/状态/scope/实时角色/非本人；以 `approval_records(application_id,node)` 唯一约束兜底；更新状态和 version；插 approval record、审计、幂等结果；全部原子提交。
- 组织管理事务使用 `pg_advisory_xact_lock(hash(tenantId))` 维护唯一 OWNER/至少一 ADMIN/主管引用不变量。
- 删除草稿为物理删除，application/items 与成功审计在同一事务；审计 targetId 保留。其他业务实体 V1 不物理删除。
- 失败授权尝试审计应尽力写入独立安全日志事务；不得因审计写失败把越权请求变成功。成功业务审计必须与业务写同事务。

## 12. 错误码

| HTTP | code | 语义/前端动作 |
|---:|---|---|
| 400 | `INVALID_REQUEST` | JSON/query 格式错误 |
| 400 | `VALIDATION_ERROR` | 显示字段级 `details.fields` |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | 客户端生成 key 后重试 |
| 401 | `INVALID_CREDENTIALS` | 登录失败统一文案 |
| 401 | `UNAUTHENTICATED` | 清会话并跳登录 |
| 403 | `TENANT_FORBIDDEN` | 路径租户冲突，回正确租户 |
| 403 | `FORBIDDEN` | 有会话但无能力 |
| 403 | `SELF_APPROVAL_FORBIDDEN` | 不允许审批本人申请 |
| 404 | `RESOURCE_NOT_FOUND` | 不存在/跨租户资源/越数据范围统一 |
| 409 | `VERSION_CONFLICT` | 管理/草稿版本过期，刷新 |
| 409 | `APPLICATION_STATE_CHANGED` | 提交或审批状态已变化，刷新详情 |
| 409 | `IDEMPOTENCY_KEY_REUSED` | 生成新 key；不可静默复用 |
| 409 | `DEPARTMENT_NAME_CONFLICT` | 部门重名 |
| 409 | `USERNAME_CONFLICT` | 用户名重名 |
| 409 | `DEPARTMENT_MANAGER_CONFLICT` | 主管关系不合法或会被破坏 |
| 409 | `TENANT_OWNER_CONFLICT` | 已存在启用负责人 |
| 409 | `TENANT_OWNER_REQUIRED` | 不可移除唯一负责人 |
| 409 | `LAST_ADMIN_REQUIRED` | 不可移除最后管理员 |
| 409 | `CANNOT_DISABLE_SELF` | 管理员不可停用自己 |
| 409 | `DEPARTMENT_INACTIVE` | 停用部门不可接收成员/提交 |
| 409 | `APPROVAL_CONFIGURATION_INCOMPLETE` | 提交配置缺失，草稿不变 |
| 409 | `APPROVER_CONFIGURATION_CHANGED` | 当前节点资格配置缺失，管理员修复 |
| 413 | `PAYLOAD_TOO_LARGE` | JSON body 上限 1 MiB |
| 429 | `RATE_LIMITED` | 尊重 `Retry-After` 秒数 |
| 500 | `INTERNAL_ERROR` | 通用错误，展示 requestId |
| 503 | `SERVICE_UNAVAILABLE` | 依赖未就绪，可稍后重试 |

未知路由返回 404 `RESOURCE_NOT_FOUND`；Prisma/数据库细节不得直出。

## 13. 健康、配置、CORS 与安全

- `GET /health/live` → 200 `{status:'ok'}`，不查依赖。
- `GET /health/ready` → PostgreSQL 可读写迁移版本匹配时 200；否则 503。
- 环境变量：`NODE_ENV`、`PORT=3000`、`DATABASE_URL`、`SESSION_TTL_SECONDS=28800`、`SESSION_TOKEN_PEPPER`、`PASSWORD_PEPPER`（可选）、`CORS_ALLOWED_ORIGINS=http://localhost:5173`、`TRUST_PROXY=false`、`LOG_LEVEL=info`。
- CORS：开发默认仅 `http://localhost:5173`；生产必须是逗号分隔 HTTPS 精确 origin，不允许 `*`，允许 Header 为 `Authorization,Content-Type,X-Request-Id,Idempotency-Key`，方法为 `GET,POST,PUT,PATCH,DELETE,OPTIONS`；不用 cookie，`credentials=false`。
- 启动时生产配置强校验：pepper 至少 32 随机字符；CORS 不含通配符/localhost；禁止 seed/demo 模式；不满足立即退出。
- Helmet 安全头；body 1 MiB；密码 Argon2id；日志 token/password 全量脱敏。响应可安全重试方法不自动重试写操作，前端仅凭同一 Idempotency-Key 人工/网络恢复重试。

## 14. 演示种子（仅 development/test）

固定租户 slug `acme`，名称“Acme 演示企业”，时区 `Asia/Shanghai`；初始密码通过 `SEED_PASSWORD` 注入，`.env.example` 可用 `ProcureFlow!2026` 并明确禁止生产。

| username | displayName | role | department | 用途 |
|---|---|---|---|---|
| admin | 系统管理员 | TENANT_ADMIN | 管理部 | 组织管理/审计 |
| alice | 员工 Alice | EMPLOYEE | 研发部 | 创建申请 |
| manager | 研发主管 | DEPT_MANAGER | 研发部 | 一级审批且设为主管 |
| finance1 | 财务一 | FINANCE | 财务部 | 二级并发 |
| finance2 | 财务二 | FINANCE | 财务部 | 二级并发 |
| owner | 企业负责人 | TENANT_OWNER | 管理部 | 三级审批 |
| auditor | 审计员 | AUDITOR | 管理部 | 只读审计 |

另建停用部门“历史部门”和停用用户用于边界测试；seed 必须 upsert，可重复运行。生成一条 DRAFT、一条各 pending 状态、一条 APPROVED、一条 REJECTED，并确保历史、金额和仪表盘可核对。

## 15. OpenAPI 与前后端并行约束

- 后端为每个 request/response/error 定义 DTO 和 enum；Swagger 必须展示 envelope，而非裸 DTO。
- 前端 API adapter 只消费生成类型；金额格式化统一 `Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'})`，输入元时先用十进制库转分，不用二进制浮点乘法。
- Mock 基于本文 examples/OpenAPI；HTTP 状态和 error code 路由不可只按 message。
- 契约变更流程：先改本文并提升版本/记录兼容性，再改 OpenAPI，通知前端和 QA。V1 已发布字段只可新增可选字段；删除、重命名、语义改变需 `/v2`。

## 16. S2 gate 自评

- 技术边界、路径、字段、模型约束、索引、认证兼容、RBAC/数据范围和六状态状态机已固定。
- 组织、成员、申请、审批待办/动作/历史、审计、仪表盘、健康检查 API 均已定齐；分页、筛选、错误消费方式明确。
- 幂等键、乐观锁、数据库唯一约束、行锁与事务边界覆盖重复提交和并发审批。
- 独立前后端仓库路径、OpenAPI 类型生成、环境变量及开发/生产 CORS 已明确。
- 种子账号和完整演示数据已定义；无阻塞性待确认项。
- **结论：S2 gate 达成，可进入 S3 前后端并行实现。**
