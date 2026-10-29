"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { buildAuthHref } from "@/lib/auth-redirect";
import { User } from "@/types/media";

/** Must match Avatars.STYLES on the backend, which builds and validates the stored URL */
export const AVATAR_STYLES = [
  { id: "initials", label: "Initials" },
  { id: "thumbs", label: "Thumbs" },
  { id: "shapes", label: "Shapes" },
  { id: "glass", label: "Glass" },
  { id: "notionists-neutral", label: "Sketch" },
  { id: "lorelei-neutral", label: "Line" },
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number]["id"];

export const avatarUrl = (style: string, seed: string) =>
  `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;

/** Style and seed of a stored DiceBear URL, so the picker can show the current choice */
export function parseAvatar(url: string | null | undefined): { style: string; seed: string } | null {
  const m = url?.match(/api\.dicebear\.com\/[^/]+\/([a-z-]+)\/svg\?seed=([^&]+)/);
  return m ? { style: m[1], seed: decodeURIComponent(m[2]) } : null;
}

/** An uploaded photo, served through the /avatars rewrite (generated avatars are DiceBear URLs) */
export const isUploadedAvatar = (url: string | null | undefined) => !!url?.startsWith("/avatars/");

/** A valid avatar seed from a username (same rule as the backend) */
export const seedFrom = (username: string) => username.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64) || "verdikt";

export const displayName = (user: Pick<User, "firstName" | "lastName" | "username">) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username;

/** "Joined 3 months ago" from the account's creation time */
export function joinedLabel(createdAt: string | undefined, now = Date.now()): string | null {
  if (!createdAt) return null;
  const then = new Date(createdAt).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.max(0, Math.floor((now - then) / 86_400_000));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (days < 1) return "Joined today";
  if (days < 30) return `Joined ${rtf.format(-days, "day")}`;
  if (days < 365) return `Joined ${rtf.format(-Math.floor(days / 30), "month")}`;
  return `Joined ${rtf.format(-Math.floor(days / 365), "year")}`;
}

/**
 * Signed-in user for /profile and /settings; logged-out visitors are sent to /login?next=<this page>, while someone
 * who signs out (or deletes their account) here goes home instead of being asked to sign back in.
 */
export function useSignedInUser() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const hadUser = useRef(false);
  useEffect(() => {
    if (user) hadUser.current = true;
    else if (!isLoading) router.replace(hadUser.current ? "/" : buildAuthHref("/login"));
  }, [isLoading, user, router]);
  return { user, isLoading };
}
