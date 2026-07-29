// 429 RATE_LIMITED 限流提示 UI(契约 §4.1 已确认/frontend):
//   限流态,非裸 message。"操作过于频繁,请稍后再试" + 倒计时,到点回调 onExpire
//   让 Login 重新启用提交按钮。倒计时秒数取自 envelope details.retryAfter,缺省 60s。
import { useEffect, useState } from 'react';

interface RateLimitNoticeProps {
  message: string;
  /** 倒计时终点(epoch ms)。Login 计算 = now + retryAfter*1000(缺省 60s)。 */
  retryUntil: number;
  /** 倒计时归零回调(Login 清除限流态、重新启用提交)。 */
  onExpire: () => void;
}

export function RateLimitNotice({ message, retryUntil, onExpire }: RateLimitNoticeProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000)),
  );

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) {
        clearInterval(timer);
        onExpire();
      }
    };
    const timer = setInterval(tick, 250); // 250ms 提升到点精度
    tick();
    return () => clearInterval(timer);
  }, [retryUntil, onExpire]);

  return (
    <div role="alert" className="notice notice--warning">
      <svg
        className="notice__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 7 12 12 16 14" />
      </svg>
      <div className="notice__body">
        <div>{message}</div>
        <div className="ratelimit__countdown">
          {remaining > 0 ? `请在 ${remaining} 秒后重试` : '可重新尝试'}
        </div>
      </div>
    </div>
  );
}
