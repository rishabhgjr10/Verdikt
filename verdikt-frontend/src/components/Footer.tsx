import React from "react";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { GitHubIcon, LinkedInIcon } from "@/components/profile/SocialIcons";

const SOCIALS = [
  { label: "Verdikt on GitHub", href: SITE.github, Icon: GitHubIcon },
  { label: "Rishabh Gurjar on LinkedIn", href: SITE.linkedin, Icon: LinkedInIcon },
];

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
        <div className="flex items-center justify-between gap-4">
          <p className="text-white font-medium text-lg flex items-center gap-2">
            Made with <span aria-label="love" role="img" className="text-rose-500">❤️</span> in India
          </p>
          <ul className="flex items-center gap-2">
            {SOCIALS.map(({ label, href, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-200 hover:text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <Icon className="w-5 h-5" />
                </a>
              </li>
            ))}
          </ul>
        </div>

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
