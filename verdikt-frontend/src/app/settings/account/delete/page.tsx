"use client";

import React, { useState } from "react";
import { Mail, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SITE } from "@/lib/site";
import { PageHeader } from "@/components/profile/settingsUi";

// Matches the deletion process described in the Privacy Policy (an emailed request handled by us)
const CARDS = [
  {
    icon: Trash2,
    tone: "bg-red-500/15 text-red-400 border-red-500/25",
    title: "Your profile and content are erased",
    body: "Your profile, reviews, comments, likes, watch history and collections are permanently deleted.",
  },
  {
    icon: Mail,
    tone: "bg-purple-500/15 text-purple-300 border-purple-500/25",
    title: "We confirm by email first",
    body: "Your request goes to our team from your email app. We reply to the address on your account before anything is deleted.",
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
    title: "Some records may be kept",
    body: "Where the law requires it, we keep limited records, such as moderation history, for as long as needed.",
  },
];

export default function DeleteAccountPage() {
  const { user } = useAuth();
  const [agreed, setAgreed] = useState(false);
  if (!user) return null;

  // shortcut: there is no delete-account endpoint yet, so this opens a pre-filled email request instead
  const mailto = `mailto:${SITE.supportEmail}?subject=${encodeURIComponent("Account deletion request")}&body=${encodeURIComponent(
    `Please delete my Verdikt account.\n\nUsername: @${user.username}\nEmail: ${user.email}\n`
  )}`;

  return (
    <div>
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

      <div className="mt-6 flex justify-end">
        {agreed ? (
          <a
            href={mailto}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-2.5 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Proceed to Delete
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 bg-white/[0.06] text-zinc-500 font-semibold px-6 py-2.5 rounded-full cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Proceed to Delete
          </button>
        )}
      </div>
    </div>
  );
}
