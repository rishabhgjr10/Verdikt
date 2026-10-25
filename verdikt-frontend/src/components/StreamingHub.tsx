"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Radio } from "lucide-react";

interface StreamingPick {
  platform: string;
  badgeStyle: string;
  title: string;
  score: string;
  href: string;
}

const STREAMING_PICKS: StreamingPick[] = [
  {
    platform: "NETFLIX",
    badgeStyle: "bg-red-500/10 text-red-400 border-red-500/25",
    title: "Cyberpunk: Edgerunners",
    score: "8.5",
    href: "/search?q=Cyberpunk+Edgerunners",
  },
  {
    platform: "PRIME",
    badgeStyle: "bg-sky-500/10 text-sky-400 border-sky-500/25",
    title: "The Terminal List",
    score: "8.0",
    href: "/search?q=The+Terminal+List",
  },
  {
    platform: "CRUNCHYROLL",
    badgeStyle: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    title: "The Apothecary Diaries",
    score: "8.7",
    href: "/search?q=The+Apothecary+Diaries",
  },
  {
    platform: "MAX",
    badgeStyle: "bg-purple-500/10 text-purple-300 border-purple-500/25",
    title: "Slow Horses",
    score: "8.1",
    href: "/search?q=Slow+Horses",
  },
];

export function StreamingHub() {
  return (
    <div className="catalog-widget catalog-radar bg-[#09090B]/90 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 backdrop-blur-xl shadow-xl">
      {/* Widget Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Radio className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <h3 className="text-sm font-semibold text-white tracking-tight">
            Streaming Radar
          </h3>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Trending
        </span>
      </div>

      {/* Streaming List Items */}
      <div className="flex flex-col gap-2 pt-1">
        {STREAMING_PICKS.map((pick) => (
          <Link
            key={pick.title}
            href={pick.href}
            className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.08] transition-all group"
          >
            {/* Platform Badge & Title */}
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

            {/* Score + Purple Dot */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-semibold text-purple-400">
                {pick.score}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            </div>
          </Link>
        ))}
      </div>

      {/* CTA Button: Quick Verdikt */}
      <Link
        href="/search"
        className="w-full bg-[#8B5CF6] hover:bg-[#A78BFA] text-white rounded-full py-2.5 font-semibold text-xs flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all cursor-pointer mt-1"
      >
        <Sparkles className="w-3.5 h-3.5 text-violet-200" />
        <span>Log Quick Verdikt</span>
      </Link>
    </div>
  );
}
