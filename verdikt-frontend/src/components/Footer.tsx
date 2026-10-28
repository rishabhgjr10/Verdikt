import React from "react";
import Link from "next/link";
import { SITE } from "@/lib/site";

const LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Contact Us", href: "/contact" },
];

export function Footer() {
  return (
    <footer className="relative z-10 w-full bg-[#09090b]/90 backdrop-blur-xl border-t border-white/[0.08]">
      <div className="max-w-[1400px] w-[calc(100%-48px)] mx-auto px-6 py-8">
        <p className="text-white font-medium text-lg flex items-center gap-2">
          Made with <span aria-label="love" role="img" className="text-rose-500">❤️</span> in India
        </p>

        <hr className="border-white/[0.08] my-6" />

        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-zinc-500 text-sm">
            © {new Date().getFullYear()} {SITE.legalName}
          </p>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400">
              {LINKS.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="hover:text-white transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
