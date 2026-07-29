// 403 TENANT_FORBIDDEN 跨租户提示 UI(契约 §4.1 已确认/frontend):
//   跨租户越权,非裸 message。"无权访问该租户" + 引导检查 tenantId 输入。
//   契约 §2/§3:path tenantId ≠ token tenantId 触发;登录态复用 token 跨租户访问会命中。
interface TenantMismatchNoticeProps {
  message: string;
  /** 当前输入/会话的 tenantId,用于提示回显,引导核对。 */
  tenantId: string;
  onDismiss?: () => void;
}

export function TenantMismatchNotice({ message, tenantId, onDismiss }: TenantMismatchNoticeProps) {
  return (
    <div role="alert" className="notice notice--mismatch">
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
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div className="notice__body">
        <div>{message}</div>
        <div className="tenantmismatch__hint">
          当前租户标识「<span className="tenantmismatch__code">{tenantId}</span>」可能不正确,请核对后重新登录。
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="关闭提示"
          className="notice__close"
        >
          ×
        </button>
      )}
    </div>
  );
}
