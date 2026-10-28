import React from "react";

/** Long-form reading layout shared by /terms and /privacy. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="max-w-4xl w-full mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{title}</h1>
      <p className="text-sm text-zinc-500 mb-8">Last updated: {updated}</p>
      <div className="text-zinc-300 leading-relaxed space-y-4 [&_a]:text-violet-300 [&_a:hover]:text-violet-200 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-white [&_strong]:font-semibold">
        {children}
      </div>
    </main>
  );
}

export function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-semibold text-white mt-8 mb-4 scroll-mt-32">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold text-white mt-6 mb-3">{children}</h3>;
}

export function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="space-y-2 pl-5 list-disc marker:text-purple-400">{children}</ul>
  );
}

/** Highlighted glass box for notes readers must not miss. */
export function Callout({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <aside className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 my-6 border-l-4 border-l-purple-500 backdrop-blur-xl space-y-3">
      {title && <p className="font-semibold text-white">{title}</p>}
      {children}
    </aside>
  );
}
