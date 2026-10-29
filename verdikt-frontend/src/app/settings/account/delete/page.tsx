"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiErrorMessage, profileApi } from "@/lib/api";
import { INPUT, PageHeader } from "@/components/profile/settingsUi";

// Matches the deletion process described in the Privacy Policy
const CARDS = [
  {
    icon: Trash2,
    tone: "bg-red-500/15 text-red-400 border-red-500/25",
    title: "Your profile and content are erased",
    body: "Your profile, reviews, comments, likes, watch history and collections are permanently deleted.",
  },
  {
    icon: KeyRound,
    tone: "bg-purple-500/15 text-purple-300 border-purple-500/25",
    title: "Confirm with your password",
    body: "Enter your password to prove it's you. Your account is deleted right away and you're signed out.",
  },
  {
    icon: RotateCcw,
    tone: "bg-blue-500/15 text-blue-300 border-blue-500/25",
    title: "This can't be undone",
    body: "Once your account is deleted, it can't be restored. You would need to sign up again with a new account.",
  },
  {
    icon: ShieldCheck,
    tone: "bg-amber-700/20 text-amber-500 border-amber-700/30",
    title: "Your username is freed",
    body: "Your username becomes available to others. Likes and comments people left on your reviews go with them.",
  },
];

export default function DeleteAccountPage() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  if (!user) return null;

  const ready = agreed && password.length > 0 && !deleting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setDeleting(true);
    setError(null);
    try {
      await profileApi.deleteAccount(password);
      logout();
      router.replace("/");
      showToast("Your account was deleted", { detail: "Thanks for being part of Verdikt." });
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't delete your account. Please try again."));
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PageHeader title="Delete Account">
        Deleting your account is permanent. Please read what happens before you continue.
      </PageHeader>

      <ul>
        {CARDS.map(({ icon: Icon, tone, title, body }) => (
          <li
            key={title}
            className="border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-5 first:rounded-t-2xl last:rounded-b-2xl border-b-0 last:border-b flex items-start gap-4"
          >
            <span className={`w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center ${tone}`}>
              <Icon className="w-5 h-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-white font-medium">{title}</span>
              <span className="block mt-1 text-zinc-400 text-sm leading-relaxed">{body}</span>
            </span>
          </li>
        ))}
      </ul>

      <label className="mt-8 flex items-start gap-3 text-sm text-zinc-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded accent-red-500 cursor-pointer"
        />
        I understand that my account and everything in it will be permanently deleted and can&apos;t be recovered.
      </label>

      <label htmlFor="delete-password" className="mt-6 block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
        Your Password
      </label>
      <input
        id="delete-password"
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setError(null);
        }}
        autoComplete="current-password"
        aria-invalid={!!error}
        aria-describedby="delete-error"
        className={INPUT}
      />
      <p id="delete-error" className="mt-2 text-sm text-red-400 min-h-5" aria-live="polite">
        {error}
      </p>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={!ready}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-2.5 rounded-full transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:bg-white/[0.06] disabled:text-zinc-500 disabled:cursor-not-allowed"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Trash2 className="w-4 h-4" aria-hidden="true" />}
          {deleting ? "Deleting…" : "Delete My Account"}
        </button>
      </div>
    </form>
  );
}
