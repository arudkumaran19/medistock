import { apiRequest, setStoredToken, clearStoredAuth } from "./apiClient";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  role?: string | number;
}

export interface AuthUser {
  userId: string;
  email: string;
  roles: string[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  userId: string;
  email: string;
  roles: string[];
}

export const authApi = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const data = await apiRequest<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    setStoredToken(data.accessToken, data.refreshToken);
    localStorage.setItem(
      "medistock_user",
      JSON.stringify({
        userId: data.userId,
        email: data.email,
        roles: data.roles,
      })
    );
    return data;
  },

  async register(request: RegisterRequest): Promise<LoginResponse> {
    const payload = {
      email: request.email,
      password: request.password,
      confirmPassword: request.confirmPassword ?? request.password,
      firstName: request.firstName ?? "Staff",
      lastName: request.lastName ?? "Member",
      role: request.role ?? "OperationalStaff",
    };
    const data = await apiRequest<LoginResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setStoredToken(data.accessToken, data.refreshToken);
    localStorage.setItem(
      "medistock_user",
      JSON.stringify({
        userId: data.userId,
        email: data.email,
        roles: data.roles,
      })
    );
    return data;
  },

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const data = await apiRequest<LoginResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    setStoredToken(data.accessToken, data.refreshToken);
    return data;
  },

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem("medistock_refresh_token");
    try {
      if (refreshToken) {
        await apiRequest("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      }
    } finally {
      clearStoredAuth();
    }
  },

  async getCurrentUser(): Promise<AuthUser> {
    return apiRequest<AuthUser>("/api/auth/me");
  },
};
