// API 客户端 — 多租户登录契约 multi-tenant-login-api.md v1.1
// envelope(§0 已确认/user Q-1):成功裸对象 {token,user,expiresAt};
//   错误统一 {error:{code,message,details?}}。
// 本地开发走 Vite proxy(/api → http://localhost:3000),BASE 留空串;
//   生产读 import.meta.env.VITE_API_BASE。

export const ErrorCode = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TENANT_FORBIDDEN: 'TENANT_FORBIDDEN',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN', // 兜底:服务端返回未识别 code 或非 envelope 错误体
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** 契约 §4.1 可选机器可读补充(如限流 retryAfter)。不泄露敏感信息。 */
export interface ErrorDetails {
  retryAfter?: number; // 限流建议等待秒数
  [key: string]: unknown;
}

/**
 * 统一错误。前端据 `code` 路由 UI(契约 §4.1)。
 * 网络层失败(连不上/中断)用 code=NETWORK_ERROR,httpStatus=0。
 */
export class ApiError extends Error {
  readonly code: ErrorCodeValue | string;
  readonly details?: ErrorDetails;
  readonly httpStatus: number;

  constructor(
    code: ErrorCodeValue | string,
    message: string,
    details?: ErrorDetails,
    httpStatus = 0,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;
  }
}

export interface LoginUser {
  id: string;
  tenantId: string;
}

export interface LoginResponse {
  token: string;
  user: LoginUser;
  expiresAt: string; // ISO8601/UTC(契约 §0)
}

/** 会话快照:存 sessionStorage 供已登录态恢复。 */
export interface Session extends LoginResponse {}

const BASE = import.meta.env.VITE_API_BASE ?? ''; // 本地走 Vite proxy,空串

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** 运行时校验成功体形态(契约 §1),兼做类型守卫避免 any/as。 */
function isLoginResponse(body: unknown): body is LoginResponse {
  return (
    isObject(body) &&
    typeof body.token === 'string' &&
    isObject(body.user) &&
    typeof body.user.id === 'string' &&
    typeof body.user.tenantId === 'string' &&
    typeof body.expiresAt === 'string'
  );
}

/** 解析文本响应体为 JSON;空体或非法 JSON 返回 null。 */
async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 从响应体提 envelope 错误为 ApiError;非 envelope 兜底 UNKNOWN。 */
function toApiError(body: unknown, httpStatus: number): ApiError {
  const err = isObject(body) && isObject(body.error) ? body.error : {};
  const code = typeof err.code === 'string' && err.code ? err.code : ErrorCode.UNKNOWN;
  const message =
    typeof err.message === 'string' && err.message
      ? err.message
      : httpStatus >= 500
        ? '服务异常,请稍后重试'
        : '请求失败,请稍后重试';
  const details = isObject(err.details) ? (err.details as ErrorDetails) : undefined;
  return new ApiError(code, message, details, httpStatus);
}

// POST /api/:tenantId/login(契约 §1)
// 成功(2xx)→ {token,user:{id,tenantId},expiresAt};
// 非 2xx → 抛 ApiError(code 来自 envelope);
// 网络失败 → 抛 ApiError(NETWORK_ERROR)。
export async function login(
  tenantId: string,
  username: string,
  password: string,
): Promise<LoginResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/${encodeURIComponent(tenantId)}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new ApiError(ErrorCode.NETWORK_ERROR, '网络异常,请检查连接后重试');
  }

  const body = await readJson(res);

  if (!res.ok) throw toApiError(body, res.status);

  // 成功体形态校验,防后端返回畸形对象
  if (!isLoginResponse(body)) {
    throw new ApiError(ErrorCode.UNKNOWN, '登录响应格式异常', undefined, res.status);
  }
  return body;
}

// POST /api/:tenantId/logout(契约 §3)→ 204 无响应体,幂等。
// 带 Authorization: Bearer <token>。
export async function logout(tenantId: string, token: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/${encodeURIComponent(tenantId)}/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError(ErrorCode.NETWORK_ERROR, '网络异常,登出未确认');
  }

  if (res.status === 204) return;

  const body = await readJson(res);
  throw toApiError(body, res.status);
}
