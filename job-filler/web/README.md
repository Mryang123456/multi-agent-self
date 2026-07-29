# saas-erp-web

多租户登录前端:React 18 + TypeScript(strict)+ Vite。

## 契约
单一事实源:`~/.claude/team-memory/shared/contracts/multi-tenant-login-api.md` v1.1。
envelope:成功裸对象 `{token,user:{id,tenantId},expiresAt}`;错误 `{error:{code,message,details?}}`。

## 职责(对应契约)
- `src/api/client.ts` — fetch 封装,导出 `ErrorCode` 常量、`ApiError`(类)、`login`/`logout`。base 走 Vite proxy。
- `src/pages/Login.tsx` — 三输入(tenantId/username/password)+ 前端格式校验 + 提交 + 错误码路由。
- `src/lib/routeError.ts` — `code → UI` 纯函数映射(契约 §4.1),集中可测。
- 状态码消费组件(契约 §4.1,已确认/frontend Q-4):
  - `ErrorBanner` — 直接展示 `error.message`(INVALID_CREDENTIALS / UNAUTHENTICATED / INVALID_REQUEST / TENANT_NOT_FOUND / RESOURCE_NOT_FOUND / NETWORK_ERROR / 未知)
  - `RateLimitNotice` — 429 限流提示 UI(倒计时/"稍后再试",缺省 60s,envelope `details.retryAfter` 优先)
  - `TenantMismatchNotice` — 403 跨租户提示 UI(引导核对 tenantId)
- `src/App.tsx` — 已登录/未登录态切换 + sessionStorage 恢复 + 登出。

## 错误码 → UI 路由(契约 §4.1)
| code | UI |
|------|----|
| RATE_LIMITED | RateLimitNotice(倒计时,提交按钮禁用至归零) |
| TENANT_FORBIDDEN | TenantMismatchNotice(跨租户引导) |
| INVALID_CREDENTIALS / UNAUTHENTICATED / INVALID_REQUEST / TENANT_NOT_FOUND / RESOURCE_NOT_FOUND / NETWORK_ERROR / UNKNOWN | ErrorBanner |

## 启动
```
cp .env.example .env      # 本地留空即走 Vite proxy
npm install
npm run dev               # Vite :5173,proxy /api → http://localhost:3000
```
联调:后端在 :3000(proxy 已配)。后端未跑时,前端按契约形态实现,可独立构建/类型检查。

## token 存储权衡
MVP 用 `sessionStorage`(`mt_login_session`):不跨标签持久,标签关闭即失效,减少长期暴露;同标签刷新可恢复。
**权衡**:仍受 XSS 风险(JS 可读)。MVP 接受此风险换取实现简单(无需后端 cookie 基建)。
**生产应**优先 `httpOnly + Secure + SameSite` cookie + CSRF 防护,token 不落到 JS 可读域;**切勿**降级回 `localStorage` 明文(跨标签持久 + XSS 可读,暴露面更大)。详见 `src/App.tsx` 尾部注释。

## 测试
```
npm run typecheck   # tsc --noEmit
npm run build       # tsc -b && vite build
npm test            # vitest(错误码→Notice 路由单测)
```
