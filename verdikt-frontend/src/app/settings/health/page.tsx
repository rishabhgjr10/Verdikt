"use client";

import React from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/profile/settingsUi";
import { SITE } from "@/lib/site";

// Describes moderation as it works today: no strikes or automatic limits exist, so the page promises none
const FAQ = [
  {
    q: "What is Profile Health?",
    a: "Where your account's standing with the Verdikt. community rules will show. There is no strike system yet, so every account in good standing can post reviews, comments and likes freely.",
  },
  {
    q: "What happens if something I post breaks the rules?",
    a: "People can report a review or comment, and reports reach our team by email. We may remove content that breaks the Terms of Service, and serious or repeated abuse can lead to the account being removed.",
  },
  {
    q: "Can I remove comments on my own reviews?",
    a: "Yes. Open the comments on your review and choose Remove on any comment. You can always remove your own comments too.",
  },
  {
    q: "I think something was removed by mistake. What can I do?",
    a: `Email ${SITE.supportEmail} from the address on your account with a link to the content and why you think it was a mistake.`,
  },
];

export default function ProfileHealthPage() {
  return (
    <div>
      <PageHeader title="Profile Health">
        Your account&apos;s standing with the Verdikt. community rules.
      </PageHeader>

      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-4 font-medium flex items-center gap-3 mb-8">
        <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
        Your account is in good standing. Keep sharing honest verdicts!
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
