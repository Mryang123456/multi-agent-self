import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initDb } from './db/index.js';
import { authRouter } from './routes/auth.js';
import { errorHandler, notFoundHandler } from './errors.js';

// 入口:挂载路由 + 中间件 + 统一错误处理(契约 multi-tenant-login-api.md §0 envelope)。
const app = express();

app.use(cors()); // MVP 本地全开;生产应按 origin 白名单收紧(§7/记忆 job-filler-server 同款)
app.use(express.json());

// 健康检查(非契约范围,运维用)
app.get('/health', (_req, res) => res.json({ ok: true }));

// 登录/登出 → /api/:tenantId/login | /api/:tenantId/logout
app.use('/api', authRouter);

// 404 兜底(契约 §4 RESOURCE_NOT_FOUND)
app.use(notFoundHandler);

// 统一错误中间件(契约 §0 envelope: {error:{code,message,details?}})
app.use(errorHandler);

async function main() {
  await initDb(); // 建表(已 exec)+ 幂等种子(含 argon2 异步哈希)
  app.listen(config.port, () => {
    console.log(`saas-erp-api on http://localhost:${config.port}`);
  });
}

const shouldListen = import.meta.url === `file://${process.argv[1]}`;
if (shouldListen) {
  main().catch((e) => {
    console.error('[server] startup failed:', e);
    process.exit(1);
  });
}

export default app;
