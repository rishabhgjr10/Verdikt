"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { User, AuthResponse } from "@/types/media";
import { authApi, profileApi } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (data: { username?: string; email?: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  /** Replace the stored user with the server's latest copy (after a profile save) */
  setUser: (user: User) => void;
  /** Swap in a new token and user (after a username change, which invalidates the old token) */
  replaceSession: (data: AuthResponse) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const persistUser = (user: User) => {
  try {
    localStorage.setItem("verdikt_user", JSON.stringify(user));
  } catch {
    // storage full or blocked: the in-memory user still works for this visit
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setUser = useCallback((next: User) => {
    setUserState(next);
    persistUser(next);
  }, []);

  // Profile fields (name, bio, links, avatar) live on the server; refresh them after sign-in and on each visit
  const refreshProfile = useCallback(() => {
    profileApi
      .me()
      .then(setUser)
      .catch(() => {
        // offline or the backend is waking up: keep the stored copy
      });
  }, [setUser]);

  useEffect(() => {
    let restored = false;
    try {
      const storedToken = localStorage.getItem("verdikt_token");
      const storedUser = localStorage.getItem("verdikt_user");

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUserState(JSON.parse(storedUser));
        restored = true;
      }
    } catch (e) {
      console.error("Failed to restore auth state from localStorage", e);
    } finally {
      setIsLoading(false);
    }
    if (restored) refreshProfile();
  }, [refreshProfile]);

  const replaceSession = useCallback(
    (data: AuthResponse) => {
      setToken(data.token);
      localStorage.setItem("verdikt_token", data.token);
      setUserState((prev) => {
        const next: User = { ...(prev ?? {}), id: data.id, username: data.username, email: data.email, avatarUrl: data.avatarUrl };
        persistUser(next);
        return next;
      });
    },
    []
  );

  const handleAuthSuccess = (data: AuthResponse) => {
    const userObj: User = {
      id: data.id,
      username: data.username,
      email: data.email,
      avatarUrl: data.avatarUrl,
    };
    setToken(data.token);
    setUserState(userObj);
    localStorage.setItem("verdikt_token", data.token);
    persistUser(userObj);
    refreshProfile();
  };

  const login = async (data: { username?: string; email?: string; password: string }) => {
    const res = await authApi.login(data);
    handleAuthSuccess(res);
  };

  const register = async (data: { username: string; email: string; password: string }) => {
    const res = await authApi.register(data);
    handleAuthSuccess(res);
  };

  const logout = () => {
    setUserState(null);
    setToken(null);
    localStorage.removeItem("verdikt_token");
    localStorage.removeItem("verdikt_user");
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, setUser, replaceSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
