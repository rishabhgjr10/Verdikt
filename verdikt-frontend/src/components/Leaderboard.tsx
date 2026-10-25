"use client";

import React from "react";
import Link from "next/link";
import { Flame, TrendingUp } from "lucide-react";
import { MediaItem } from "@/types/media";
import { PosterImage } from "@/components/PosterImage";

interface LeaderboardProps {
  items: (MediaItem & { voteAverage?: number })[];
}

export function Leaderboard({ items }: LeaderboardProps) {
  if (!items.length) return null;

  return (
    <div className="catalog-widget catalog-interested bg-[#09090B]/90 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 backdrop-blur-xl shadow-xl">
      {/* Widget Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <h3 className="text-sm font-semibold text-white tracking-tight">
            Most Interested
          </h3>
        </div>
        <span className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2.5 py-1 rounded-full border border-white/[0.06]">
          This Week
        </span>
      </div>

      {/* List Items */}
      <div className="space-y-4">
        {items.slice(0, 5).map((item, idx) => {
          const href =
            item.id && !item.id.startsWith("tmdb-")
              ? `/media/${item.id}`
              : `/media/external/${item.mediaType}/${encodeURIComponent(
                  item.externalId || item.id
                )}`;

          const typeLabel =
            item.mediaType === "MOVIE"
              ? "Movie"
              : item.mediaType === "SERIES"
                ? "Series"
                : item.mediaType;

          return (
            <Link
              key={item.id || item.externalId || idx}
              href={href}
              className="flex items-center gap-3.5 group p-1 -mx-1 rounded-xl hover:bg-white/[0.02] transition-colors"
            >
              {/* Rank Number: Large tabular bold number */}
              <span className="text-xl md:text-2xl font-bold text-zinc-500 group-hover:text-violet-400 transition-colors w-6 text-center shrink-0 leading-none tabular-nums">
                {idx + 1}
              </span>

              {/* Thumbnail: 40x56px (aspect-[2/3] w-10), rounded-md */}
              <div className="w-10 shrink-0">
                <PosterImage
                  url={item.coverImage}
                  title={item.title}
                  mediaType={item.mediaType}
                  releaseYear={item.releaseYear}
                  className="rounded-md border-white/10"
                />
              </div>

              {/* Content: Title (14px, White), Subtext (12px, Year • Type), Rating */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-snug group-hover:text-violet-400 transition-colors">
                  {item.title}
                </p>
                <p className="text-xs text-zinc-400 leading-snug mt-0.5">
                  {item.releaseYear || "TBA"} &bull; {typeLabel}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <TrendingUp className="w-3 h-3 text-orange-400 shrink-0" />
                  <span className="text-xs text-zinc-400 font-medium">
                    {item.voteAverage ? item.voteAverage.toFixed(1) : "Hot"} Rating
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
