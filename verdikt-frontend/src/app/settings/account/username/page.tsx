"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { INPUT, PageHeader, PRIMARY_PILL } from "@/components/profile/settingsUi";

const RULES = [
  "3 to 30 characters: letters, numbers, dots and underscores only.",
  "Usernames are unique, so your new one must not already be taken.",
  "Your old username becomes available to others after the change.",
  "Links to your old profile stop working.",
];

export default function ChangeUsernamePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  if (!user) return null;

  return (
    <div>
      <PageHeader title="Change Username">
        <ul className="mt-3 space-y-1.5 pl-5 list-disc marker:text-purple-400">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </PageHeader>

      <label htmlFor="current-username" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
        Step 1 - Current Username
      </label>
      <input
        id="current-username"
        value={`@${user.username}`}
        readOnly
        aria-readonly="true"
        className={`${INPUT} text-zinc-400 cursor-not-allowed focus:border-white/[0.1]`}
      />

      {/* shortcut: there is no change-username endpoint yet; Step 2 (new username) goes here once it exists */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            showToast("Username changes aren't available yet", { tone: "error", detail: "We'll let you know when you can pick a new one." })
          }
          className={`${PRIMARY_PILL} mt-6`}
        >
          Proceed
        </button>
      </div>
    </div>
  );
}
