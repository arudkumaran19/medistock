/**
 * SHARED REACT DESIGN SYSTEM - primary owner: Arudkumaran V. (IT24103011).
 * Placeholder created by the Demand vertical (Sathurstiga S., IT24103156).
 *
 * The heading explains the failure in plain language; the raw message is kept
 * underneath as supporting detail, so a reader gets the meaning first and the
 * diagnostic second rather than a bare exception.
 */
export function ErrorState({
  message,
  title = 'Something went wrong',
  onRetry,
}: {
  message: string;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon" aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </span>
      <p className="state__title">{title}</p>
      <p className="state__message">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorState;
