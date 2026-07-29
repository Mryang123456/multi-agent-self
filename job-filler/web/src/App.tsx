import { useEffect, useState } from 'react';
import { ApiError, type Session, logout } from './api/client';
import { Login } from './pages/Login';
import { ErrorBanner } from './components/ErrorBanner';

// App:管理"已登录/未登录"态切换(MVP 不引 router,条件渲染)。
// token 存 sessionStorage(见底部权衡注释)。

const SESSION_KEY = 'mt_login_session';

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    if (
      s &&
      typeof s.token === 'string' &&
      s.user &&
      typeof s.user.id === 'string' &&
      typeof s.user.tenantId === 'string' &&
      typeof s.expiresAt === 'string'
    ) {
      return s as Session;
    }
    return null;
  } catch {
    return null;
  }
}

function saveSession(s: Session): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [logoutErr, setLogoutErr] = useState<ApiError | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // 挂载时从 sessionStorage 恢复(同标签刷新不掉线)
  useEffect(() => {
    setSession(loadSession());
    setHydrated(true);
  }, []);

  const onLoginSuccess = (res: Session) => {
    saveSession(res);
    setSession(res);
  };

  const onLogout = async () => {
    if (!session) return;
    setLoggingOut(true);
    setLogoutErr(null);
    try {
      await logout(session.user.tenantId, session.token);
    } catch (e) {
      // 登出请求失败(网络/已过期),仍清除本地态强制登出,仅提示
      setLogoutErr(e instanceof ApiError ? e : null);
    } finally {
      clearSession();
      setSession(null);
      setLoggingOut(false);
    }
  };

  // 避免挂载恢复前闪烁登录页
  if (!hydrated) return null;

  if (!session) return <Login onLoginSuccess={onLoginSuccess} />;

  return (
    <main className="card session-card">
      <div className="card__head">
        <h1 className="card__title">已登录</h1>
        <p className="card__subtitle">当前会话</p>
      </div>
      <dl className="session-card__list">
        <dt>租户</dt>
        <dd>{session.user.tenantId}</dd>
        <dt>用户</dt>
        <dd>{session.user.id}</dd>
        <dt>会话到期</dt>
        <dd>{session.expiresAt}</dd>
      </dl>
      <div className="session-card__actions">
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="btn-secondary"
        >
          {loggingOut ? '登出中…' : '登出'}
        </button>
      </div>
      {logoutErr && (
        <ErrorBanner message={`${logoutErr.message}(已本地登出)`} onDismiss={() => setLogoutErr(null)} />
      )}
    </main>
  );
}

// ── token 存储权衡(任务要求写明)────────────────────────────
// MVP 用 sessionStorage:不跨标签持久,标签关闭即失效,减少长期暴露面;
//   同标签刷新可恢复(对开发体验友好)。权衡:仍受 XSS 风险(JS 可读 sessionStorage),
//   MVP 接受此风险换取实现简单(无需后端 cookie 基建)。
// 生产应优先 httpOnly + Secure + SameSite cookie + CSRF 防护,token 不落到 JS 可读域;
//   切勿降级回 localStorage 明文(跨标签持久 + XSS 可读,暴露面更大)。
