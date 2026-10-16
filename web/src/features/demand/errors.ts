/**
 * Error presentation for the Demand & Shortage screens.
 * Sathurstiga S. (IT24103156).
 *
 * develop's shared apiRequest throws a plain Error carrying `code` and `status` from
 * the backend's error contract. This turns that into something a manager can read.
 * It lives in this feature because the shared client owner did not provide one.
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  return 'Something went wrong. Please try again.';
}

/** Backend error code, when the shared client attached one. */
export function toErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}
