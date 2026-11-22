"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";

/** Any page that throws while rendering lands here instead of a blank screen; the navbar and footer stay. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Page crashed", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
        <AlertCircle className="w-7 h-7" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold text-white tracking-tight mb-2">Something went wrong on this page</h1>
      <p className="text-sm text-zinc-400 max-w-sm mb-6 leading-relaxed">Try again. If it keeps happening, head back home.</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-sm font-medium border border-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
