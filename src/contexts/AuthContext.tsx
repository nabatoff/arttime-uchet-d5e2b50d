import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (login: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "logistics_session";

interface StoredSession {
  user: User;
  login: string;
  password: string;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  // Verify session on mount
  useEffect(() => {
    const verifySession = async () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }

      try {
        const session: StoredSession = JSON.parse(stored);
        const result = await api.verifyPassword(session.login, session.password);
        if (result.success && result.data?.valid) {
          setState({ user: session.user, isLoading: false, isAuthenticated: true });
        } else {
          logout();
        }
      } catch {
        // If API is unreachable, keep session (offline mode)
        try {
          const session: StoredSession = JSON.parse(stored);
          setState({ user: session.user, isLoading: false, isAuthenticated: true });
        } catch {
          logout();
        }
      }
    };

    verifySession();
  }, [logout]);

  const login = async (loginVal: string, password: string) => {
    const result = await api.login(loginVal, password);
    if (result.success && result.data) {
      const session: StoredSession = {
        user: result.data,
        login: loginVal,
        password,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      setState({ user: result.data, isLoading: false, isAuthenticated: true });
      return { success: true };
    }
    return { success: false, error: result.error || "Неверный логин или пароль" };
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
