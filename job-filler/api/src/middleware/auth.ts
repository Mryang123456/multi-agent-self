import type { Request, Response, NextFunction } from 'express';
import { findSessionById } from '../db/repo.js';
import { Errors, fail } from '../errors.js';
import { audit } from '../audit.js';

// 鉴权中间件(契约 multi-tenant-login-api.md §2):
// 1. 取 Authorization: Bearer <token>(= sessionId,不透明)
// 2. 查 sessions;无记录 / revokedAt != null / now >= expiresAt → 401 UNAUTHENTICATED
// 3. 挂 req.tenantId / req.userId
// 4. 复核 path :tenantId == session.tenantId;不符 → 403 TENANT_FORBIDDEN

export interface AuthedRequest extends Request {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
}

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    throw Errors.unauthenticated();
  }
  const token = header.slice('bearer '.length).trim();
  if (!token) throw Errors.unauthenticated();

  const session = findSessionById(token);
  const ip = req.ip ?? null;
  if (!session) {
    // 无此 session(token 非法/伪造)
    throw Errors.unauthenticated();
  }
  // 有效判定(§5):revokedAt==null AND now<expiresAt
  if (session.revoked_at !== null) {
    audit('LOGIN_FAIL', { userId: session.user_id, tenantId: session.tenant_id, ip, reason: 'SESSION_REVOKED' });
    throw Errors.unauthenticated();
  }
  if (Date.now() >= new Date(session.expires_at).getTime()) {
    audit('LOGIN_FAIL', { userId: session.user_id, tenantId: session.tenant_id, ip, reason: 'SESSION_EXPIRED' });
    throw Errors.unauthenticated();
  }

  // 挂上下文(tenant_id 即 slug,见 db/index.ts MVP 约定)
  req.userId = session.user_id;
  req.tenantId = session.tenant_id;
  req.sessionId = session.session_id;

  // 复核 path(§2 step 3):path 含 :tenantId 且与 session 归属不等 → 403
  const pathTenant = req.params?.tenantId as string | undefined;
  if (pathTenant !== undefined && pathTenant !== session.tenant_id) {
    audit('TENANT_FORBIDDEN', {
      userId: session.user_id,
      tenantId: pathTenant,
      realTenantId: session.tenant_id,
      ip,
      reason: 'PATH_TENANT_MISMATCH',
    });
    throw Errors.tenantForbidden();
  }

  next();
}
