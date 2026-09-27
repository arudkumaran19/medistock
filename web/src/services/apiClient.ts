const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5182";

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

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) ?? {}),
  };

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      message: `Request failed with status ${response.status}`,
    }));
    const message =
      errorBody.error?.message ??
      errorBody.Error?.Message ??
      errorBody.message ??
      (typeof errorBody === "string" ? errorBody : `HTTP ${response.status}`);
    const code = errorBody.error?.code ?? errorBody.Error?.Code ?? errorBody.code ?? `HTTP_${response.status}`;
    const err = new Error(message);
    (err as unknown as { code: string; status: number }).code = code;
    (err as unknown as { code: string; status: number }).status = response.status;
    throw err;
  }

  const body = await response.json();
  return body.data ?? body;
}
