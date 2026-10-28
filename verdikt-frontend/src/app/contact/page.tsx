import type { Metadata } from "next";
import { Briefcase, LifeBuoy, Mail } from "lucide-react";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact Us · ${SITE.name}`,
  description: `Get help with your ${SITE.name} account, or reach us about partnerships and press.`,
};

const CARDS = [
  {
    id: "support",
    title: "Support",
    icon: LifeBuoy,
    description: "Need help with your account or have questions?",
    note: "Please include your username and a short description of the issue.",
    email: SITE.supportEmail,
  },
  {
    id: "business",
    title: "Business",
    icon: Briefcase,
    description: "For partnerships, press and business enquiries.",
    note: "Writing from your company address helps us reply faster.",
    email: SITE.businessEmail,
  },
];

export default function ContactPage() {
  return (
    <main className="max-w-4xl w-full mx-auto px-6 pt-16 pb-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Contact Us</h1>
        <p className="text-zinc-400">We&apos;re here to help. Reach out to us via email.</p>
      </header>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {CARDS.map(({ id, title, icon: Icon, description, note, email }) => (
          <section
            key={id}
            id={id}
            aria-labelledby={`${id}-title`}
            className="scroll-mt-32 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl rounded-2xl p-8 flex flex-col items-center text-center transition-all"
          >
            <span className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/[0.1] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] flex items-center justify-center text-zinc-100">
              <Icon className="w-5 h-5" aria-hidden="true" />
            </span>
            <h2 id={`${id}-title`} className="mt-5 text-lg font-semibold text-white">
              {title}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">{description}</p>
            <p className="mt-3 text-xs text-zinc-500 max-w-[30ch]">{note}</p>
            <a
              href={`mailto:${email}`}
              className="mt-6 inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 [text-shadow:0_0_14px_rgba(96,165,250,0.45)] font-medium transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              {email}
            </a>
          </section>
        ))}
      </div>
    </main>
  );
}
