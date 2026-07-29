import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import argon2 from 'argon2';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { authMiddleware, type AuthedRequest } from '../middleware/auth.js';
import { findUsersByUsername, insertSession, revokeSession } from '../db/repo.js';
import { Errors, asyncHandler } from '../errors.js';
import { audit } from '../audit.js';
import { config } from '../config.js';

// 登录/登出路由(契约 multi-tenant-login-api.md §1/§3)

export const authRouter = Router();

// 请求体校验(§1):username 1~64,password 8~128。
const loginBody = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
});

// 恒定耗时兜底(§7,非契约强制):无候选用户时仍做一次 argon2.verify,
// 使"用户存在/不存在"在响应时序上不易区分。惰性生成一次固定 dummy hash。
let dummyHash: string | null = null;
async function burnVerify(password: string): Promise<void> {
  if (dummyHash === null) dummyHash = await argon2.hash('dummy-fixed-secret-constant');
  await argon2.verify(dummyHash, password); // 结果丢弃
}

// POST /api/:tenantId/login → 200 {token, user:{id,tenantId}, expiresAt} / 401 / 400 / 429
authRouter.post(
  '/:tenantId/login',
  rateLimitMiddleware(),
  asyncHandler(async (req, res) => {
    const pathTenant = req.params.tenantId as string;
    const ip = req.ip ?? null;

    // zod 校验(失败抛 → errorHandler 转 400 INVALID_REQUEST)
    const parsed = loginBody.parse(req.body);
    const { username, password } = parsed;

    // §1 step 3:按 (username) 查用户(租户内唯一 §6,可能跨租户多行)
    const rows = findUsersByUsername(username);

    // 命中 path 租户的候选行
    const candidate = rows.find((u) => u.tenant_id === pathTenant);

    if (rows.length === 0) {
      // 用户不存在(含租户不存在):对外 INVALID_CREDENTIALS,内部 USER_NOT_FOUND
      await burnVerify(password); // 恒定耗时
      audit('LOGIN_FAIL', { tenantId: pathTenant, ip, username, reason: 'USER_NOT_FOUND' });
      throw Errors.invalidCredentials();
    }

    if (!candidate) {
      // 用户存在但不在 path 租户 → §1 step 4 TENANT_MISMATCH(对外折叠 INVALID_CREDENTIALS)
      await burnVerify(password);
      audit('TENANT_MISMATCH', {
        username,
        tenantId: pathTenant,
        realTenantId: rows[0].tenant_id,
        ip,
        reason: 'TENANT_MISMATCH',
      });
      throw Errors.invalidCredentials();
    }

    // 校验密码
    const ok = await argon2.verify(candidate.password_hash, password);
    if (!ok) {
      audit('LOGIN_FAIL', {
        userId: candidate.id,
        tenantId: candidate.tenant_id,
        ip,
        username,
        reason: 'PASSWORD_MISMATCH',
      });
      throw Errors.invalidCredentials();
    }

    // 写 session(§5):sessionId=sess_<random>,expiresAt=now+TTL,revokedAt=null
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + config.sessionTtlSeconds * 1000).toISOString();
    const sessionId = `sess_${randomBytes(16).toString('hex')}`;
    insertSession({
      sessionId,
      userId: candidate.id,
      tenantId: candidate.tenant_id, // = slug(MVP 约定)
      createdAt,
      expiresAt,
    });

    audit('LOGIN_SUCCESS', {
      userId: candidate.id,
      tenantId: candidate.tenant_id,
      ip,
      username,
      reason: 'OK',
    });

    // §1 成功 200:裸业务对象(envelope §0)
    res.status(200).json({
      token: sessionId,
      user: { id: candidate.id, tenantId: candidate.tenant_id },
      expiresAt,
    });
  })
);

// POST /api/:tenantId/logout → 204(吊销 session);未认证 401;path≠token 403
authRouter.post(
  '/:tenantId/logout',
  authMiddleware,
  asyncHandler(async (req: AuthedRequest, res) => {
    // 鉴权 + path 复核已在 authMiddleware;到这 req.sessionId/tenantId/userId 已挂。
    const nowIso = new Date().toISOString();
    revokeSession(req.sessionId!, nowIso); // 幂等:重复登出返同一 401,状态不变(effect idempotent);已吊销/无效 token→401 与§2一致(由 authMiddleware 在本 handler 前拦截)
    audit('LOGOUT', {
      userId: req.userId,
      tenantId: req.tenantId,
      ip: req.ip ?? null,
      reason: 'LOGOUT',
    });
    res.status(204).end(); // 无响应体
  })
);

export default authRouter;
