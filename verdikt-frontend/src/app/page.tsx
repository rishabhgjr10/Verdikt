"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { NavMediaCategory } from "@/components/Navbar";
import { MostInterestedCard } from "@/components/MostInterested";
import { PosterImage } from "@/components/PosterImage";
import { MediaItem, MediaType, Verdict } from "@/types/media";
import { mediaApi } from "@/lib/api";
import {
  sanitizeImageUrl,
  sanitizeBackdropUrl,
  voteToVerdict,
  fetchTrendingMovies,
  fetchTrendingTv,
  fetchTrendingAnime,
  tmdbToMediaItem,
  deduplicateFranchises,
  deduplicateMedia,
} from "@/lib/tmdb";
import { Check, ChevronDown, Film, Tv, Sparkles, Gamepad2, BookOpen } from "lucide-react";
import {
  PLATFORMS,
  fetchBalancedFeed,
  fetchBlendedCategory,
  fetchEditorsPicks,
  fetchPlatformShelf,
  fetchWorthReadingBooks,
} from "@/lib/discovery";

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

// ── Poster Shelf (Editor's Pick, Books, Platforms) ───────────────────────────
function PosterShelf({
  title,
  items,
  loading,
  skeletonCount = 5,
  action,
  emptyText = "Nothing to show right now.",
}: {
  title: React.ReactNode;
  items: FeedItem[];
  loading: boolean;
  skeletonCount?: number;
  action?: React.ReactNode;
  emptyText?: string;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2 min-w-0">
          {title}
        </h2>
        {action}
      </div>
      {loading ? (
        <div className="catalog-poster-grid">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <PosterSkeleton key={i} />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="catalog-poster-grid">
          {items.map((item) => (
            <PosterCard key={item.id || `${item.mediaType}-${item.externalId}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 rounded-2xl border border-white/5 bg-zinc-900/20">
          <p className="text-sm text-zinc-400">{emptyText}</p>
        </div>
      )}
    </section>
  );
}

// ── Platform brand icons (inline SVG, always render) ─────────────────────────
const PLATFORM_TILE: Record<number, string> = {
  8: "#E50914",
  122: "linear-gradient(135deg, #0f1026, #2563eb, #db2777)",
  119: "#00A8E1",
  283: "#F47521",
  237: "linear-gradient(135deg, #3b0764, #4f46e5)",
  350: "#18181b",
};

function PlatformGlyph({ id }: { id: number }) {
  switch (id) {
    case 8: // Netflix "N"
      return (
        <svg viewBox="0 0 24 24" className="w-[62%] h-[62%]" aria-hidden="true">
          <path d="M6 3h4l4 10V3h4v18h-4L10 11v10H6z" fill="#fff" />
        </svg>
      );
    case 122: // JioHotstar spark
      return (
        <svg viewBox="0 0 24 24" className="w-[66%] h-[66%]" aria-hidden="true">
          <path d="M12 2l2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6z" fill="#fff" />
        </svg>
      );
    case 119: // Prime smile arrow
      return (
        <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden="true">
          <text x="12" y="13" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">prime</text>
          <path d="M5 16c4 3 10 3 14 0" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M17 14.6l2.2 1.5-2.4 1.1" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 283: // Crunchyroll swirl
      return (
        <svg viewBox="0 0 24 24" className="w-[72%] h-[72%]" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeDasharray="42 12" strokeLinecap="round" />
          <circle cx="13.5" cy="12" r="3.6" fill="#fff" />
        </svg>
      );
    case 237: // Sony LIV
      return (
        <svg viewBox="0 0 24 24" className="w-[74%] h-[74%]" aria-hidden="true">
          <text x="12" y="15.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">LIV</text>
          <circle cx="12" cy="6" r="1.6" fill="#a5b4fc" />
        </svg>
      );
    default: // Apple TV+
      return (
        <svg viewBox="0 0 24 24" className="w-[72%] h-[72%]" aria-hidden="true">
          <path
            d="M9.2 8.2c.6-.7 1-1.6.9-2.5-.9 0-1.9.6-2.5 1.3-.5.6-1 1.5-.8 2.4.9.1 1.8-.5 2.4-1.2zm.4 1.2c-1.3-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7C2.7 9.4 1.5 10.2.9 11.4c-1.300 2.300-.3 5.700.9 7.500.6.900 1.300 1.900 2.300 1.900.9 0 1.300-.6 2.400-.6s1.400.6 2.400.6 1.600-.9 2.200-1.800c.7-1 1-2 1-2.100-.1 0-1.900-.7-1.900-2.800 0-1.700 1.400-2.500 1.500-2.600-.8-1.200-2.100-1.300-2.500-1.300z"
            fill="#fff"
            transform="translate(0.5 -2.5) scale(0.62)"
          />
          <text x="16.2" y="14.2" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="#fff" fontFamily="Arial, sans-serif">tv</text>
        </svg>
      );
  }
}

function PlatformIcon({ id, className }: { id: number; className: string }) {
  return (
    <span
      className={`${className} inline-flex items-center justify-center shrink-0 overflow-hidden border border-white/10`}
      style={{ background: PLATFORM_TILE[id] ?? "#18181b" }}
      aria-hidden="true"
    >
      <PlatformGlyph id={id} />
    </span>
  );
}

// ── iOS liquid-glass platform picker ─────────────────────────────────────────
function PlatformPicker({
  platformId,
  onChange,
}: {
  platformId: number;
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = PLATFORMS.find((p) => p.id === platformId) ?? PLATFORMS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Streaming platform"
        onClick={() => setOpen((o) => !o)}
        className="bg-white/[0.06] hover:bg-white/[0.10] backdrop-blur-xl saturate-150 border border-white/[0.14] shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),0_8px_20px_rgba(0,0,0,0.4)] rounded-full px-3.5 py-2 text-xs font-medium text-white flex items-center gap-2.5 transition-all cursor-pointer"
      >
        <PlatformIcon id={active.id} className="w-4 h-4 rounded" />
        <span>{active.name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-300 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-56 z-50 bg-zinc-900/75 backdrop-blur-2xl saturate-150 border border-white/[0.14] shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_24px_48px_rgba(0,0,0,0.75)] rounded-2xl p-1.5"
        >
          {PLATFORMS.map((p) => {
            const selected = p.id === platformId;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={`w-full hover:bg-white/[0.08] active:scale-[0.99] rounded-xl px-3 py-2 text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                  selected ? "bg-white/[0.10] text-white" : "text-zinc-300"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <PlatformIcon id={p.id} className="w-4 h-4 rounded" />
                  {p.name}
                </span>
                {selected && <Check className="w-3.5 h-3.5 text-violet-300" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Streaming platform shelf: one section, platform picked from a dropdown ───
function PlatformShelf() {
  const [platformId, setPlatformId] = useState(PLATFORMS[0].id);
  // Results cached per platform so switching back is instant
  const [cache, setCache] = useState<Record<number, FeedItem[]>>({});
  const platform = PLATFORMS.find((p) => p.id === platformId) ?? PLATFORMS[0];
  const items = cache[platformId];

  useEffect(() => {
    if (cache[platformId]) return;
    let cancelled = false;
    fetchPlatformShelf(platformId)
      .catch(() => [] as FeedItem[])
      .then((result) => {
        if (!cancelled) setCache((c) => ({ ...c, [platformId]: result }));
      });
    return () => {
      cancelled = true;
    };
  }, [platformId, cache]);

  return (
    <PosterShelf
      title={
        <>
          <PlatformIcon id={platform.id} className="w-7 h-7 rounded-lg" />
          <span>{platform.heading}</span>
        </>
      }
      items={items ?? []}
      loading={!items}
      skeletonCount={10}
      emptyText={`No titles found on ${platform.name} right now.`}
      action={<PlatformPicker platformId={platformId} onChange={setPlatformId} />}
    />
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

  // Loading states
  const [postersLoading, setPostersLoading] = useState(true);
  const [landscapeLoading, setLandscapeLoading] = useState(true);

  // ── Smart Feed Deduplication & Franchise Grouping ──────────────────────────
  const fetchPosters = useCallback(async (cat: NavMediaCategory) => {
    setPostersLoading(true);
    try {
      let items: FeedItem[] = [];

      if (cat === "ALL") {
        // Balanced mix (Indian + global movies/series, anime, books, a game), already
        // de-duplicated and interleaved; franchise grouping would drop e.g. a Dune book next to the film.
        const feed = await fetchBalancedFeed();
        setPosterItems(feed.slice(0, 10));
        return;
      } else if (cat === "MOVIE" || cat === "SERIES") {
        // Half Indian (origin IN), half global trending
        items = await fetchBlendedCategory(cat);
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
      setPosterItems(deduplicated.slice(0, 10));
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

  // ── Curated weekly shelves ──────────────────────────────────────────────────
  const [editorsPicks, setEditorsPicks] = useState<FeedItem[] | null>(null);
  const [worthReading, setWorthReading] = useState<FeedItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEditorsPicks()
      .catch(() => [] as FeedItem[])
      .then((items) => !cancelled && setEditorsPicks(items));
    fetchWorthReadingBooks()
      .catch(() => [] as FeedItem[])
      .then((items) => !cancelled && setWorthReading(items));
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPosters(category);
  }, [category, fetchPosters]);

  useEffect(() => {
    fetchLandscape();
  }, [fetchLandscape]);

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

            {/* ── Editor's Pick Of The Week (rotates weekly) ── */}
            <PosterShelf
              title={
                <>
                  <span className="text-xl">🤍</span> Editor&apos;s Pick Of The Week
                </>
              }
              items={editorsPicks ?? []}
              loading={editorsPicks === null}
            />

            {/* ── Worth Your Time To Read (books across decades, rotates weekly) ── */}
            <PosterShelf
              title={
                <>
                  <span className="text-xl">📚</span> Worth Your Time To Read
                </>
              }
              items={worthReading ?? []}
              loading={worthReading === null}
            />

            {/* ── Streaming platforms (single shelf + dropdown) ── */}
            <PlatformShelf />

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
              {/* Most Interested */}
              <MostInterestedCard />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
