"use client";

import React from "react";
import { ChevronDown, ShieldCheck, ShieldOff } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/profile/settingsUi";

const FAQ = [
  {
    q: "What is Profile Health?",
    a: "Profile Health shows whether your account follows the Verdikt. community rules. Accounts in good standing can post reviews, comments and likes without limits.",
  },
  {
    q: "How does the strike system work?",
    a: "If a review or comment breaks the Terms of Service, a moderator may remove it and add a strike to your account. Each strike explains which rule was broken and when it expires.",
  },
  {
    q: "What happens if I get strikes?",
    a: "A single strike is a warning. Repeated strikes can lead to temporary limits on posting, and serious or repeated violations can lead to account suspension.",
  },
  {
    q: "Do strikes expire?",
    a: "Yes. Strikes expire after a set period as long as no new violations happen, and your Profile Health returns to good standing.",
  },
  {
    q: "I think a strike was a mistake. What can I do?",
    a: "Email us from the address on your account with a link to the content and why you think it was a mistake. We review every appeal.",
  },
];

export default function ProfileHealthPage() {
  return (
    <div>
      <PageHeader title="Profile Health">
        A quick look at your account&apos;s standing with the Verdikt. community rules.
      </PageHeader>

      {/* shortcut: there is no moderation/strike data in the backend yet, so every account shows good standing */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-4 font-medium flex items-center gap-3 mb-8">
        <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
        Your account is in good standing. Keep sharing honest verdicts!
      </div>

      <SectionTitle>Active Strikes</SectionTitle>
      <div className="bg-black/40 border border-white/[0.06] rounded-2xl p-8 text-center mb-10">
        <ShieldOff className="w-7 h-7 text-zinc-600 mx-auto" aria-hidden="true" />
        <p className="mt-2 text-sm text-zinc-400">You have no active strikes.</p>
      </div>

      <SectionTitle>Frequently Asked Questions</SectionTitle>
      <div className="border-b border-white/[0.08]">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="group border-t border-white/[0.08] py-4">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-white font-medium rounded outline-none focus-visible:ring-2 focus-visible:ring-white/40">
              {q}
              <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
