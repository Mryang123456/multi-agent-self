// 审计日志(契约 multi-tenant-login-api.md §7):内部 console.log,不外发。
// 记 userId/tenantId/ip/ts/reason,不记 secrets(密码/哈希/token 全量)。
// 内部 reason 区分真实情况(USER_NOT_FOUND/PASSWORD_MISMATCH/TENANT_MISMATCH/
// TENANT_FORBIDDEN/RATE_LIMITED/LOGOUT),对外仍按 §4 折叠。

export type AuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAIL'
  | 'TENANT_MISMATCH'
  | 'TENANT_FORBIDDEN'
  | 'RATE_LIMITED'
  | 'LOGOUT';

export interface AuditFields {
  userId?: string | null;
  tenantId?: string | null; // path :tenantId
  realTenantId?: string | null; // 真实归属(仅 TENANT_MISMATCH)
  ip?: string | null;
  username?: string | null;
  reason?: string;
}

export function audit(event: AuditEvent, f: AuditFields): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      userId: f.userId ?? null,
      tenantId: f.tenantId ?? null,
      realTenantId: f.realTenantId ?? null,
      ip: f.ip ?? null,
      username: f.username ?? null,
      reason: f.reason ?? null,
    })
  );
}
