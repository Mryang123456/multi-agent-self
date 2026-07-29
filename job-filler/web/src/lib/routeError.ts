// 错误码 → UI 组件路由(契约 §4.1 已确认/frontend)。
// 抽成纯函数便于单测;Login.tsx 据此选择渲染哪个 Notice。
import { ErrorCode, type ErrorCodeValue } from '../api/client';

export type ErrorRoute = 'rateLimit' | 'tenantMismatch' | 'banner';

/**
 * 契约 §4.1 映射:
 *  RATE_LIMITED      → rateLimit      (RateLimitNotice,倒计时态)
 *  TENANT_FORBIDDEN  → tenantMismatch  (TenantMismatchNotice,跨租户引导)
 *  其余(INVALID_CREDENTIALS / UNAUTHENTICATED / INVALID_REQUEST /
 *       RESOURCE_NOT_FOUND / NETWORK_ERROR / 未知)
 *                    → banner         (ErrorBanner,直接展示 message)
 */
export function routeError(code: ErrorCodeValue | string): ErrorRoute {
  if (code === ErrorCode.RATE_LIMITED) return 'rateLimit';
  if (code === ErrorCode.TENANT_FORBIDDEN) return 'tenantMismatch';
  return 'banner';
}
