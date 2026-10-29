"use client";

import { useSyncExternalStore } from "react";

/**
 * The navbar's Alerts list: the member's recent activity (watched, saved, verdict posted) plus the most hyped
 * upcoming releases. Read activity clears itself after a day and the list never holds more than a handful, so it
 * doesn't pile up.
 * shortcut: kept in localStorage on this device only; move to an API when alerts need to follow the account.
 */
export interface AppAlert {
  id: number;
  kind: "activity" | "release";
  /** Releases are keyed by title so the same one is never added twice */
  key?: string;
  message: string;
  detail?: string;
  href?: string;
  image?: string | null;
  at: number;
  read: boolean;
  readAt?: number;
}

const KEY = "verdikt_alerts_v1";
const MAX_ACTIVITY = 10;
const READ_TTL_MS = 24 * 60 * 60 * 1000;
const EMPTY: AppAlert[] = [];
const listeners = new Set<() => void>();
let cache: AppAlert[] | null = null;

/** Drops read activity older than a day and keeps only the newest activity entries. */
function prune(alerts: AppAlert[], now = Date.now()): AppAlert[] {
  const activity = alerts
    .filter((a) => a.kind !== "release" && !(a.read && a.readAt && now - a.readAt > READ_TTL_MS))
    .slice(0, MAX_ACTIVITY);
  return [...alerts.filter((a) => a.kind === "release"), ...activity];
}

function read(): AppAlert[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    // Entries saved before `kind` existed were all activity
    cache = prune(Array.isArray(raw) ? raw.map((a) => ({ kind: "activity", ...a })) : []);
  } catch {
    cache = [];
  }
  return cache;
}

function write(alerts: AppAlert[]) {
  cache = prune(alerts);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage blocked: alerts still show for this visit
  }
  listeners.forEach((l) => l());
}

export function pushAlert(alert: { message: string; detail?: string; href?: string }) {
  const at = Date.now();
  write([{ ...alert, kind: "activity", id: at, at, read: false }, ...read()]);
}

/** Called when the Alerts panel closes: everything shown has now been seen. */
export function markAlertsRead() {
  const alerts = read();
  const at = Date.now();
  if (alerts.some((a) => !a.read)) write(alerts.map((a) => (a.read ? a : { ...a, read: true, readAt: at })));
}

/** Clears the member's activity; upcoming releases stay until they drop out of the top list. */
export function clearActivityAlerts() {
  write(read().filter((a) => a.kind === "release"));
}

/**
 * Makes the release alerts match `releases` (the current most hyped upcoming titles): new ones arrive unread, ones
 * that dropped out or came out are removed, and ones already there keep their read state.
 */
export function syncReleaseAlerts(
  releases: { key: string; message: string; detail: string; href: string; image: string | null }[]
) {
  const alerts = read();
  const existing = new Map(alerts.filter((a) => a.kind === "release").map((a) => [a.key, a]));
  const at = Date.now();
  const next = releases.map((r, i) => {
    const old = existing.get(r.key);
    // Details (days left) refresh every sync; read state carries over
    return old ? { ...old, ...r } : { ...r, kind: "release" as const, id: at + i, at, read: false };
  });
  const unchanged =
    next.length === existing.size && next.every((a) => JSON.stringify(a) === JSON.stringify(existing.get(a.key)));
  if (!unchanged) write([...next, ...alerts.filter((a) => a.kind !== "release")]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab added or read alerts
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAlerts(): AppAlert[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
