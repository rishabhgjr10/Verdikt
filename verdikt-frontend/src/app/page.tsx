"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Navbar, NavMediaCategory } from "@/components/Navbar";
import { StreamingHub } from "@/components/StreamingHub";
import { Leaderboard } from "@/components/Leaderboard";
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
  // If backend database UUID
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

// ── Poster Card with Overlaid Frosted Verdict Chip & Styled Fallback ──────────
interface FeedItem extends MediaItem {
  voteAverage?: number;
  popularity?: number;
}

function PosterCard({ item }: { item: FeedItem }) {
  const [imgErr, setImgErr] = useState(false);
  const img = sanitizeImageUrl(item.coverImage);
  const verdict =
    item.voteAverage !== undefined
      ? voteToVerdict(item.voteAverage)
      : titleToVerdict(item.title);
  const cfg = VERDICT_CONFIG[verdict];
  const Icon = TYPE_ICON[item.mediaType] ?? Film;

  return (
    <Link href={getItemHref(item)} className="group block">
      {/* Poster Container */}
      <div className="aspect-[2/3] w-full rounded-xl overflow-hidden border border-white/10 bg-zinc-900 relative shadow-sm">
        {img && !imgErr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={item.title}
            onError={() => setImgErr(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          /* Styled Fallback Card with Title Typography */
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
                {item.releaseYear || "Verdikt"}
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
          {item.releaseYear || "TBA"}
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
      <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10 relative bg-zinc-900 shadow-sm">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

        {/* Overlaid Title */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5">
          <p className="text-sm font-bold text-white leading-snug line-clamp-1 drop-shadow-sm group-hover:text-violet-300 transition-colors">
            {item.title}
          </p>
        </div>
      </div>
      <div className="mt-2">
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
    <div className="space-y-2">
      <div className="aspect-[2/3] w-full rounded-xl bg-zinc-900 animate-pulse border border-white/[0.04]" />
      <div className="h-3.5 w-3/4 rounded bg-zinc-800 animate-pulse" />
      <div className="h-3 w-1/3 rounded bg-zinc-800/60 animate-pulse" />
    </div>
  );
}

function LandscapeSkeleton() {
  return (
    <div className="space-y-2">
      <div className="aspect-video w-full rounded-xl bg-zinc-900 animate-pulse border border-white/[0.04]" />
      <div className="h-3.5 w-1/2 rounded bg-zinc-800 animate-pulse" />
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
        // Query TMDB /trending/all/day
        const trendingAll = await fetchTrendingAll();
        items = trendingAll.map((item) => tmdbToMediaItem(item));

        // Supplement to ensure a full discovery shelf
        if (items.length < 15) {
          const [movies, tvShows] = await Promise.all([
            fetchTrendingMovies(),
            fetchTrendingTv(),
          ]);
          items = [
            ...items,
            ...movies.map((m) => tmdbToMediaItem(m, "MOVIE")),
            ...tvShows.map((t) => tmdbToMediaItem(t, "SERIES")),
          ];
        }
      } else if (cat === "MOVIE") {
        const movies = await fetchTrendingMovies();
        items = movies.map((m) => tmdbToMediaItem(m, "MOVIE"));
      } else if (cat === "SERIES") {
        const tvShows = await fetchTrendingTv();
        items = tvShows.map((t) => tmdbToMediaItem(t, "SERIES"));
      } else if (cat === "ANIME") {
        const anime = await fetchTrendingAnime();
        items = anime.map((a) => tmdbToMediaItem(a, "SERIES"));
        if (items.length < 5) {
          const backendAnime = await mediaApi
            .search("anime", "ANIME", 1)
            .catch(() => [] as MediaItem[]);
          items = [...items, ...backendAnime];
        }
      } else if (cat === "GAME") {
        const backendGames = await mediaApi
          .search("popular", "GAME", 1)
          .catch(() => [] as MediaItem[]);
        items = backendGames;
      } else if (cat === "BOOK") {
        const backendBooks = await mediaApi
          .search("popular", "BOOK", 1)
          .catch(() => [] as MediaItem[]);
        items = backendBooks;
      }

      // ── Smart Franchise Grouping ──────────────────────────────────────────
      // Group incoming titles by their base franchise/collection name,
      // displaying ONLY the single highest-rated / most popular entry per franchise.
      const franchiseDeduplicated = deduplicateFranchises(items);
      setPosterItems(franchiseDeduplicated.slice(0, 15));
    } catch (err) {
      console.error("Failed to fetch poster shelf", err);
      setPosterItems([]);
    } finally {
      setPostersLoading(false);
    }
  }, []);

  // ── Fetch Landscape Shelf ("Watch Now") with 16:9 Backdrops ─────────────────
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

      // Prioritize items that have rich backdrop imagery
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

      // Sort by popularity / vote score
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
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      {/* 1. Top Unified Navigation Bar with Media Type Filter Dropdown */}
      <Navbar
        selectedCategory={category}
        onSelectCategory={setCategory}
      />

      {/* Unified Page Container: Perfectly Aligns Nav and Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ═══════════ MAIN FEED (9 cols) ═══════════ */}
          <main className="lg:col-span-9 space-y-10 min-w-0">
            {/* ── Section A: "🔥 Talk Of The Town" (Poster Shelf) ── */}
            <section>
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

              {postersLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <PosterSkeleton key={i} />
                  ))}
                </div>
              ) : posterItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {posterItems.map((item) => (
                    <PosterCard
                      key={item.id || `${item.mediaType}-${item.externalId}`}
                      item={item}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 rounded-2xl border border-white/[0.06] bg-zinc-900/20">
                  <p className="text-sm text-zinc-400">
                    No items found for this category.
                  </p>
                </div>
              )}
            </section>

            {/* ── Section B: "📺 Watch Now" (Landscape Banner Shelf) ── */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 tracking-tight flex items-center gap-2">
                <span className="text-xl">📺</span> Watch Now
              </h2>

              {landscapeLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <LandscapeSkeleton key={i} />
                  ))}
                </div>
              ) : landscapeItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
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

          {/* ═══════════ SIDEBAR (3 cols) ═══════════ */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-[80px] space-y-5">
              {/* Top Widget: Streaming Hub / Quick Verdict */}
              <StreamingHub />

              {/* "Most Interested" Leaderboard */}
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
