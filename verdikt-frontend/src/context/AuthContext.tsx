"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { User, AuthResponse } from "@/types/media";
import { authApi, profileApi, SESSION_EXPIRED_EVENT } from "@/lib/api";
import { buildAuthHref } from "@/lib/auth-redirect";
import { useIsClient } from "@/lib/use-is-client";

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

// ── The session lives in localStorage; React reads it as an external store ──────────────────────────
// Reading it with useSyncExternalStore (rather than copying it into state from an effect) keeps the first client
// render identical to the server's, and other tabs follow sign-in and sign-out through the storage event.
const TOKEN_KEY = "verdikt_token";
const USER_KEY = "verdikt_user";
const AUTH_CHANGED = "verdikt:auth-changed";
/** Writes that storage refused (blocked or full), so this visit still works signed in */
const memory = new Map<string, string | null>();

function readKey(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    memory.delete(key);
  } catch {
    memory.set(key, value);
  }
}

function notify() {
  window.dispatchEvent(new Event(AUTH_CHANGED));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === TOKEN_KEY || e.key === USER_KEY || e.key === null) {
      memory.clear();
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(AUTH_CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(AUTH_CHANGED, onChange);
  };
}

const serverSnapshot = () => null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useSyncExternalStore(subscribe, () => readKey(TOKEN_KEY), serverSnapshot);
  const userJson = useSyncExternalStore(subscribe, () => readKey(USER_KEY), serverSnapshot);
  const isLoading = !useIsClient();
  const user = useMemo<User | null>(() => {
    if (!token || !userJson) return null;
    try {
      return JSON.parse(userJson) as User;
    } catch {
      return null;
    }
  }, [token, userJson]);

  const setUser = useCallback((next: User) => {
    writeKey(USER_KEY, JSON.stringify(next));
    notify();
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
    if (readKey(TOKEN_KEY)) refreshProfile();
  }, [refreshProfile]);

  const replaceSession = useCallback((data: AuthResponse) => {
    let prev: Partial<User> = {};
    try {
      prev = JSON.parse(readKey(USER_KEY) ?? "{}");
    } catch {
      // a corrupt stored user is simply replaced
    }
    writeKey(TOKEN_KEY, data.token);
    writeKey(USER_KEY, JSON.stringify({ ...prev, id: data.id, username: data.username, email: data.email, avatarUrl: data.avatarUrl }));
    notify();
  }, []);

  const handleAuthSuccess = (data: AuthResponse) => {
    const userObj: User = { id: data.id, username: data.username, email: data.email, avatarUrl: data.avatarUrl };
    writeKey(TOKEN_KEY, data.token);
    writeKey(USER_KEY, JSON.stringify(userObj));
    notify();
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

  const logout = useCallback(() => {
    writeKey(TOKEN_KEY, null);
    writeKey(USER_KEY, null);
    notify();
  }, []);

  // A stored token the API no longer accepts: sign out here too and ask to sign in again, instead of every action
  // failing while the page still looks signed in
  // A full navigation, so a signed-in page's own "signed out, go home" redirect can't win the race
  useEffect(() => {
    const onExpired = () => {
      if (!readKey(TOKEN_KEY)) return;
      const signIn = buildAuthHref("/login");
      logout();
      window.location.assign(signIn);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [logout]);

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
