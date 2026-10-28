"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtSign, FileText, HeartPulse, PenLine, Shield, Sparkles, Trash2 } from "lucide-react";
import { useSignedInUser } from "@/components/profile/profileData";

const GROUPS = [
  {
    label: "Main",
    items: [
      { label: "Edit profile", href: "/settings/profile", icon: PenLine },
      { label: "Profile Health", href: "/settings/health", icon: HeartPulse },
      { label: "My Contributions", href: "/settings/contributions", icon: Sparkles },
      { label: "Change Username", href: "/settings/account/username", icon: AtSign },
      { label: "Delete Account", href: "/settings/account/delete", icon: Trash2 },
    ],
  },
  {
    label: "More",
    items: [
      { label: "Privacy Policy", href: "/privacy", icon: Shield },
      { label: "Terms of Service", href: "/terms", icon: FileText },
    ],
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useSignedInUser();

  return (
    <div className="max-w-6xl w-full mx-auto px-6 py-12 flex flex-col md:flex-row gap-8 md:gap-12">
      <aside className="md:w-64 md:flex-shrink-0">
        <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>
        <nav aria-label="Settings" className="space-y-6">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{g.label}</p>
              <ul className="space-y-1">
                {g.items.map(({ label, href, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={`p-3 rounded-lg flex items-center gap-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                          active
                            ? "bg-white/[0.08] text-white font-medium"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Pages render only for signed-in users; logged-out visitors are redirected to /login */}
      <section className="flex-1 min-w-0">{user ? children : null}</section>
    </div>
  );
}
