---
name: multi-tenant-login-frontend
description: 多租户登录前端实现要点(envelope基准/code→UI状态码路由/sessionStorage权衡/Vite tsc -b composite坑)。做该项目前端登录或类似envelope契约联调时相关。
type: project
status: active
---

# 多租户登录前端实现要点

来源任务:S3 多租户登录前端(`~/saas-erp/web`),2026-07-24。契约 `shared/contracts/multi-tenant-login-api.md` v1.1。

## envelope 基准(项目首个契约基准,已确认/user Q-1)
- 成功响应裸对象(如 `{token,user:{id,tenantId},expiresAt}`);错误统一 `{error:{code,message,details?}}`。
- 前后端均按此形态联调。后续接口契约照此对齐。

## code→UI 状态码消费(契约 §4.1,已确认/frontend Q-4)
- `RATE_LIMITED` → 限流提示 UI(倒计时/"稍后再试"态,非裸 message)。前端:retryUntil 态,提交按钮禁用至归零;缺省 60s,envelope `details.retryAfter` 优先。
- `TENANT_FORBIDDEN` → 跨租户提示 UI(引导核对 tenantId,非裸 message)。
- 其余(INVALID_CREDENTIALS/UNAUTHENTICATED/INVALID_REQUEST/TENANT_NOT_FOUND/RESOURCE_NOT_FOUND/NETWORK_ERROR/UNKNOWN)→ 直接展示 error.message(ErrorBanner)。
- 安全点:INVALID_CREDENTIALS 与 TENANT_MISMATCH 对外同体(防探查),前端不区分。

## token 存储权衡
- MVP:`sessionStorage`(key `mt_login_session`),不跨标签持久,标签关即失效;同标签刷新可恢复。接受 XSS 风险换简单。
- 生产:**httpOnly + Secure + SameSite cookie + CSRF**,token 不落 JS 可读域。**切勿**降级回 localStorage 明文。

## Vite + TS 踩坑:`tsc -b` 项目引用 noEmit
- 现象:根 tsconfig `references` 引用 node 项目,被引项目若 `noEmit:true` → `tsc -b` 报 TS6310 "Referenced project may not disable emit"(TS5.7 仍报)。
- 解法:被引项目 `composite:true` + 去 `noEmit` + `outDir`/`tsBuildInfoFile` 落 `node_modules/.tmp/`,emit 不污染源码树。
- 另:vitest `globals:false` 时 RTL 不自动 cleanup(检测不到全局 afterEach),需在 setup.ts 手动 `afterEach(cleanup)`,否则跨测 DOM 累积、`getByLabelText` 命中多个。

## 状态码路由自测范式
- 纯函数 `routeError(code)→'rateLimit'|'tenantMismatch'|'banner'` 集中映射,组件据此渲染;可纯函数断言 + 组件渲染(mock client reject 各 code)双重覆盖。
