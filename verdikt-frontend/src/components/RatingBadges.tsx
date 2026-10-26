"use client";

import React, { useEffect, useState } from "react";
import { ratingsApi } from "@/lib/api";
import { RatingSource } from "@/types/media";

/** Small brand marks; colors follow each source's own branding. */
const BRAND: Record<string, { mark: string; className: string; via?: string }> = {
  imdb: { mark: "IMDb", className: "bg-[#F5C518] text-black font-black tracking-tight px-1", via: "OMDb" },
  rottenTomatoes: { mark: "RT", className: "bg-[#FA320A] text-white font-black rounded-full w-5", via: "OMDb" },
  metascore: { mark: "M", className: "bg-[#66CC33] text-black font-black w-5", via: "OMDb" },
  anilist: { mark: "AL", className: "bg-[#02A9FF] text-white font-black w-6" },
  metacritic: { mark: "MC", className: "bg-[#FFCC34] text-black font-black w-6", via: "RAWG" },
  rawg: { mark: "RAWG", className: "bg-white text-black font-black tracking-tight px-1" },
  openLibrary: { mark: "OL", className: "bg-[#E1DCC5] text-[#5C3A1E] font-black w-6" },
  googleBooks: { mark: "G", className: "bg-[#4285F4] text-white font-black w-5" },
};

function tooltip(source: RatingSource) {
  const count = source.count ? ` · ${new Intl.NumberFormat("en").format(source.count)} ratings` : "";
  return `${source.label}: ${source.display}${count}`;
}

/**
 * External rating pills, fetched client-side after the main content. Renders a
 * skeleton while loading and nothing at all when there are no sources or the call fails.
 */
export function RatingBadges({ mediaId }: { mediaId: string }) {
  const [sources, setSources] = useState<RatingSource[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    ratingsApi
      .get(mediaId, controller.signal)
      .then((data) => setSources(data.filter((s) => s && s.display && BRAND[s.key])))
      .catch(() => {
        if (!controller.signal.aborted) setSources([]);
      });
    return () => controller.abort();
  }, [mediaId]);

  if (sources === null) {
    return (
      <div className="flex flex-wrap gap-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-[88px] rounded-full bg-white/[0.07] border border-white/10 animate-pulse" />
        ))}
      </div>
    );
  }

  if (sources.length === 0) return null;

  // "IMDb, Rotten Tomatoes via OMDb · AniList" — only sources actually shown, grouped by intermediary
  const groups = new Map<string, string[]>();
  for (const s of sources) {
    const via = BRAND[s.key]?.via ?? "";
    groups.set(via, [...(groups.get(via) ?? []), s.label]);
  }
  const attribution = Array.from(groups, ([via, labels]) => (via ? `${labels.join(", ")} via ${via}` : labels.join(", "))).join(" · ");

  return (
    // Badges and caption share one row; the caption wraps under the badges on phones
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <ul className="flex flex-wrap gap-2" aria-label="External ratings">
        {sources.map((source) => {
          const brand = BRAND[source.key];
          const content = (
            <>
              <span
                className={`h-5 min-w-5 rounded-[5px] flex items-center justify-center text-[9px] leading-none ${brand.className}`}
                aria-hidden="true"
              >
                {brand.mark}
              </span>
              <span className="text-[13px] font-bold text-white tabular-nums">{source.display}</span>
              <span className="sr-only">{source.label}</span>
            </>
          );
          const classes =
            "glass-btn relative inline-flex items-center gap-2 h-8 pl-1.5 pr-3 rounded-full bg-white/10 border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-1px_1px_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35)] transition-all duration-200";
          return (
            <li key={source.key}>
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={tooltip(source)}
                  className={`${classes} hover:bg-white/15 outline-none focus-visible:ring-2 focus-visible:ring-white/40`}
                >
                  {content}
                </a>
              ) : (
                <span title={tooltip(source)} className={classes}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="basis-full sm:basis-auto text-xs text-zinc-400">Ratings: {attribution}</p>
    </div>
  );
}

export default RatingBadges;
