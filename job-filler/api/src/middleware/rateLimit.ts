import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { fail, ErrorCode } from '../errors.js';
import { audit } from '../audit.js';

// 限流中间件(契约 multi-tenant-login-api.md §7,已确认/user Q-3):
// 键 = tenantId + ip;窗口 60s;阈值 5;命中即拒 429 RATE_LIMITED。
// MVP 用内存固定窗口;生产可换中间件层/Redis。
// 约束(§1 step 2 前置):登录端点挂此中间件,键取 path :tenantId + req.ip。

const { windowSeconds, max } = config.rateLimit; // 默认 60s / 5
const windowMs = windowSeconds * 1000;

interface Bucket {
  count: number;
  windowStart: number;
}
const buckets = new Map<string, Bucket>();

// 周期清理过期桶,防内存无限增长(粗粒度即可)。
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now - b.windowStart >= windowMs) buckets.delete(k);
  }
}, windowMs).unref();

export function rateLimitMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const tenantId = (req.params?.tenantId as string | undefined) ?? '_';
    const ip = req.ip ?? req.socket?.remoteAddress ?? '_';
    const key = `${tenantId}:${ip}`;
    const now = Date.now();

    let b = buckets.get(key);
    if (!b || now - b.windowStart >= windowMs) {
      b = { count: 0, windowStart: now };
      buckets.set(key, b);
    }
    b.count++;

    if (b.count > max) {
      // 超限:429(内部记 RATE_LIMITED,对外按 §4 文案)。
      audit('RATE_LIMITED', { tenantId, ip, reason: 'RATE_LIMITED' });
      fail(res, 429, ErrorCode.RATE_LIMITED, '请求过于频繁,稍后再试', {
        retryAfterSeconds: Math.ceil((b.windowStart + windowMs - now) / 1000),
      });
      return;
    }
    next();
  };
}

export const rlConfig = config.rateLimit;
