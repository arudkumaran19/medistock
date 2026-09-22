const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
	const response = await fetch(`${apiBaseUrl}${path}`, { headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) }, ...options });
	if (!response.ok) { const error = await response.json().catch(() => ({ message: "Request failed" })); throw new Error(error.message ?? "Request failed"); }
	const body = await response.json(); return body.data ?? body;
}
