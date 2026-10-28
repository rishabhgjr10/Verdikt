import React from "react";

/** Shared pieces for the /settings pages. */
export const INPUT =
  "bg-[#09090b] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors w-full";

export const PRIMARY_PILL =
  "bg-white text-black font-semibold px-6 py-2.5 rounded-full hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      {children && <div className="mt-2 text-sm text-zinc-400 leading-relaxed">{children}</div>}
    </header>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">{children}</h3>;
}
