# saas-erp-api

后端:Node + Express + SQLite(TypeScript)。契约单一事实源:`multi-tenant-login-api.md` v1.1。

## 职责(对应契约)
- `POST /api/:tenantId/login` — 账密登录,签发不透明 session(§1)。
- `POST /api/:tenantId/logout` — 吊销 session(§3)。
- 鉴权中间件 — Bearer token → session → 复核 path(§2)。
- 限流中间件 — tenantId+ip,60s,阈值 5,超限 429 RATE_LIMITED(§7)。
- session store = DB 表 `sessions`(§5,已确认/user)。
- 仓储层行级隔离 — tenant-scoped 查询强制带 `tenant_id` 谓词(§2.4/§4.5)。

## 选型与 fallback
- **TypeScript** + **tsx**:TS 直接运行/热重载。
- **better-sqlite3 → 已 fallback `node:sqlite`**:better-sqlite3 的 native 绑定(`.node`)在本机未构建(见下"依赖状态"),加载报 "Could not locate the bindings file"。已 fallback 到 Node 22 内置的 `node:sqlite`(实验性,stderr 打印一条 ExperimentalWarning,不影响运行;API 与 better-sqlite3 接近:`exec/prepare/run/get/all`,无 `.pragma()` 改用 `exec("PRAGMA …")`,`prepare().changes` 不存在但本实现不依赖)。补丁在 `src/db/index.ts`;`@types/node@20` 无 `node:sqlite` 类型,补 ambient 声明 `src/types/node-sqlite.d.ts`(升级 `@types/node` 到 ≥22 后可删)。
- **argon2**:正常工作(`$argon2id$`),未 fallback。密码哈希 + 验证均用 argon2。
- **zod**:请求体校验(§1 username 1~64 / password 8~128)。
- **express/cors/dotenv**:已就位。

## 目录
```
src/
  server.ts            入口:挂路由 + 中间件 + 统一错误处理 + initDb
  config.ts            环境变量集中(PORT/DB_PATH/SESSION_TTL/RATE_LIMIT_*)
  routes/auth.ts       login/logout(asyncHandler 包裹,argon2 异步)
  middleware/auth.ts   session 鉴权 + path 复核(§2)
  middleware/rateLimit.ts  限流(内存固定窗口,§7)
  db/index.ts          node:sqlite 实例 + schema init + 幂等种子(argon2 异步)
  db/schema.sql         tenants/users/sessions 建表
  db/repo.ts           仓储层(tenant-scoped helper 强制 tenant_id 谓词)
  errors.ts            错误码/envelope/ApiError/asyncHandler/errorHandler
  audit.ts             审计日志(§7,内部 console.log,不记 secrets)
  types/node-sqlite.d.ts  node:sqlite ambient 类型声明(@types/node<22 补丁)
```

## 启动
```
cp .env.example .env
npm install        # better-sqlite3 编译失败不影响(已 fallback node:sqlite)
npm run dev        # tsx watch,默认 :3000
```

种子自测数据(幂等,仅 dev.sqlite):
- 租户 `acme` → 用户 `admin` / 密码 `password123`
- 租户 `globex` → 用户 `root` / 密码 `globexpass`

## 依赖状态(本机实测 2026-07-24)
- `npm install` 在本机跑了约 28 分钟后**挂起**(better-sqlite3 的 `node-gyp rebuild` 0% CPU、无 build 产物,疑 node 头下载卡住),已 kill(exit 144)。
- 已落:express / argon2(有 prebuilds)/ zod / cors / dotenv / tsx / typescript / @types 等纯 JS 包(node_modules 118 项)。
- **未完成**:better-sqlite3 原生二进制未构建、`api/package-lock.json` 未生成。
- S3 实际处置:已采用 fallback 方案 3 —— 换 `node:sqlite`(Node 22 内置),改 `src/db/index.ts`,无需 better-sqlite3 二进制即可跑通。argon2 有 prebuilds 正常工作。契约§7 留口,不影响契约。

## 状态
S3 实现完成 + backend-review 自检通过(`tsc --noEmit` 0 错;7 项 curl 自测全过)。详见回报。
