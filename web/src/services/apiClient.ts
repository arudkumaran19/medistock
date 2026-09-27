/**
 * SHARED - Axios instance for the ASP.NET Core API.
 *
 * Placeholder created by the Demand vertical (Sathurstiga S., IT24103156) so the
 * demand feature can call the API. The web owners replace this on integration.
 *
 * React never calls the internal agent service. Every request goes to the
 * authoritative ASP.NET Core API.
 */
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('medistock.accessToken');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Storage unavailable: the request goes out unauthenticated and the API decides.
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // An expired or rejected token should drop the session rather than leave every
    // page showing an unexplained error. The sign-in redirect is handled by
    // ProtectedRoute once the session is gone.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      try {
        localStorage.removeItem('medistock.session');
        localStorage.removeItem('medistock.accessToken');
      } catch {
        // Nothing to clear.
      }

      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/sign-in')) {
        window.location.assign('/sign-in');
      }
    }

    return Promise.reject(error);
  },
);

/** Pulls the agreed error contract out of a failed response. */
export function toErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const contract = error.response?.data as
      | { error?: { message?: string; code?: string } }
      | undefined;

    if (contract?.error?.message) {
      return contract.error.message;
    }

    if (error.response?.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }

    if (error.code === 'ERR_NETWORK') {
      return 'The API could not be reached. Check that the backend is running on port 5000.';
    }

    return error.message;
  }

  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
