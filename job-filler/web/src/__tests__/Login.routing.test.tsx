import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ApiError,
  ErrorCode,
  login as _login,
  type LoginResponse,
} from '../api/client';
import { Login } from '../pages/Login';

// 真实 ApiError/ErrorCode 保留,只 mock login(契约形态由 client.ts 类型保证)。
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return { ...actual, login: vi.fn() };
});

const login = vi.mocked(_login);

beforeEach(() => {
  vi.clearAllMocks();
  login.mockReset();
});

/** 填合法用户名/密码并提交(租户默认 acme 合法,触发真实 login 调用)。 */
async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('用户名'), 'alice');
  await user.type(screen.getByLabelText('密码'), 'password123');
  await user.click(screen.getByRole('button', { name: '登录' }));
}

describe('Login 错误码 → Notice 路由(契约 §4.1)', () => {
  it('成功 → 调 onLoginSuccess,不渲染任何 Notice', async () => {
    const onLoginSuccess = vi.fn();
    const res: LoginResponse = {
      token: 'sess_x',
      user: { id: 'u_1', tenantId: 'acme' },
      expiresAt: '2026-07-24T14:00:00Z',
    };
    login.mockResolvedValue(res);
    const user = userEvent.setup();
    render(<Login onLoginSuccess={onLoginSuccess} />);
    await fillAndSubmit(user);
    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith(res));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  const cases: Array<{ name: string; code: string; httpStatus: number; message: string; expectText: string; notice: string }> = [
    {
      name: 'INVALID_CREDENTIALS → ErrorBanner',
      code: ErrorCode.INVALID_CREDENTIALS,
      httpStatus: 401,
      message: '用户名或密码错误',
      expectText: '用户名或密码错误',
      notice: 'ErrorBanner',
    },
    {
      name: 'UNAUTHENTICATED → ErrorBanner',
      code: ErrorCode.UNAUTHENTICATED,
      httpStatus: 401,
      message: '未登录或会话已失效',
      expectText: '未登录或会话已失效',
      notice: 'ErrorBanner',
    },
    {
      name: 'INVALID_REQUEST → ErrorBanner',
      code: ErrorCode.INVALID_REQUEST,
      httpStatus: 400,
      message: '请求格式错误',
      expectText: '请求格式错误',
      notice: 'ErrorBanner',
    },
    {
      name: 'NETWORK_ERROR → ErrorBanner(网络异常)',
      code: ErrorCode.NETWORK_ERROR,
      httpStatus: 0,
      message: '网络异常,请检查连接后重试',
      expectText: '网络异常,请检查连接后重试',
      notice: 'ErrorBanner',
    },
    {
      name: '未知 code → ErrorBanner 兜底',
      code: 'SOMETHING_UNEXPECTED',
      httpStatus: 500,
      message: '内部错误',
      expectText: '内部错误',
      notice: 'ErrorBanner',
    },
    {
      name: 'RATE_LIMITED → RateLimitNotice(限流态)',
      code: ErrorCode.RATE_LIMITED,
      httpStatus: 429,
      message: '操作过于频繁,请稍后再试',
      expectText: '秒后重试',
      notice: 'RateLimitNotice',
    },
    {
      name: 'TENANT_FORBIDDEN → TenantMismatchNotice(跨租户)',
      code: ErrorCode.TENANT_FORBIDDEN,
      httpStatus: 403,
      message: '无权访问该租户',
      expectText: '可能不正确,请核对后重新登录',
      notice: 'TenantMismatchNotice',
    },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      login.mockRejectedValue(new ApiError(c.code, c.message, undefined, c.httpStatus));
      const onLoginSuccess = vi.fn();
      const user = userEvent.setup();
      render(<Login onLoginSuccess={onLoginSuccess} />);
      await fillAndSubmit(user);

      // 提交后 login 必被调用一次,且未成功
      await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
      expect(onLoginSuccess).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(c.expectText);
    });
  }

  it('前端格式校验先拦:tenantId 非法不调 login,显示字段错误', async () => {
    const onLoginSuccess = vi.fn();
    const user = userEvent.setup();
    render(<Login onLoginSuccess={onLoginSuccess} />);
    // 把合法默认 tenantId 改成非法(大写)
    fireEvent.change(screen.getByLabelText('租户标识'), { target: { value: 'Acme' } });
    await user.type(screen.getByLabelText('用户名'), 'alice');
    await user.type(screen.getByLabelText('密码'), 'password123');
    await user.click(screen.getByRole('button', { name: '登录' }));

    expect(login).not.toHaveBeenCalled();
    expect(screen.getByText(/租户标识格式错误/)).toBeInTheDocument();
  });

  it('前端格式校验:密码太短不调 login', async () => {
    const onLoginSuccess = vi.fn();
    const user = userEvent.setup();
    render(<Login onLoginSuccess={onLoginSuccess} />);
    await user.type(screen.getByLabelText('用户名'), 'alice');
    await user.type(screen.getByLabelText('密码'), 'short'); // < 8
    await user.click(screen.getByRole('button', { name: '登录' }));
    expect(login).not.toHaveBeenCalled();
    expect(screen.getByText(/密码长度 8-128/)).toBeInTheDocument();
  });
});

describe('routeError 纯函数(契约 §4.1 映射基准)', () => {
  // 独立验证 code→UI 映射,与组件渲染测试互补。
  it('RATE_LIMITED → rateLimit', async () => {
    const { routeError } = await import('../lib/routeError');
    expect(routeError(ErrorCode.RATE_LIMITED)).toBe('rateLimit');
  });
  it('TENANT_FORBIDDEN → tenantMismatch', async () => {
    const { routeError } = await import('../lib/routeError');
    expect(routeError(ErrorCode.TENANT_FORBIDDEN)).toBe('tenantMismatch');
  });
  it('其余 code → banner', async () => {
    const { routeError } = await import('../lib/routeError');
    for (const code of [
      ErrorCode.INVALID_CREDENTIALS,
      ErrorCode.UNAUTHENTICATED,
      ErrorCode.INVALID_REQUEST,
      ErrorCode.TENANT_NOT_FOUND,
      ErrorCode.RESOURCE_NOT_FOUND,
      ErrorCode.NETWORK_ERROR,
      ErrorCode.UNKNOWN,
    ]) {
      expect(routeError(code)).toBe('banner');
    }
  });
});
