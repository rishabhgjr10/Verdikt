"use client";

import React from "react";
import Link from "next/link";
import { Tv, Sparkles, ExternalLink, Radio } from "lucide-react";

interface StreamingPick {
  platform: string;
  badgeStyle: string;
  title: string;
  verdict: string;
  verdictColor: string;
  score: string;
  href: string;
}

const STREAMING_PICKS: StreamingPick[] = [
  {
    platform: "NETFLIX",
    badgeStyle: "bg-red-500/10 text-red-400 border-red-500/25",
    title: "Cyberpunk: Edgerunners",
    verdict: "Perfection",
    verdictColor: "#a855f7",
    score: "8.5",
    href: "/search?q=Cyberpunk+Edgerunners",
  },
  {
    platform: "PRIME",
    badgeStyle: "bg-sky-500/10 text-sky-400 border-sky-500/25",
    title: "The Terminal List",
    verdict: "Go For It",
    verdictColor: "#10b981",
    score: "8.0",
    href: "/search?q=The+Terminal+List",
  },
  {
    platform: "CRUNCHYROLL",
    badgeStyle: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    title: "The Apothecary Diaries",
    verdict: "Perfection",
    verdictColor: "#a855f7",
    score: "8.7",
    href: "/search?q=The+Apothecary+Diaries",
  },
  {
    platform: "MAX",
    badgeStyle: "bg-purple-500/10 text-purple-300 border-purple-500/25",
    title: "Slow Horses",
    verdict: "Go For It",
    verdictColor: "#10b981",
    score: "8.1",
    href: "/search?q=Slow+Horses",
  },
];

export function StreamingHub() {
  return (
    <div className="rounded-2xl bg-zinc-900/40 border border-white/[0.08] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Radio className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Streaming Radar</h3>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Trending
        </span>
      </div>

      {/* Featured Streaming Drops */}
      <div className="space-y-2.5 pt-1">
        {STREAMING_PICKS.map((pick) => (
          <Link
            key={pick.title}
            href={pick.href}
            className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.08] transition-all group"
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <span
                className={`text-[9px] font-extrabold tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${pick.badgeStyle}`}
              >
                {pick.platform}
              </span>
              <span className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
                {pick.title}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="text-[10px] font-semibold"
                style={{ color: pick.verdictColor }}
              >
                {pick.score}
              </span>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: pick.verdictColor }}
              />
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Verdict Logging Prompt */}
      <div className="pt-2 border-t border-white/[0.06] space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 text-[11px]">Seen something recently?</span>
          <span className="text-[10px] text-zinc-500">4-Tier Scale</span>
        </div>

        <Link
          href="/search"
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-semibold py-2.5 rounded-xl border border-violet-400/20 transition-all shadow-md shadow-violet-950/50 group"
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-200 group-hover:rotate-12 transition-transform" />
          <span>Log Quick Verdict</span>
        </Link>
      </div>
    </div>
  );
}
