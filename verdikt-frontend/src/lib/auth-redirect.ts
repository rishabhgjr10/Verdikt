"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * Returns `raw` only if it is a safe internal path: starts with a single "/",
 * not "//" or "/\", and contains no scheme or control characters. Otherwise null.
 */
export function getSafeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    // Resolving against a dummy origin must stay on that origin.
    const resolved = new URL(value, "http://verdikt.internal");
    if (resolved.origin !== "http://verdikt.internal") return null;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return null;
  }
}

/** Reads the validated `next` param from the current URL (client only). */
export function readNextParam(): string | null {
  if (typeof window === "undefined") return null;
  return getSafeNext(new URLSearchParams(window.location.search).get("next"));
}

const noopSubscribe = () => () => {};

/**
 * Validated `next` param. Null on the server and during hydration, so the
 * first client render matches the server; the real value follows right after.
 */
export function useNextParam(): string | null {
  return useSyncExternalStore(noopSubscribe, readNextParam, () => null);
}

/** Builds /login (or /register) with the current path + query as `next`. */
export function buildAuthHref(base: "/login" | "/register" = "/login", next?: string | null): string {
  const target =
    next ??
    (typeof window !== "undefined" ? window.location.pathname + window.location.search : null);
  const safe = getSafeNext(target);
  return safe && safe !== "/" ? `${base}?next=${encodeURIComponent(safe)}` : base;
}

/**
 * Wraps a user-only action: when logged out, sends the user to
 * /login?next=<current page> instead of running it. Clicks during the
 * initial auth check are ignored.
 */
export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  return useCallback(
    (action: () => void) => {
      if (isLoading) return;
      if (!user) {
        router.push(buildAuthHref("/login"));
        return;
      }
      action();
    },
    [user, isLoading, router]
  );
}
