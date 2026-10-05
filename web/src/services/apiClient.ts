const BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:5050";

export class ApiError extends Error {
  public code?: string;
  constructor(
    public status: number,
    public statusText: string,
    public data: any
  ) {
    super(`API Error ${status} (${statusText}): ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    this.name = 'ApiError';
    this.code = data?.error?.code ?? data?.Error?.Code ?? data?.code ?? `HTTP_${status}`;
  }
}

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

  const response = await fetch(`${BASE_URL}${path}`, {
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
    const err = new ApiError(response.status, response.statusText, errorBody);
    (err as unknown as { code: string; status: number }).code = code;
    (err as unknown as { code: string; status: number }).status = response.status;
    throw err;
  }

  const body = await response.json();
  return body.data ?? body;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    throw new ApiError(response.status, response.statusText, errorData);
  }

  const data = await response.json();
  return data;
}

export const apiClient = {
  get: <T>(url: string, options?: RequestInit) => request<T>(url, { ...options, method: 'GET' }),
  post: <T>(url: string, body?: any, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: 'POST',
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),
  put: <T>(url: string, body?: any, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: 'PUT',
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),
  delete: <T>(url: string, options?: RequestInit) =>
    request<T>(url, { ...options, method: 'DELETE' }),
};
