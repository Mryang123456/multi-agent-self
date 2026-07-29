import { useCallback, useState } from 'react';
import {
  ApiError,
  ErrorCode,
  type LoginResponse,
  login,
} from '../api/client';
import { routeError } from '../lib/routeError';
import { ErrorBanner } from '../components/ErrorBanner';
import { RateLimitNotice } from '../components/RateLimitNotice';
import { TenantMismatchNotice } from '../components/TenantMismatchNotice';

// 租户 slug(契约 §0):全小写,^[a-z0-9][a-z0-9-]{1,63}$,总长 2~64。
const TENANT_ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
// 限流倒计时缺省秒数(契约 §7:窗口 60s)。envelope details.retryAfter 优先。
const DEFAULT_RETRY_SECONDS = 60;

interface FieldErrors {
  tenantId?: string;
  username?: string;
  password?: string;
}

interface LoginProps {
  /** 登录成功回调(App 落 sessionStorage 并切已登录态)。 */
  onLoginSuccess: (res: LoginResponse) => void;
}

// 登录页:调 POST /api/:tenantId/login(契约 §1)。错误码消费见契约 §4.1。
export function Login({ onLoginSuccess }: LoginProps) {
  const [tenantId, setTenantId] = useState('acme');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [err, setErr] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryUntil, setRetryUntil] = useState<number | null>(null);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!TENANT_ID_RE.test(tenantId)) {
      e.tenantId = '租户标识格式错误(小写字母/数字/连字符,2-64 位)';
    }
    if (username.length < 1 || username.length > 64) {
      e.username = '用户名长度 1-64';
    }
    if (password.length < 8 || password.length > 128) {
      e.password = '密码长度 8-128';
    }
    return e;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    // 前端先拦格式错,不浪费请求
    const fe = validate();
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return;

    setSubmitting(true);
    try {
      const res = await login(tenantId, username, password);
      onLoginSuccess(res);
    } catch (e) {
      const apiErr =
        e instanceof ApiError ? e : new ApiError(ErrorCode.UNKNOWN, '发生未知错误');
      setErr(apiErr);
      if (apiErr.code === ErrorCode.RATE_LIMITED) {
        const ra = apiErr.details?.retryAfter;
        const secs =
          typeof ra === 'number' && ra > 0 ? ra : DEFAULT_RETRY_SECONDS;
        setRetryUntil(Date.now() + secs * 1000);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const onRateLimitExpire = useCallback(() => {
    setRetryUntil(null);
    setErr(null);
  }, []);

  const route = err ? routeError(err.code) : null;
  const submitDisabled = submitting || retryUntil !== null;

  return (
    <form onSubmit={onSubmit} noValidate className="card">
      <div className="card__head">
        <h1 className="card__title">登录</h1>
        <p className="card__subtitle">多租户登录</p>
      </div>

      <div className="field">
        <label htmlFor="login-tenant" className="field__label">
          租户标识
        </label>
        <input
          id="login-tenant"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          autoComplete="organization"
          placeholder="如 acme"
          aria-invalid={!!fieldErrors.tenantId}
          aria-describedby={fieldErrors.tenantId ? 'login-tenant-err' : undefined}
          className="field__input"
        />
        {fieldErrors.tenantId && (
          <span id="login-tenant-err" className="field__error">
            {fieldErrors.tenantId}
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="login-user" className="field__label">
          用户名
        </label>
        <input
          id="login-user"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="1-64 字符"
          aria-invalid={!!fieldErrors.username}
          aria-describedby={fieldErrors.username ? 'login-user-err' : undefined}
          className="field__input"
        />
        {fieldErrors.username && (
          <span id="login-user-err" className="field__error">
            {fieldErrors.username}
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="login-pass" className="field__label">
          密码
        </label>
        <input
          id="login-pass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="8-128 字符"
          aria-invalid={!!fieldErrors.password}
          aria-describedby={fieldErrors.password ? 'login-pass-err' : undefined}
          className="field__input"
        />
        {fieldErrors.password && (
          <span id="login-pass-err" className="field__error">
            {fieldErrors.password}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={submitDisabled}
        className="btn-primary"
      >
        {submitting && (
          <svg
            className="btn-primary__spinner"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.3"
              strokeWidth="4"
            />
            <path
              d="M22 12a10 10 0 0 1-10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        )}
        {submitting ? '登录中…' : '登录'}
      </button>

      {/* 错误码 → Notice 路由(契约 §4.1) */}
      {route === 'rateLimit' && err && retryUntil !== null && (
        <RateLimitNotice
          message={err.message}
          retryUntil={retryUntil}
          onExpire={onRateLimitExpire}
        />
      )}
      {route === 'tenantMismatch' && err && (
        <TenantMismatchNotice
          message={err.message}
          tenantId={tenantId}
          onDismiss={() => setErr(null)}
        />
      )}
      {route === 'banner' && err && (
        <ErrorBanner message={err.message} onDismiss={() => setErr(null)} />
      )}
    </form>
  );
}
