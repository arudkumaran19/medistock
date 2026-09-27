const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: any
  ) {
    super(`API Error ${status} (${statusText}): ${JSON.stringify(data)}`);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    throw new ApiError(response.status, response.statusText, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const apiClient = {
  get: <T>(url: string, options?: RequestInit) => request<T>(url, { ...options, method: 'GET' }),
  post: <T>(url: string, body?: any, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(url: string, body?: any, options?: RequestInit) =>
    request<T>(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(url: string, options?: RequestInit) =>
    request<T>(url, { ...options, method: 'DELETE' }),
};
