"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { NavMediaCategory } from "@/components/Navbar";
import { StreamingHub } from "@/components/StreamingHub";
import { Leaderboard } from "@/components/Leaderboard";
import { PosterImage } from "@/components/PosterImage";
import { MediaItem, MediaType, Verdict } from "@/types/media";
import { mediaApi } from "@/lib/api";
import {
  sanitizeImageUrl,
  sanitizeBackdropUrl,
  voteToVerdict,
  fetchTrendingMovies,
  fetchTrendingTv,
  fetchTrendingAll,
  fetchTrendingAnime,
  tmdbToMediaItem,
  deduplicateFranchises,
  deduplicateMedia,
} from "@/lib/tmdb";
import { Film, Tv, Sparkles, Gamepad2, BookOpen } from "lucide-react";

// ── Verdict Configuration & Color Tokens ─────────────────────────────────────
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

// Fallback deterministic verdict if voteAverage is unavailable
function titleToVerdict(title: string): Verdict {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  const tier = Math.abs(hash) % 4;
  return (["SKIP_IT", "TIMEPASS", "GO_FOR_IT", "PERFECTION"] as Verdict[])[tier];
}

function getItemHref(item: MediaItem): string {
  const isUuid =
    item.id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
  if (isUuid) {
    return `/media/${item.id}`;
  }
  const extId =
    item.externalId ||
    (item.id.startsWith("tmdb-") ? item.id.replace("tmdb-", "") : item.id);
  const type = item.mediaType || "MOVIE";
  return `/media/external/${type}/${encodeURIComponent(extId)}`;
}

// ── Poster Card with Frosted Segmented Verdict Chip ──────────────────────────
interface FeedItem extends MediaItem {
  voteAverage?: number;
  popularity?: number;
}

function PosterCard({ item }: { item: FeedItem }) {
  const verdict =
    item.voteAverage !== undefined
      ? voteToVerdict(item.voteAverage)
      : titleToVerdict(item.title);
  const cfg = VERDICT_CONFIG[verdict];

  return (
    <Link href={getItemHref(item)} className="group block cursor-pointer">
      <PosterImage
        url={item.coverImage}
        title={item.title}
        mediaType={item.mediaType}
        releaseYear={item.releaseYear}
        className="shadow-sm"
      >
        {/* Overlaid Frosted Segmented Verdict Chip */}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1.5 shadow-md z-10 pointer-events-none">
          <span
            className="text-[10px] font-semibold leading-none"
            style={{ color: cfg.color }}
          >
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

        {/* Hover Sheen */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
      </PosterImage>

      {/* Text Meta (Below Poster) */}
      <div className="mt-2 space-y-0.5">
        <p className="text-sm font-medium text-white truncate leading-snug group-hover:text-violet-400 transition-colors">
          {item.title}
        </p>
        <p className="text-xs text-zinc-500 leading-none">
          {item.releaseYear || "2026"}
        </p>
      </div>
    </Link>
  );
}

// ── Landscape Card ("Watch Now") ──────────────────────────────────────────────
function LandscapeCard({ item }: { item: FeedItem }) {
  const [imgErr, setImgErr] = useState(false);
  const backdrop =
    sanitizeBackdropUrl(item.backdropImage) || sanitizeImageUrl(item.coverImage);

  return (
    <Link href={getItemHref(item)} className="group block cursor-pointer">
      <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10 relative bg-zinc-900 shadow-sm transition-all duration-300">
        {backdrop && !imgErr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdrop}
            alt={item.title}
            onError={() => setImgErr(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center p-4">
            <span className="text-xs text-zinc-500 font-medium">{item.title}</span>
          </div>
        )}

        {/* Bottom gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

        {/* Overlaid Title */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5 pointer-events-none">
          <p className="text-sm font-bold text-white leading-snug line-clamp-1 drop-shadow-sm group-hover:text-violet-300 transition-colors">
            {item.title}
          </p>
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        <p className="text-xs text-zinc-500 leading-none">
          {item.mediaType === "SERIES" ? "Series" : "Movie"} &middot;{" "}
          {item.releaseYear || "TBA"}
        </p>
      </div>
    </Link>
  );
}

// ── Loading Skeletons ────────────────────────────────────────────────────────
function PosterSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-[2/3] w-full rounded-xl bg-zinc-900/60 border border-white/5 animate-pulse" />
      <div className="space-y-1.5 pt-1">
        <div className="h-4 bg-zinc-800/80 rounded w-4/5 animate-pulse" />
        <div className="h-3 bg-zinc-800/50 rounded w-1/3 animate-pulse" />
      </div>
    </div>
  );
}

function LandscapeSkeleton() {
  return (
    <div className="space-y-2">
      <div className="aspect-video w-full rounded-xl bg-zinc-900/60 animate-pulse border border-white/[0.04]" />
      <div className="h-3.5 w-1/2 rounded bg-zinc-800/60 animate-pulse" />
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="rounded-2xl bg-zinc-900/40 border border-white/[0.08] p-5 space-y-4">
      <div className="h-4 w-1/2 rounded bg-zinc-800 animate-pulse" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-zinc-800 animate-pulse" />
          <div className="aspect-[2/3] w-10 rounded-md bg-zinc-800 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-3/4 rounded bg-zinc-800 animate-pulse" />
            <div className="h-2.5 w-1/2 rounded bg-zinc-800/50 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HOMEPAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function HomePage() {
  const [category, setCategory] = useState<NavMediaCategory>("ALL");

  // Data states
  const [posterItems, setPosterItems] = useState<FeedItem[]>([]);
  const [landscapeItems, setLandscapeItems] = useState<FeedItem[]>([]);
  const [leaderboardItems, setLeaderboardItems] = useState<FeedItem[]>([]);

  // Loading states
  const [postersLoading, setPostersLoading] = useState(true);
  const [landscapeLoading, setLandscapeLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  // ── Smart Feed Deduplication & Franchise Grouping ──────────────────────────
  const fetchPosters = useCallback(async (cat: NavMediaCategory) => {
    setPostersLoading(true);
    try {
      let items: FeedItem[] = [];

      if (cat === "ALL") {
        const trendingAll = await fetchTrendingAll();
        items = trendingAll.map((item) => tmdbToMediaItem(item));

        if (items.length < 15) {
          const [movies, tvShows] = await Promise.all([
            fetchTrendingMovies(),
            fetchTrendingTv(),
          ]);
          const combined = [
            ...items,
            ...movies.map((m) => tmdbToMediaItem(m, "MOVIE")),
            ...tvShows.map((t) => tmdbToMediaItem(t, "SERIES")),
          ];
          items = combined;
        }
      } else if (cat === "MOVIE") {
        const movies = await fetchTrendingMovies();
        items = movies.map((m) => tmdbToMediaItem(m, "MOVIE"));
      } else if (cat === "SERIES") {
        const tv = await fetchTrendingTv();
        items = tv.map((t) => tmdbToMediaItem(t, "SERIES"));
      } else if (cat === "ANIME") {
        const anime = await fetchTrendingAnime();
        items = anime.map((a) => tmdbToMediaItem(a, "ANIME"));
      } else {
        try {
          const res = await mediaApi.search("", cat as MediaType);
          items = res;
        } catch {
          items = [];
        }
      }

      const deduplicated = deduplicateFranchises(items);
      setPosterItems(deduplicated.slice(0, 15));
    } catch (err) {
      console.error("Failed to fetch posters", err);
      setPosterItems([]);
    } finally {
      setPostersLoading(false);
    }
  }, []);

  // ── Fetch "Watch Now" (Landscape Banners) ──────────────────────────────────
  const fetchLandscape = useCallback(async () => {
    setLandscapeLoading(true);
    try {
      const [movies, tvShows] = await Promise.all([
        fetchTrendingMovies(),
        fetchTrendingTv(),
      ]);

      const all = [
        ...movies.map((m) => tmdbToMediaItem(m, "MOVIE")),
        ...tvShows.map((t) => tmdbToMediaItem(t, "SERIES")),
      ];

      const withBackdrops = all.filter((i) => Boolean(i.backdropImage));
      const uniqueBackdrops = deduplicateMedia(withBackdrops);

      setLandscapeItems(uniqueBackdrops.slice(0, 6));
    } catch (err) {
      console.error("Failed to fetch landscape items", err);
      setLandscapeItems([]);
    } finally {
      setLandscapeLoading(false);
    }
  }, []);

  // ── Fetch Sidebar Leaderboard ("Most Interested") ───────────────────────────
  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const trendingAll = await fetchTrendingAll();
      const mapped = trendingAll.map((item) => tmdbToMediaItem(item));
      const uniqueLeaderboard = deduplicateMedia(mapped);

      uniqueLeaderboard.sort(
        (a, b) => (b.voteAverage || 0) - (a.voteAverage || 0)
      );

      setLeaderboardItems(uniqueLeaderboard.slice(0, 5));
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
      setLeaderboardItems([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPosters(category);
  }, [category, fetchPosters]);

  useEffect(() => {
    fetchLandscape();
    fetchLeaderboard();
  }, [fetchLandscape, fetchLeaderboard]);

  const activeCategoryLabel =
    category === "ALL"
      ? "All Media"
      : category === "MOVIE"
        ? "Movies"
        : category === "SERIES"
          ? "Series"
          : category === "ANIME"
            ? "Anime"
            : category === "GAME"
              ? "Games"
              : "Books";

  return (
    <div className="verdikt-app verdikt-catalog min-h-screen">
      {/* Main Layout Wrapper (catalog-content container) */}
      <div className="catalog-content">
        <div className="catalog-layout">
          {/* ═══════════ LEFT COLUMN (Main Content) ═══════════ */}
          <main className="catalog-main">
            {/* ── Section A: "🔥 Talk Of The Town" (Poster Shelf) ── */}
            <section>
              {/* Section Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
                    <span className="text-xl">🔥</span> Talk Of The Town
                  </h2>
                  <span className="text-[11px] font-medium text-zinc-400 bg-white/[0.04] border border-white/[0.08] px-2.5 py-0.5 rounded-full">
                    {activeCategoryLabel}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 font-medium">
                  {postersLoading ? "Updating..." : `${posterItems.length} Titles`}
                </span>
              </div>

              {/* 5-Column Poster Grid */}
              {postersLoading ? (
                <div className="catalog-poster-grid">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <PosterSkeleton key={i} />
                  ))}
                </div>
              ) : posterItems.length > 0 ? (
                <div className="catalog-poster-grid">
                  {posterItems.map((item) => (
                    <PosterCard
                      key={item.id || `${item.mediaType}-${item.externalId}`}
                      item={item}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 rounded-2xl border border-white/5 bg-zinc-900/20">
                  <p className="text-sm text-zinc-400">
                    No items found for this category.
                  </p>
                </div>
              )}
            </section>

            {/* ── Section B: "📺 Watch Now" (Landscape Banner Shelf) ── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
                  <span className="text-xl">📺</span> Watch Now
                </h2>
              </div>

              {landscapeLoading ? (
                <div className="catalog-watch-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <LandscapeSkeleton key={i} />
                  ))}
                </div>
              ) : landscapeItems.length > 0 ? (
                <div className="catalog-watch-grid">
                  {landscapeItems.map((item) => (
                    <LandscapeCard
                      key={item.id || `${item.mediaType}-${item.externalId}`}
                      item={item}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          </main>

          {/* ═══════════ RIGHT COLUMN (Sidebar: Fixed 354px) ═══════════ */}
          <aside className="catalog-sidebar">
            <div className="catalog-sidebar-stack lg:sticky lg:top-[7rem]">
              {/* Streaming Radar */}
              <StreamingHub />

              {/* Most Interested */}
              {leaderboardLoading ? (
                <LeaderboardSkeleton />
              ) : (
                <Leaderboard items={leaderboardItems} />
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
