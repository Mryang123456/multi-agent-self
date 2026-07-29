import 'dotenv/config';

// 集中读取环境变量,契约 multi-tenant-login-api.md 约束。
export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? './dev.sqlite',
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 7200),
  rateLimit: {
    windowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60),
    max: Number(process.env.RATE_LIMIT_MAX ?? 5),
  },
} as const;
