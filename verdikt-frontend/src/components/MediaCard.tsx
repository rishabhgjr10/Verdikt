"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MediaItem, Verdict } from "@/types/media";
import { voteToVerdict } from "@/lib/tmdb";
import { Film, Tv, Sparkles, Gamepad2, BookOpen } from "lucide-react";

interface MediaCardProps {
  item: MediaItem & { voteAverage?: number };
}

/** Converts http:// → https:// (Google Books / insecure CDN URLs) */
function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://")) return url.replace("http://", "https://");
  if (url.startsWith("/")) return `https://image.tmdb.org/t/p/w500${url}`;
  return url;
}

const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; color: string; textClass: string; score: number }
> = {
  PERFECTION: {
    label: "Perfection",
    color: "#a855f7",
    textClass: "text-[#a855f7]",
    score: 4,
  },
  GO_FOR_IT: {
    label: "Go For It",
    color: "#10b981",
    textClass: "text-[#10b981]",
    score: 3,
  },
  TIMEPASS: {
    label: "Timepass",
    color: "#f59e0b",
    textClass: "text-[#f59e0b]",
    score: 2,
  },
  SKIP_IT: {
    label: "Skip",
    color: "#ef4444",
    textClass: "text-[#ef4444]",
    score: 1,
  },
};

const TYPE_ICON: Record<string, React.ElementType> = {
  MOVIE: Film,
  SERIES: Tv,
  ANIME: Sparkles,
  GAME: Gamepad2,
  BOOK: BookOpen,
};

function titleToVerdict(title: string): Verdict {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  const tier = Math.abs(hash) % 4;
  return (["SKIP_IT", "TIMEPASS", "GO_FOR_IT", "PERFECTION"] as Verdict[])[tier];
}

export const MediaCard: React.FC<MediaCardProps> = ({ item }) => {
  const [imgError, setImgError] = useState(false);

  const cardHref = item.id
    ? `/media/${item.id}`
    : `/media/external/${item.mediaType}/${encodeURIComponent(item.externalId)}`;

  const imageUrl = sanitizeImageUrl(item.coverImage);
  const Icon = TYPE_ICON[item.mediaType] ?? Film;

  const verdict =
    item.voteAverage !== undefined
      ? voteToVerdict(item.voteAverage)
      : titleToVerdict(item.title);
  const cfg = VERDICT_CONFIG[verdict];

  return (
    <Link href={cardHref} className="group block">
      {/* 2:3 Poster Container */}
      <div className="aspect-[2/3] w-full rounded-xl overflow-hidden border border-white/10 bg-zinc-900 relative shadow-sm">
        {imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={item.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          /* Styled Fallback Card with Typography */
          <div className="w-full h-full flex flex-col justify-between p-3.5 bg-gradient-to-br from-zinc-800 via-zinc-900 to-[#121215] text-zinc-300 relative border border-white/[0.04]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold tracking-wider text-zinc-400 uppercase bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08]">
                {item.mediaType}
              </span>
            </div>

            <div className="my-auto py-2 text-center">
              <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto mb-2 text-zinc-400">
                <Icon className="w-4 h-4 opacity-70" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-3 leading-snug tracking-tight px-1">
                {item.title}
              </h3>
            </div>

            <div className="text-center pt-1 border-t border-white/[0.04]">
              <span className="text-[10px] text-zinc-500">
                {item.releaseYear || "Verdikt Entry"}
              </span>
            </div>
          </div>
        )}

        {/* Overlaid Frosted Glass Verdict Chip */}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1.5 shadow-md z-10 pointer-events-none">
          <span className={`text-[10px] font-semibold leading-none ${cfg.textClass}`}>
            {cfg.label}
          </span>
          <div className="flex items-center gap-[2.5px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                className="inline-block h-1.5 w-[5px] rounded-[1px]"
                style={{
                  backgroundColor:
                    i < cfg.score ? cfg.color : "rgba(255, 255, 255, 0.2)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Hover overlay sheen */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
      </div>

      {/* Bottom Metadata */}
      <div className="mt-2 space-y-0.5">
        <p className="text-sm font-medium text-white truncate leading-snug group-hover:text-violet-400 transition-colors">
          {item.title}
        </p>
        <p className="text-xs text-zinc-500 leading-none">
          {item.releaseYear || "TBA"} &middot;{" "}
          <span className="capitalize">{item.mediaType.toLowerCase()}</span>
        </p>
      </div>
    </Link>
  );
};
