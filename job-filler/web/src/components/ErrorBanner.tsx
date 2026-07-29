// 通用错误展示(契约 §4.1 已确认/frontend):
//   INVALID_CREDENTIALS / UNAUTHENTICATED / INVALID_REQUEST /
//   TENANT_NOT_FOUND / RESOURCE_NOT_FOUND / NETWORK_ERROR / 未知 → 直接展示 error.message
// 无障碍:role="alert" + aria-live,屏幕阅读器即时播报。
interface ErrorBannerProps {
  message: string;
  /** 'warning' 用于可恢复的提示(中性灰);'error'(默认)用于硬错误(红)。 */
  variant?: 'error' | 'warning';
  /** 提供则显示关闭按钮(非全屏阻塞)。 */
  onDismiss?: () => void;
}

// icon 仅装饰,aria-hidden 不进入可访问名,不新增 role(保证仅一个 role="alert")。
function ErrorIcon() {
  return (
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
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function InfoIcon() {
  return (
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
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function ErrorBanner({ message, variant = 'error', onDismiss }: ErrorBannerProps) {
  const isWarning = variant === 'warning';

  return (
    <div
      role="alert"
      className={`notice ${isWarning ? 'notice--neutral' : 'notice--error'}`}
    >
      {isWarning ? <InfoIcon /> : <ErrorIcon />}
      <span className="notice__body">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="关闭错误提示"
          className="notice__close"
        >
          ×
        </button>
      )}
    </div>
  );
}
