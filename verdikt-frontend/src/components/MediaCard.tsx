"use client";

import React from "react";
import Link from "next/link";
import { MediaItem, Verdict } from "@/types/media";
import { voteToVerdict } from "@/lib/tmdb";
import { PosterImage } from "@/components/PosterImage";

interface MediaCardProps {
  item: MediaItem & { voteAverage?: number };
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

function titleToVerdict(title: string): Verdict {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  const tier = Math.abs(hash) % 4;
  return (["SKIP_IT", "TIMEPASS", "GO_FOR_IT", "PERFECTION"] as Verdict[])[tier];
}

export const MediaCard: React.FC<MediaCardProps> = ({ item }) => {
  const isUuid =
    item.id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
  const extId =
    item.externalId ||
    (item.id?.startsWith("tmdb-") ? item.id.replace("tmdb-", "") : item.id);
  const cardHref = isUuid
    ? `/media/${item.id}`
    : `/media/external/${item.mediaType}/${encodeURIComponent(extId || "")}`;

  const verdict =
    item.voteAverage !== undefined
      ? voteToVerdict(item.voteAverage)
      : titleToVerdict(item.title);
  const cfg = VERDICT_CONFIG[verdict];

  return (
    <Link href={cardHref} className="group block">
      {/* 2:3 Poster with Shared PosterImage */}
      <PosterImage
        url={item.coverImage}
        title={item.title}
        mediaType={item.mediaType}
        releaseYear={item.releaseYear}
        className="poster-lift"
      >
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
      </PosterImage>

      {/* Meta */}
      <div className="mt-2 space-y-0.5">
        <h3 className="text-sm font-semibold text-white truncate group-hover:text-violet-400 transition-colors">
          {item.title}
        </h3>
        <p className="text-xs text-zinc-400">
          {item.releaseYear || "TBA"} &bull; {item.mediaType}
        </p>
      </div>
    </Link>
  );
};
