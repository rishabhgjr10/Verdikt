"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiErrorMessage, profileApi } from "@/lib/api";
import { INPUT, PageHeader, PRIMARY_PILL } from "@/components/profile/settingsUi";

const RULES = [
  "3 to 30 characters: letters, numbers, dots and underscores only.",
  "Usernames are unique, so your new one must not already be taken.",
  "Your old username becomes available to others after the change.",
  "Links to your old profile stop working.",
];

// Same rule as ProfileService.USERNAME on the backend
const USERNAME = /^[A-Za-z0-9._]{3,30}$/;

export default function ChangeUsernamePage() {
  const { user, replaceSession } = useAuth();
  const { showToast } = useToast();
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!user) return null;

  const value = next.trim().replace(/^@/, "");
  const invalid = value.length > 0 && !USERNAME.test(value);
  const unchanged = value === user.username;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || invalid || unchanged || saving) return;
    setSaving(true);
    setError(null);
    try {
      replaceSession(await profileApi.changeUsername(value));
      setNext("");
      showToast("Username changed", { detail: `You're now @${value}.` });
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't change your username. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
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

      <label htmlFor="new-username" className="mt-6 block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
        Step 2 - New Username
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" aria-hidden="true">
          @
        </span>
        <input
          id="new-username"
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setError(null);
          }}
          maxLength={31}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="new.username"
          aria-invalid={invalid || !!error}
          aria-describedby="username-hint"
          className={`${INPUT} pl-9`}
        />
      </div>
      <p id="username-hint" className={`mt-2 text-sm ${invalid || error ? "text-red-400" : "text-zinc-500"}`} aria-live="polite">
        {error ?? (invalid ? "Use 3 to 30 letters, numbers, dots or underscores." : unchanged ? "That's already your username." : " ")}
      </p>

      <div className="flex justify-end">
        <button type="submit" disabled={!value || invalid || unchanged || saving} className={`${PRIMARY_PILL} mt-4 inline-flex items-center gap-2`}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {saving ? "Changing…" : "Change Username"}
        </button>
      </div>
    </form>
  );
}
