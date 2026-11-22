import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-300 mb-4">
        <Compass className="w-7 h-7" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold text-white tracking-tight mb-2">This page doesn&apos;t exist</h1>
      <p className="text-sm text-zinc-400 max-w-sm mb-6 leading-relaxed">The link may be old, or the title was moved.</p>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Go home
        </Link>
        <Link
          href="/search"
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-sm font-medium border border-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Search titles
        </Link>
      </div>
    </div>
  );
}
