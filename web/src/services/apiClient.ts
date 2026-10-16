const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5050";

export function getStoredToken(): string | null {
  return localStorage.getItem("medistock_access_token");
}

export function setStoredToken(token: string | null, refreshToken?: string | null) {
  if (token) {
    localStorage.setItem("medistock_access_token", token);
  } else {
    localStorage.removeItem("medistock_access_token");
  }
  if (refreshToken) {
    localStorage.setItem("medistock_refresh_token", refreshToken);
  } else if (refreshToken === null) {
    localStorage.removeItem("medistock_refresh_token");
  }
}

export function clearStoredAuth() {
  localStorage.removeItem("medistock_access_token");
  localStorage.removeItem("medistock_refresh_token");
  localStorage.removeItem("medistock_user");
}

/**
 * Maps HTTP status codes to contextual, user-friendly error messages.
 * Never exposes stack traces, internal server details, or protected data.
 */
function toContextualMessage(status: number, serverMessage: string): string {
  const isClean =
    Boolean(serverMessage) &&
    !serverMessage.includes("System.") &&
    !serverMessage.includes(" at ") &&
    !serverMessage.includes("StackTrace") &&
    !serverMessage.includes("Exception") &&
    serverMessage.trim().length > 0;

  switch (status) {
    case 400:
      if (isClean && !serverMessage.startsWith("HTTP")) {
        return serverMessage;
      }
      return "The request contains invalid information. Please review your entries and try again.";
    case 401:
      if (isClean && !serverMessage.startsWith("HTTP")) {
        return serverMessage;
      }
      return "Your session has expired or authentication is required. Please sign in again to continue.";
    case 403:
      if (isClean && !serverMessage.startsWith("HTTP")) {
        return serverMessage;
      }
      return "Access restricted: Your current account role does not have permission for this clinical or administrative action. Please contact your facility administrator if you require elevated authorization.";
    case 404:
      if (isClean && !serverMessage.startsWith("HTTP")) {
        return serverMessage;
      }
      return "The requested record or resource was not found. It may have been relocated or updated.";
    case 409:
      return isClean && !serverMessage.startsWith("HTTP")
        ? serverMessage
        : "This action conflicts with an existing record. Please refresh the page and try again.";
    case 422:
      return isClean && !serverMessage.startsWith("HTTP")
        ? serverMessage
        : "The submitted data could not be validated. Please check the highlighted fields and correct any errors.";
    case 500:
      return "A server processing issue occurred. The clinical database is protected and unchanged. Please try again or notify clinical IT support if the issue persists.";
    case 503:
      if (isClean && !serverMessage.startsWith("HTTP")) {
        return serverMessage;
      }
      return "The service is temporarily unavailable. The clinical database is safe and no changes were made. Please wait a moment and try again.";
    default:
      if (status >= 500) {
        return "The server encountered a temporary issue. Please wait a moment and try again.";
      }
      if (status >= 400 && isClean && !serverMessage.startsWith("HTTP")) {
        return serverMessage;
      }
      return "Unable to complete the requested action. Please verify your details or contact your administrator.";
  }
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) ?? {}),
  };

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch {
    // Network failure (CORS, no connection, DNS, etc.)
    throw Object.assign(
      new Error("Unable to reach the server. Please check your network connection and try again."),
      { code: "NETWORK_ERROR", status: 0 }
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    let errorBody: Record<string, unknown> = {};
    try {
      errorBody = await response.json();
    } catch {
      // Response body wasn't JSON; use empty object
    }

    const rawMessage: string =
      (errorBody.error as Record<string, unknown> | undefined)?.message as string ??
      (errorBody.Error as Record<string, unknown> | undefined)?.Message as string ??
      errorBody.message as string ??
      (typeof errorBody === "string" ? errorBody : "") ??
      `HTTP ${response.status}`;

    const code: string =
      (errorBody.error as Record<string, unknown> | undefined)?.code as string ??
      (errorBody.Error as Record<string, unknown> | undefined)?.Code as string ??
      errorBody.code as string ??
      `HTTP_${response.status}`;

    const message = toContextualMessage(response.status, rawMessage);

    throw Object.assign(new Error(message), {
      code,
      status: response.status,
    });
  }

  const body = await response.json();
  return body.data ?? body;
}
