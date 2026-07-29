import type { Response, RequestHandler, NextFunction, Request } from 'express';

// 契约 multi-tenant-login-api.md §0/§4:统一 envelope。
// 成功 → 裸业务对象(由各路由直接 res.json);错误 → {error:{code,message,details?}}。

// 错误码(§4 表;INTERNAL_ERROR 为运行时兜底,非 §4 业务码,仅用于不可预期的 500)。
export const ErrorCode = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TENANT_FORBIDDEN: 'TENANT_FORBIDDEN',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// 对外安全文案(§4 表),统一在此维护,避免散落。
const MESSAGES: Record<string, string> = {
  INVALID_REQUEST: '请求格式错误',
  UNAUTHENTICATED: '未登录或会话已失效',
  INVALID_CREDENTIALS: '用户名或密码错误',
  TENANT_FORBIDDEN: '无权访问该租户',
  TENANT_NOT_FOUND: '租户不存在',
  RESOURCE_NOT_FOUND: '资源不存在',
  RATE_LIMITED: '请求过于频繁,稍后再试',
  INTERNAL_ERROR: '服务器内部错误',
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    public readonly message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 路由内快速返回错误 envelope。
export function fail(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  details?: unknown
): void {
  const body: { error: { code: string; message: string; details?: unknown } } = {
    error: { code, message },
  };
  if (details !== undefined) body.error.details = details;
  res.status(status).json(body);
}

// 便捷工厂(用 §4 文案)。
export const Errors = {
  invalidRequest: (details?: unknown) =>
    new ApiError(400, ErrorCode.INVALID_REQUEST, MESSAGES.INVALID_REQUEST, details),
  unauthenticated: () =>
    new ApiError(401, ErrorCode.UNAUTHENTICATED, MESSAGES.UNAUTHENTICATED),
  invalidCredentials: () =>
    new ApiError(401, ErrorCode.INVALID_CREDENTIALS, MESSAGES.INVALID_CREDENTIALS),
  tenantForbidden: () =>
    new ApiError(403, ErrorCode.TENANT_FORBIDDEN, MESSAGES.TENANT_FORBIDDEN),
  rateLimited: () => new ApiError(429, ErrorCode.RATE_LIMITED, MESSAGES.RATE_LIMITED),
  resourceNotFound: () =>
    new ApiError(404, ErrorCode.RESOURCE_NOT_FOUND, MESSAGES.RESOURCE_NOT_FOUND),
};

// Express 4 不自动捕获 async 路由的 rejected promise,用此包装转发到 errorHandler。
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// 404 兜底:未命中任何路由。契约 §4 RESOURCE_NOT_FOUND("资源不存在")。
export const notFoundHandler: RequestHandler = (_req: Request, res: Response) => {
  fail(res, 404, ErrorCode.RESOURCE_NOT_FOUND, MESSAGES.RESOURCE_NOT_FOUND);
};

// 统一错误中间件:把 ApiError / ZodError / JSON 解析错误 / 兜底 转成 envelope。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod 校验失败 → 400 INVALID_REQUEST(details 带字段,不泄露敏感信息)。
  if (err && typeof err === 'object' && 'issues' in err && Array.isArray((err as any).issues)) {
    const issues = (err as any).issues as Array<{ path: PropertyKey[]; message: string }>;
    fail(res, 400, ErrorCode.INVALID_REQUEST, MESSAGES.INVALID_REQUEST, {
      fields: issues.map((i) => ({ path: i.path, message: i.message })),
    });
    return;
  }
  // express.json() 解析失败(SyntaxError)→ 400 INVALID_REQUEST。
  if (err instanceof SyntaxError && 'body' in err && (err as any).type === 'entity.parse.failed') {
    fail(res, 400, ErrorCode.INVALID_REQUEST, MESSAGES.INVALID_REQUEST);
    return;
  }
  if (err instanceof ApiError) {
    fail(res, err.status, err.code, err.message, err.details);
    return;
  }
  // 兜底:不可预期错误,记栈到服务端日志(不外发),对外只给 INTERNAL_ERROR。
  console.error('[error] unexpected:', err);
  fail(res, 500, ErrorCode.INTERNAL_ERROR, MESSAGES.INTERNAL_ERROR);
}
