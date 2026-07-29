-- 多租户登录 MVP schema(契约 multi-tenant-login-api.md §5/§6)
-- DB 表(已确认/user Q-2);共享库 + tenant_id 行级隔离(Q2)。

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,             -- :tenantId, ^[a-z0-9][a-z0-9-]{1,63}$
  name TEXT NOT NULL,
  created_at TEXT NOT NULL               -- ISO8601/UTC
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  username TEXT NOT NULL,                -- 租户内唯一(契约§6)
  password_hash TEXT NOT NULL,           -- argon2 优先;若 native 装失败 fallback node crypto.scrypt
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, username)           -- 租户内唯一约束(契约§6)
);

CREATE TABLE IF NOT EXISTS sessions (    -- 契约§5
  session_id TEXT PRIMARY KEY,           -- 不透明 sess_<random>
  user_id TEXT NOT NULL REFERENCES users(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  created_at TEXT NOT NULL,              -- ISO8601/UTC
  expires_at TEXT NOT NULL,              -- ISO8601/UTC
  revoked_at TEXT                        -- NULL=有效;登出置 now
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
