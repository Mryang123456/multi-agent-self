import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import argon2 from 'argon2';
import { config } from '../config.js';

// 契约 multi-tenant-login-api.md §5/§6:DB 表 sessions + 共享库 tenant_id 行级隔离。
//
// 选型说明(README 同步):优先 better-sqlite3,但其 native 绑定(.node)在本机
// 编译失败(npm install 未产出 build/Release/better_sqlite3.node),fallback 到
// Node 22 内置的 `node:sqlite`(实验性,API 与 better-sqlite3 接近:exec/prepare/run/get/all)。
// 详见 README "选型与 fallback" 一节。

const __dirname = dirname(fileURLToPath(import.meta.url));

export const db = new DatabaseSync(config.dbPath);
// WAL 提升并发写;外键约束(契约 schema.sql 的 REFERENCES 生效)。
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const schemaPath = join(__dirname, 'schema.sql');
db.exec(readFileSync(schemaPath, 'utf-8'));

// 行类型(仓储层做 snake_case→camelCase 映射时用)。
export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}
export interface UserRow {
  id: string;
  tenant_id: string;
  username: string;
  password_hash: string;
  created_at: string;
}
export interface SessionRow {
  session_id: string;
  user_id: string;
  tenant_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

// 初始化:建表(已在上面 exec schema.sql)+ 幂等种子数据供自测。
// argon2.hash 为异步,故 initDb 为 async,由 server 启动时 await。
export async function initDb(): Promise<void> {
  const tenantCount = (
    db.prepare('SELECT COUNT(*) AS c FROM tenants').get() as { c: number }
  ).c;
  if (tenantCount > 0) return; // 幂等:已有数据不重复种

  const now = new Date().toISOString();
  // MVP 约定:tenants.id == slug(以 slug 作主键),使 sessions/users.tenant_id
  // 直接即 path slug,免去 id↔slug 映射与额外 join;`slug` 列保留(契约/任务要求)。
  const tenants: Array<{ id: string; slug: string; name: string }> = [
    { id: 'acme', slug: 'acme', name: 'Acme Corp' },
    { id: 'globex', slug: 'globex', name: 'Globex Inc' },
  ];
  // 两个租户各一个用户;acme 用 admin,globex 用 root(同名跨租户场景见 globex 的 admin 缺省)。
  // 密码仅种子自测用,生产由注册端点签发。
  const users: Array<{ id: string; tenantId: string; username: string; password: string }> = [
    { id: 'u_acme_admin', tenantId: 'acme', username: 'admin', password: 'password123' },
    { id: 'u_globex_root', tenantId: 'globex', username: 'root', password: 'globexpass' },
  ];

  const insTenant = db.prepare(
    'INSERT INTO tenants (id, slug, name, created_at) VALUES (?, ?, ?, ?)'
  );
  const insUser = db.prepare(
    'INSERT INTO users (id, tenant_id, username, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  for (const t of tenants) insTenant.run(t.id, t.slug, t.name, now);
  for (const u of users) {
    const hash = await argon2.hash(u.password);
    insUser.run(u.id, u.tenantId, u.username, hash, now);
  }
  console.log('[db] seeded tenants=%d users=%d', tenants.length, users.length);
}

export default db;
