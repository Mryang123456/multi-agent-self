import db, { type UserRow, type SessionRow, type TenantRow } from './index.js';

// 仓储层(契约 multi-tenant-login-api.md §2.4/§4.5:共享库 tenant_id 行级隔离)。
// 设计原则:tenant-scoped 业务查询强制带 tenant_id 谓词,tenantId 为必填形参 ——
// TypeScript 在调用点强制传入,不依赖调用方"记得加 WHERE tenant_id"。
//
// 例外(契约允许):
//  - 登录按 username 跨租户查(§1 step 3 "按 (username) 查用户";§6 username 租户内唯一),
//    命中后在 handler 复核 tenant(§1 step 4 / TENANT_MISMATCH 折叠)。
//  - 鉴权按 session_id(PK)查 session(§2 step 1),拿到 tenantId 后再复核 path。

// —— 登录查询(跨租户,§1 step 3)—— username 非全局唯一(§6),可能多行。
export function findUsersByUsername(username: string): UserRow[] {
  return db.prepare('SELECT * FROM users WHERE username = ?').all(username) as UserRow[];
}

// —— tenant-scoped 业务查询(§2.4/§4.5):强制 tenant_id 谓词,调用方必传 tenantId ——
export function findUserById(userId: string, tenantId: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(
    userId,
    tenantId
  ) as UserRow | undefined;
}

export function findTenantBySlug(slug: string): TenantRow | undefined {
  return db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug) as TenantRow | undefined;
}

// —— session store(§5)——
export interface NewSession {
  sessionId: string;
  userId: string;
  tenantId: string;
  createdAt: string; // ISO8601/UTC
  expiresAt: string; // ISO8601/UTC
}
export function insertSession(s: NewSession): void {
  db.prepare(
    `INSERT INTO sessions (session_id, user_id, tenant_id, created_at, expires_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, NULL)`
  ).run(s.sessionId, s.userId, s.tenantId, s.createdAt, s.expiresAt);
}

// 鉴权用:按 PK(sessionId=token)查 session。有效判定在 auth 中间件做。
export function findSessionById(sessionId: string): SessionRow | undefined {
  return db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId) as
    | SessionRow
    | undefined;
}

// 登出(§3):置 revoked_at = now。幂等 —— 对已吊销 session 再登出也是 204,
// 故这里无条件 UPDATE(revoked_at 已有值则被覆盖为更新的 now,语义无变化)。
export function revokeSession(sessionId: string, nowIso: string): void {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE session_id = ?').run(nowIso, sessionId);
}
