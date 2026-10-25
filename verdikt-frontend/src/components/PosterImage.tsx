"use client";

import React, { useState } from "react";
import { Film, Tv, Sparkles, Gamepad2, BookOpen } from "lucide-react";

export interface PosterImageProps {
  url?: string | null;
  title: string;
  mediaType?: string;
  releaseYear?: number | string | null;
  className?: string;
  aspect?: string; // e.g. "aspect-[2/3]" or "w-10 aspect-[2/3]"
  children?: React.ReactNode;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  MOVIE: Film,
  SERIES: Tv,
  ANIME: Sparkles,
  GAME: Gamepad2,
  BOOK: BookOpen,
};

function sanitizeUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://")) return trimmed.replace("http://", "https://");
  if (trimmed.startsWith("/")) return `https://image.tmdb.org/t/p/w500${trimmed}`;
  return trimmed;
}

export function PosterImage({
  url,
  title,
  mediaType = "MOVIE",
  releaseYear,
  className = "",
  aspect = "aspect-[2/3]",
  children,
}: PosterImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const cleanUrl = sanitizeUrl(url);
  const typeKey = (mediaType || "MOVIE").toUpperCase();
  const Icon = TYPE_ICONS[typeKey] || Film;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900 ${aspect} ${className}`}
    >
      {/* 1. Underlying Styled Fallback Tile (always present, styled like "The Sand Dune") */}
      <div className="absolute inset-0 w-full h-full flex flex-col justify-between p-3.5 bg-gradient-to-br from-zinc-800 via-zinc-900 to-[#121215] text-zinc-300 border border-white/[0.04]">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold tracking-wider text-zinc-400 uppercase bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08]">
            {mediaType}
          </span>
        </div>

        <div className="my-auto py-2 text-center">
          <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto mb-2 text-zinc-400">
            <Icon className="w-4 h-4 opacity-70" />
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-3 leading-snug tracking-tight px-1">
            {title}
          </h3>
        </div>

        <div className="text-center pt-1 border-t border-white/[0.04]">
          <span className="text-[10px] text-zinc-500">
            {releaseYear || "Verdikt"}
          </span>
        </div>
      </div>

      {/* 2. Overlaid Image when available */}
      {cleanUrl && !error && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cleanUrl}
          alt={title}
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* 3. Optional Overlaid Children (Verdict chips, badges, etc.) */}
      {children}
    </div>
  );
}
