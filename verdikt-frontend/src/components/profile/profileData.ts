"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { buildAuthHref } from "@/lib/auth-redirect";

/**
 * shortcut: the backend has no profile fields yet (display name, bio, follows, socials, join date), so these
 * fill the layout for every signed-in user; replace with API data once a profile endpoint exists.
 */
export const PROFILE_PLACEHOLDER = {
  firstName: "Rishabh",
  lastName: "Gurjar",
  bio: "Mauj Masti till eternity",
  followers: 0,
  following: 0,
  joined: "Joined 3 months ago",
  instagram: "",
  x: "",
  youtube: "",
};

/** Signed-in user for /profile and /settings; logged-out visitors are sent to /login?next=<this page>. */
export function useSignedInUser() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && !user) router.replace(buildAuthHref("/login"));
  }, [isLoading, user, router]);
  return { user, isLoading };
}
