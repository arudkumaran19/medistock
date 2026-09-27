import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { authApi, type AuthUser, type LoginRequest, type RegisterRequest } from "../../services/authApi";
import { getStoredToken, clearStoredAuth } from "../../services/apiClient";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem("medistock_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function initAuth() {
      const storedToken = getStoredToken();
      if (storedToken) {
        try {
          const currentUser = await authApi.getCurrentUser();
          setUser(currentUser);
          localStorage.setItem("medistock_user", JSON.stringify(currentUser));
        } catch {
          // If token expired or invalid, clear stored auth
          clearStoredAuth();
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    }
    initAuth();
  }, []);

  async function login(credentials: LoginRequest) {
    setIsLoading(true);
    try {
      const response = await authApi.login(credentials);
      setToken(response.accessToken);
      const authUser: AuthUser = {
        userId: response.userId,
        email: response.email,
        roles: Array.from(response.roles),
      };
      setUser(authUser);
    } finally {
      setIsLoading(false);
    }
  }

  async function register(data: RegisterRequest) {
    setIsLoading(true);
    try {
      const response = await authApi.register(data);
      setToken(response.accessToken);
      const authUser: AuthUser = {
        userId: response.userId,
        email: response.email,
        roles: Array.from(response.roles),
      };
      setUser(authUser);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    setIsLoading(true);
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setToken(null);
      setIsLoading(false);
    }
  }

  function hasRole(role: string): boolean {
    if (!user) return false;
    return user.roles.includes(role) || user.roles.includes("ADMIN") || user.roles.includes("Administrator");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const defaultAuthContext: AuthContextType = {
  user: {
    userId: "demo-manager",
    email: "manager@medistock.com",
    roles: ["FacilityManager", "OperationalStaff", "SupplierOfficer", "Administrator"],
  },
  token: "demo-token",
  isAuthenticated: true,
  isLoading: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  hasRole: () => true,
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    return defaultAuthContext;
  }
  return context;
}

