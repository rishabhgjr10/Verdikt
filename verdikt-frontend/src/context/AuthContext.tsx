"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, AuthResponse } from "@/types/media";
import { authApi } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (data: { username?: string; email?: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("verdikt_token");
      const storedUser = localStorage.getItem("verdikt_user");

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error("Failed to restore auth state from localStorage", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAuthSuccess = (data: AuthResponse) => {
    const userObj: User = {
      id: data.id,
      username: data.username,
      email: data.email,
      avatarUrl: data.avatarUrl,
    };
    setToken(data.token);
    setUser(userObj);
    localStorage.setItem("verdikt_token", data.token);
    localStorage.setItem("verdikt_user", JSON.stringify(userObj));
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
    setUser(null);
    setToken(null);
    localStorage.removeItem("verdikt_token");
    localStorage.removeItem("verdikt_user");
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
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
