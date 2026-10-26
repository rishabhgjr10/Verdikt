"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { fetchTrendingMovies, fetchTrendingTv, sanitizeImageUrl } from "@/lib/tmdb";

let cachedPostersList: string[] | null = null;

export interface PosterWallProps {
  forceFallback?: boolean;
}

function PosterCard({
  url,
  priority = false,
}: {
  url: string;
  priority?: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-zinc-900/60 shrink-0">
      {!imgError ? (
        <Image
          src={url}
          alt=""
          fill
          sizes="(min-width:1024px) 18vw, 30vw"
          loading={priority ? "eager" : "lazy"}
          priority={priority}
          decoding="async"
          onError={() => setImgError(true)}
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-zinc-900 to-indigo-950/30 flex items-center justify-center p-3">
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="text-violet-400 font-bold text-xs">V</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function PosterWall({ forceFallback = false }: PosterWallProps) {
  const [columns, setColumns] = useState<[string[], string[], string[]] | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (forceFallback) {
      setHasError(true);
      setIsReady(true);
      return;
    }

    let isMounted = true;

    async function loadPosters() {
      try {
        let urls: string[] = [];

        if (cachedPostersList && cachedPostersList.length >= 6) {
          urls = cachedPostersList;
        } else {
          const [movies, tv] = await Promise.all([
            fetchTrendingMovies(),
            fetchTrendingTv(),
          ]);
          const combined = [...movies, ...tv];
          for (const item of combined) {
            if (item.poster_path) {
              const sanitized = sanitizeImageUrl(item.poster_path);
              if (sanitized) urls.push(sanitized);
            }
          }
          urls = Array.from(new Set(urls));
          if (urls.length >= 6) {
            cachedPostersList = urls;
          }
        }

        if (!isMounted) return;

        if (urls.length < 6) {
          setHasError(true);
          setIsReady(true);
          return;
        }

        // Shuffle once and take ~24
        const pool = [...urls].sort(() => Math.random() - 0.5).slice(0, 24);

        // Split round-robin into 3 columns
        const col1: string[] = [];
        const col2: string[] = [];
        const col3: string[] = [];

        pool.forEach((url, i) => {
          if (i % 3 === 0) col1.push(url);
          else if (i % 3 === 1) col2.push(url);
          else col3.push(url);
        });

        // Ensure each column has at least 8 posters so one copy is taller than 100dvh
        const padList = (list: string[]) => {
          let padded = [...list];
          while (padded.length < 8 && padded.length > 0) {
            padded = [...padded, ...list];
          }
          return padded;
        };

        const finalCol1 = padList(col1);
        const finalCol2 = padList(col2);
        const finalCol3 = padList(col3);

        setColumns([finalCol1, finalCol2, finalCol3]);
        setIsReady(true);
      } catch (err) {
        if (!isMounted) return;
        console.error("PosterWall failed to load posters, rendering fallback", err);
        setHasError(true);
        setIsReady(true);
      }
    }

    loadPosters();

    return () => {
      isMounted = false;
    };
  }, [forceFallback]);

  // Fallback static violet/indigo gradient wall if fetch fails or < 6 posters
  if (hasError) {
    return (
      <div
        aria-hidden="true"
        className="relative h-[100dvh] w-full overflow-hidden select-none pointer-events-none poster-wall-mask"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-violet-950/40 via-zinc-950/80 to-indigo-950/30" />
        <div className="grid grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4 h-full w-full opacity-60">
          {[0, 1, 2].map((colIdx) => (
            <div key={colIdx} className="flex flex-col gap-3 sm:gap-4 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] w-full rounded-2xl border border-white/5 bg-gradient-to-br from-violet-900/15 via-zinc-900/50 to-indigo-900/15 shadow-lg shrink-0"
                />
              ))}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-violet-950/15 to-zinc-950/70 z-10" />
      </div>
    );
  }

  if (!columns) {
    return (
      <div
        aria-hidden="true"
        className="relative h-[100dvh] w-full overflow-hidden select-none pointer-events-none poster-wall-mask"
      />
    );
  }

  const [col1, col2, col3] = columns;

  return (
    <div
      aria-hidden="true"
      className="relative h-[100dvh] w-full overflow-hidden select-none pointer-events-none poster-wall-mask"
    >
      {/* Subtle violet tint overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-violet-950/10 to-zinc-950/70 z-10" />

      {/* Animated 3-column wall with fade-in when ready */}
      <div
        className={`grid grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4 h-full w-full transition-opacity duration-500 ${
          isReady ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Column 1: normal (moving up), delay -18s */}
        <div
          className="poster-col flex flex-col gap-3 sm:gap-4 shrink-0"
          style={{
            animationDuration: "var(--poster-duration, 60s)",
            animationDelay: "-18s",
          }}
        >
          {col1.map((url, idx) => (
            <PosterCard key={`c1-a-${idx}`} url={url} priority={idx < 3} />
          ))}
          {/* Second copy for infinite seamless loop */}
          <div className="flex flex-col gap-3 sm:gap-4" aria-hidden="true">
            {col1.map((url, idx) => (
              <PosterCard key={`c1-b-${idx}`} url={url} priority={false} />
            ))}
          </div>
        </div>

        {/* Column 2: reverse (moving down), delay -9s, 70s duration */}
        <div
          className="poster-col poster-col--reverse flex flex-col gap-3 sm:gap-4 shrink-0"
          style={{
            animationDuration: "var(--poster-duration, 70s)",
            animationDelay: "-9s",
          }}
        >
          {col2.map((url, idx) => (
            <PosterCard key={`c2-a-${idx}`} url={url} priority={idx < 3} />
          ))}
          {/* Second copy for infinite seamless loop */}
          <div className="flex flex-col gap-3 sm:gap-4" aria-hidden="true">
            {col2.map((url, idx) => (
              <PosterCard key={`c2-b-${idx}`} url={url} priority={false} />
            ))}
          </div>
        </div>

        {/* Column 3: normal (moving up), delay -36s */}
        <div
          className="poster-col flex flex-col gap-3 sm:gap-4 shrink-0"
          style={{
            animationDuration: "var(--poster-duration, 60s)",
            animationDelay: "-36s",
          }}
        >
          {col3.map((url, idx) => (
            <PosterCard key={`c3-a-${idx}`} url={url} priority={idx < 3} />
          ))}
          {/* Second copy for infinite seamless loop */}
          <div className="flex flex-col gap-3 sm:gap-4" aria-hidden="true">
            {col3.map((url, idx) => (
              <PosterCard key={`c3-b-${idx}`} url={url} priority={false} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PosterWall;
