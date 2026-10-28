"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Flame, RotateCw } from "lucide-react";
import { mostInterestedApi } from "@/lib/api";
import { InterestPeriod, MostInterestedItem } from "@/types/media";
import { PosterImage } from "@/components/PosterImage";
import { PeriodDropdown } from "@/components/PeriodDropdown";
import { GlassButton } from "@/components/GlassButton";
import { formatCount, formatReleaseDate, mostInterestedHref } from "@/lib/most-interested";

// ── Row ────────────────────────────────────────────────────────────────────

export function MostInterestedRow({ item, rank }: { item: MostInterestedItem; rank: number }) {
  const date = formatReleaseDate(item.releaseDate, item.releaseYear);

  // Dynamic rank typography: scale 10+ down to 3.25rem with tighter letter-spacing & tabular-nums
  // Triple-digit numbers (100+) scale to 2.25rem to stay within the exact same footprint
  const rankTypographyClass =
    rank >= 100
      ? "text-[2.25rem] tracking-[-0.07em]"
      : rank >= 10
        ? "text-[3.25rem] tracking-[-0.06em]"
        : "text-[4.5rem] tracking-tighter";

  return (
    <Link
      href={mostInterestedHref(item)}
      className="group relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] pl-1 pr-3 py-2.5 overflow-hidden transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      {/* Huge silver rank numeral: dedicated min-width, right-aligned, visible overflow */}
      <span
        aria-hidden="true"
        className={`relative z-10 w-16 min-w-16 shrink-0 text-right leading-[0.85] font-black tabular-nums bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-600 bg-clip-text text-transparent select-none [filter:drop-shadow(0_2px_6px_rgba(0,0,0,0.6))] overflow-visible ${rankTypographyClass}`}
      >
        {rank}
      </span>
      <div className="relative z-0 -ml-2 w-16 h-[92px] shrink-0 rounded-xl overflow-hidden border border-white/10 shadow-lg">
        <PosterImage
          url={item.posterUrl}
          title={item.title}
          mediaType={item.mediaType}
          releaseYear={item.releaseYear}
          className="w-full h-full text-[8px] transition-transform duration-300 group-hover:scale-[1.06]"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-bold text-white truncate">
          <span className="sr-only">#{rank} </span>
          {item.title}
        </p>
        {(date || item.statusLabel) && (
          <p className="text-xs text-zinc-400 leading-snug">
            {date}
            {date && item.statusLabel && <span aria-hidden="true"> • </span>}
            {item.statusLabel}
          </p>
        )}
        {item.interestedCount !== null && item.interestedCount > 0 && (
          <p className="flex items-center gap-1 text-xs font-semibold text-orange-400">
            <Flame className="w-3.5 h-3.5 fill-orange-500/40" aria-hidden="true" />
            {formatCount(item.interestedCount)} Interested
          </p>
        )}
      </div>
    </Link>
  );
}

// ── Data hook ──────────────────────────────────────────────────────────────

/** Fetches a period without page reloads; keeps the previous list (dimmed) while loading. */
export function useMostInterested(period: InterestPeriod, limit: number) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${period}:${limit}:${attempt}`;
  // Loading is derived: the last settled request differs from the current one
  const [settled, setSettled] = useState<{ key: string; items: MostInterestedItem[] | null; error: boolean }>({
    key: "",
    items: null,
    error: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    mostInterestedApi
      .get(period, limit, controller.signal)
      .then((data) => setSettled({ key: requestKey, items: data, error: false }))
      .catch((err) => {
        if (controller.signal.aborted || err?.name === "CanceledError") {
          setSettled((prev) => ({ key: requestKey, items: prev.items, error: true }));
          return;
        }
        setSettled((prev) => ({ key: requestKey, items: prev.items, error: true }));
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [period, limit, requestKey]);

  const loading = settled.key !== requestKey;
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { items: settled.items, loading, error: !loading && settled.error, retry };
}

// ── List with states ───────────────────────────────────────────────────────

export function MostInterestedList({
  period,
  limit,
}: {
  period: InterestPeriod;
  limit: number;
}) {
  const { items, loading, error, retry } = useMostInterested(period, limit);

  if (error && !loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center" role="alert">
        <p className="text-sm text-zinc-300 font-medium">Couldn&apos;t load this list.</p>
        <GlassButton variant="neutral" className="mt-4 h-9 px-4 text-xs" icon={<RotateCw className="w-3.5 h-3.5" />} onClick={retry}>
          Retry
        </GlassButton>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="space-y-2.5" aria-hidden="true">
        {Array.from({ length: Math.min(limit, 5) }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] pl-1 pr-3 py-2.5">
            <div className="w-16 min-w-16 h-16 shrink-0 rounded-lg bg-zinc-800/50 animate-pulse" />
            <div className="-ml-2 w-16 h-[92px] shrink-0 rounded-xl bg-zinc-800 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 rounded bg-zinc-800 animate-pulse" />
              <div className="h-2.5 w-1/2 rounded bg-zinc-800/60 animate-pulse" />
              <div className="h-2.5 w-1/3 rounded bg-zinc-800/40 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center">
        <Flame className="w-6 h-6 text-zinc-600 mx-auto mb-2" aria-hidden="true" />
        <p className="text-sm text-zinc-300 font-medium">Nothing here yet</p>
        <p className="text-xs text-zinc-500 mt-1">Add titles to Watch Later to see what&apos;s trending.</p>
      </div>
    );
  }

  return (
    <ol
      className={`space-y-2.5 transition-opacity duration-200 ${loading ? "opacity-50 pointer-events-none" : "opacity-100"}`}
      aria-busy={loading || undefined}
    >
      {items.map((item, idx) => (
        <li key={item.id ?? `${item.mediaType}-${item.externalId}`}>
          <MostInterestedRow item={item} rank={idx + 1} />
        </li>
      ))}
    </ol>
  );
}

// ── Home sidebar card ──────────────────────────────────────────────────────

export function MostInterestedCard() {
  const [period, setPeriod] = useState<InterestPeriod>("WEEK");

  return (
    <section className="catalog-widget catalog-interested flex flex-col gap-4" aria-labelledby="most-interested-heading">
      {/* On narrow cards the period picker drops to its own line instead of squeezing the title */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-[10px] bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Flame className="w-4 h-4 text-orange-400" aria-hidden="true" />
          </div>
          <h3 id="most-interested-heading" className="whitespace-nowrap text-sm font-semibold text-white tracking-tight">
            Most Interested
          </h3>
        </div>
        <div className="ml-auto">
          <PeriodDropdown value={period} onChange={setPeriod} />
        </div>
      </div>

      <MostInterestedList period={period} limit={5} />

      <GlassButton
        href={`/most-interested?period=${period}`}
        variant="neutral"
        block
        icon={<ArrowUpRight className="w-4 h-4" />}
        className="flex-row-reverse"
      >
        See All
      </GlassButton>
    </section>
  );
}
