"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  fetchTmdbTrailerUrl,
} from "@/lib/tmdb";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Film, Tv, Sparkles, Gamepad2, BookOpen, Play, Shuffle } from "lucide-react";
import { TrailerModal } from "@/components/TrailerModal";
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

// ── Homepage Hero: rotating Movie, Series, Anime, Book, Games ─────────────────────────────────
// TMDB movie + TV genre ids; trending results carry ids only
const TMDB_GENRES: Record<number, string> = {
  10759: "Action & Adventure", 10762: "Kids", 10765: "Sci-Fi & Fantasy", 10768: "War & Politics",
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary",
  18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Science Fiction", 10770: "TV Movie", 53: "Thriller",
  10752: "War", 37: "Western",
};

const HERO_VERDICT_PILL: Record<Verdict, string> = {
  PERFECTION: "border-purple-500 bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]",
  GO_FOR_IT: "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]",
  TIMEPASS: "border-amber-500 bg-amber-500/20 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]",
  SKIP_IT: "border-rose-500 bg-rose-500/20 text-rose-300 shadow-[0_0_15px_rgba(225,29,72,0.3)]",
};

interface HeroItem extends FeedItem {
  genres: string[];
}

/** Soft colour bloom behind the banner; isolate keeps the -z-10 glow above the page background. */
function HeroGlow({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate mb-12">
      <div
        aria-hidden="true"
        className="absolute -inset-4 -z-10 bg-gradient-to-r from-purple-500/20 via-rose-500/20 to-amber-500/20 blur-3xl opacity-60 pointer-events-none rounded-[3rem] transition-all duration-1000"
      />
      {children}
    </div>
  );
}

type HeroKind = "MOVIE" | "SERIES" | "ANIME" | "BOOK" | "GAME";

interface HeroSlide {
  kind: HeroKind;
  /** null for the Games placeholder slide */
  item: HeroItem | null;
  badge: string;
}

const HERO_KIND_LABEL: Record<HeroKind, string> = { MOVIE: "Movie", SERIES: "Series", ANIME: "Anime", BOOK: "Book", GAME: "Game" };
const HERO_ROTATE_S = 7;

function HomeHero({
  slides,
  loading,
  onTrailer,
}: {
  slides: HeroSlide[];
  loading: boolean;
  onTrailer: (item: HeroItem) => void;
}) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  // The active dot's progress bar is the timer: its animationend advances the slide, and hovering or
  // focusing inside the banner pauses it (WCAG 2.2.2). Reduced motion turns the animation, and so auto-advance, off.
  const go = (step: number) => setActiveIndex((i) => (i + step + count) % count);

  if (loading) {
    return (
      <HeroGlow>
        <div className="w-full h-[460px] md:h-[500px] lg:h-[600px] rounded-3xl relative z-10 bg-[#09090b] border border-white/10 animate-pulse" />
      </HeroGlow>
    );
  }
  if (count === 0) return null;

  const current = Math.min(activeIndex, count - 1);
  const active = slides[current];
  const item = active.item;
  const isGame = active.kind === "GAME";
  const verdict = item?.voteAverage !== undefined ? voteToVerdict(item.voteAverage) : null;
  const meta = item
    ? [HERO_KIND_LABEL[active.kind], item.releaseYear, item.genres.slice(0, 2).join(", ")].filter(Boolean)
    : [];

  return (
    <HeroGlow>
      <section
        aria-roledescription="carousel"
        aria-labelledby="home-hero-title"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        // Mouse shortcut only; keyboard and screen-reader users reach the same page through "Read Verdicts"
        onClick={() => item && !isGame && router.push(getItemHref(item))}
        className={`group w-full min-h-[460px] md:min-h-0 md:h-[500px] lg:h-[600px] relative z-10 bg-[#09090b] rounded-3xl overflow-hidden flex items-end md:items-center shadow-2xl border border-white/10 transition-transform duration-700 ease-out motion-reduce:transition-none ${
          isGame ? "" : "cursor-pointer hover:scale-[1.015] motion-reduce:hover:scale-100"
        }`}
      >
        {/* Backgrounds stay mounted and crossfade */}
        {slides.map((s, i) => {
          const src = s.item ? s.item.backdropImage || s.item.coverImage : null;
          return (
            <div
              key={s.kind}
              aria-hidden="true"
              className={`absolute inset-0 transition-opacity duration-1000 motion-reduce:transition-none ${
                i === current ? "opacity-100" : "opacity-0"
              }`}
            >
              {src && s.item?.backdropImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="w-full h-full object-cover" decoding="async" />
              ) : src ? (
                // Book covers are portrait and low-res: a blurred copy fills the banner as ambient colour,
                // and the cover itself sits sharp on top like a framed book (top-centre on phones, right on desktop)
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover blur-2xl scale-110 opacity-50" decoding="async" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    decoding="async"
                    className="absolute top-6 left-1/2 -translate-x-1/2 h-32 md:top-1/2 md:left-auto md:right-[12%] md:translate-x-0 md:-translate-y-1/2 md:h-[55%] aspect-[2/3] object-cover rounded-xl ring-1 ring-white/15 shadow-[0_24px_50px_rgba(0,0,0,0.6)] -rotate-2"
                  />
                </>
              ) : (
                // Games has no artwork yet: an abstract mesh of brand purple fading to emerald
                <div className="absolute inset-0 z-0 bg-zinc-950 bg-radial-[ellipse_at_top_right] from-purple-900/40 via-[#09090b] to-emerald-900/20" />
              )}
            </div>
          );
        })}
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent z-10" />
        {/* On phones the text sits at the bottom, so a bottom-up fade carries the contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent z-10 md:hidden" />

        {/* Phones: the banner grows with its content, and pt-40 leaves the backdrop visible above the text */}
        <div className="relative z-20 w-full max-w-2xl px-5 pt-36 pb-12 md:py-0 md:px-16 flex flex-col gap-2.5 md:gap-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.1] text-[10px] md:text-xs font-bold text-white uppercase tracking-widest w-max mb-1 md:mb-2">
            {active.badge}
          </span>
          <h2 id="home-hero-title" className="text-3xl md:text-6xl font-black text-white leading-tight drop-shadow-xl line-clamp-2">
            {item?.title ?? "Games"}
          </h2>
          {meta.length > 0 && (
            <p className="text-sm text-zinc-300 font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
              {meta.map((m, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span aria-hidden="true">•</span>}
                  <span>{m}</span>
                </React.Fragment>
              ))}
            </p>
          )}
          {verdict && (
            <span
              className={`inline-flex items-center px-4 py-1.5 rounded-full border text-xs font-extrabold uppercase tracking-widest w-max my-1 md:my-2 ${HERO_VERDICT_PILL[verdict]}`}
              title="Verdict from audience ratings"
            >
              {VERDICT_CONFIG[verdict].label}
            </span>
          )}
          {item?.description && (
            <p className="text-sm md:text-base text-zinc-300 italic leading-relaxed line-clamp-2 max-w-xl">{item.description}</p>
          )}
          {item && !isGame && (
            <div className="flex items-center gap-2.5 md:gap-4 mt-2 md:mt-4">
              <Link
                href={getItemHref(item)}
                onClick={(e) => e.stopPropagation()}
                className="bg-white text-black hover:bg-zinc-200 px-5 md:px-8 py-2.5 md:py-3 text-sm md:text-base whitespace-nowrap rounded-full font-bold transition-all transform hover:scale-105 motion-reduce:hover:scale-100 outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                Read Verdicts
              </Link>
              {active.kind !== "BOOK" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrailer(item);
                  }}
                  className="bg-white/[0.08] hover:bg-white/[0.15] backdrop-blur-md border border-white/[0.1] text-white px-5 md:px-8 py-2.5 md:py-3 text-sm md:text-base whitespace-nowrap rounded-full font-bold flex items-center gap-2 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  {/* "Watch" drops on phones so both buttons fit on one row */}
                  <span className="hidden sm:inline">Watch</span> Trailer
                </button>
              )}
            </div>
          )}
        </div>

        {isGame && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-3xl">
            <span className="px-6 py-3 bg-white/[0.08] border border-white/[0.1] rounded-full text-white font-bold tracking-widest uppercase shadow-2xl backdrop-saturate-150">
              Games - Coming Soon
            </span>
          </div>
        )}

        {count > 1 &&
          ([
            { label: "Previous featured title", step: -1, side: "left-4", Icon: ChevronLeft },
            { label: "Next featured title", step: 1, side: "right-4", Icon: ChevronRight },
          ] as const).map(({ label, step, side, Icon }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={(e) => {
                e.stopPropagation();
                go(step);
              }}
              className={`absolute ${side} top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-black/40 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
            </button>
          ))}

        {/* Dots sit above the Games overlay so the carousel can always be moved on */}
        {count > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3" role="group" aria-label="Choose featured title">
            {slides.map((s, i) => (
              <button
                key={s.kind}
                type="button"
                aria-label={`Show featured ${HERO_KIND_LABEL[s.kind]}`}
                aria-current={i === current ? "true" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(i);
                }}
                className={`relative h-2 rounded-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                  i === current
                    ? "w-12 bg-white/20 transition-all duration-500 cursor-default"
                    : "w-2 bg-white/30 hover:bg-white/60 transition-colors cursor-pointer"
                }`}
              >
                {i === current && (
                  <span
                    // keyed by slide so the bar restarts from 0 on every change
                    key={current}
                    aria-hidden="true"
                    onAnimationEnd={() => go(1)}
                    className="absolute top-0 left-0 h-full bg-white motion-reduce:hidden"
                    style={{
                      animation: `hero-progress ${HERO_ROTATE_S}s linear forwards`,
                      animationPlayState: paused ? "paused" : "running",
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </HeroGlow>
  );
}

// ── Poster Card with Frosted Segmented Verdict Chip ──────────────────────────
interface FeedItem extends MediaItem {
  voteAverage?: number;
  popularity?: number;
  /** Overrides the title-page link (fallback books without a Google volume id) */
  href?: string;
}

function PosterCard({ item }: { item: FeedItem }) {
  const verdict =
    item.voteAverage !== undefined
      ? voteToVerdict(item.voteAverage)
      : titleToVerdict(item.title);
  const cfg = VERDICT_CONFIG[verdict];

  return (
    <Link href={item.href ?? getItemHref(item)} className="group block cursor-pointer">
      <PosterImage
        url={item.coverImage}
        title={item.title}
        mediaType={item.mediaType}
        releaseYear={item.releaseYear}
        className={`poster-lift ${item.mediaType === "BOOK" ? "shadow-lg" : ""}`}
      >
        {/* Book covers are often near-white: an inner ring and soft inner shadow, drawn above the image, frame them */}
        {item.mediaType === "BOOK" && (
          <div className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10 shadow-[inset_0_0_32px_rgba(0,0,0,0.35)] pointer-events-none z-[1]" />
        )}

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
/** Thumbnail plays the trailer (onPlay); the "Verdicts" link below opens the title page. */
function LandscapeCard({ item, onPlay, loading }: { item: FeedItem; onPlay: () => void; loading: boolean }) {
  const [imgErr, setImgErr] = useState(false);
  const backdrop =
    sanitizeBackdropUrl(item.backdropImage) || sanitizeImageUrl(item.coverImage);

  return (
    <div className="group block">
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Play trailer: ${item.title}`}
        aria-busy={loading}
        className="block text-left aspect-video w-full rounded-xl overflow-hidden border border-white/10 relative bg-zinc-900 shadow-sm transition-all duration-300 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
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

        {/* Play affordance */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md backdrop-saturate-150 border border-white/30 flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-transform motion-reduce:group-hover:scale-100">
            {loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4 ml-0.5 fill-white" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Overlaid Title */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5 pointer-events-none">
          <p className="text-sm font-bold text-white leading-snug line-clamp-1 drop-shadow-sm group-hover:text-violet-300 transition-colors">
            {item.title}
          </p>
        </div>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500 leading-none">
          {item.mediaType === "SERIES" ? "Series" : "Movie"} &middot;{" "}
          {item.releaseYear || "TBA"}
        </p>
        <Link
          href={getItemHref(item)}
          className="text-xs font-medium text-zinc-400 hover:text-white transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Verdicts &rarr;
        </Link>
      </div>
    </div>
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
/**
 * Shows `size` items from `pool`; shuffle() swaps in a random set, preferring titles not on screen.
 * The shuffled set is tied to the pool it came from, so a new pool (e.g. another platform) starts unshuffled.
 */
function useShuffle<T>(pool: T[], size: number) {
  const [shuffled, setShuffled] = useState<{ from: T[]; items: T[] } | null>(null);
  const visible = (shuffled?.from === pool ? shuffled.items : pool).slice(0, size);
  const shuffle = () => {
    const random = (list: T[]) => {
      const a = [...list];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const unseen = random(pool.filter((x) => !visible.includes(x)));
    setShuffled({ from: pool, items: [...unseen, ...random(visible)].slice(0, size) });
  };
  // With no spare titles (e.g. the 12 fallback books), Shuffle just reorders what is on screen
  return { visible, shuffle, canShuffle: pool.length > 1 };
}

function ShuffleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="group/shuffle shrink-0 bg-white/[0.06] hover:bg-white/[0.10] backdrop-blur-xl border border-white/[0.14] shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)] rounded-full px-3.5 py-2 text-xs font-medium text-white flex items-center gap-2 transition-all cursor-pointer active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      <Shuffle className="w-3.5 h-3.5 text-zinc-300 transition-transform duration-300 group-active/shuffle:rotate-180" aria-hidden="true" />
      Shuffle
    </button>
  );
}

function PosterShelf({
  title,
  items,
  loading,
  skeletonCount = 5,
  visibleCount,
  shuffleLabel,
  fallback,
  gridClassName = "",
  action,
  emptyText = "Nothing to show right now.",
}: {
  title: React.ReactNode;
  items: FeedItem[];
  loading: boolean;
  skeletonCount?: number;
  /** Titles on screen; with shuffleLabel set and a larger pool, Shuffle swaps in others from it. */
  visibleCount?: number;
  shuffleLabel?: string;
  /** Replaces both the skeletons and the empty state, so a shelf that may fail stays one quiet row. */
  fallback?: React.ReactNode;
  gridClassName?: string;
  action?: React.ReactNode;
  emptyText?: string;
}) {
  const { visible, shuffle, canShuffle } = useShuffle(items, visibleCount ?? items.length);
  // Opt-in: only shelves that pass a shuffleLabel get the button
  const showShuffle = !!shuffleLabel && !!visibleCount && canShuffle && !loading;
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2 min-w-0">
          {title}
        </h2>
        {(action || showShuffle) && (
          <div className="flex items-center gap-3">
            {showShuffle && <ShuffleButton onClick={shuffle} label={shuffleLabel} />}
            {action}
          </div>
        )}
      </div>
      {fallback && (loading || visible.length === 0) ? (
        fallback
      ) : loading ? (
        <div className={`catalog-poster-grid ${gridClassName}`}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <PosterSkeleton key={i} />
          ))}
        </div>
      ) : visible.length > 0 ? (
        <div className={`catalog-poster-grid ${gridClassName}`}>
          {visible.map((item) => (
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

// ── Platform brand icons (local logo files in /public/Svg) ──────────────────
// Netflix and Apple TV are transparent wordmarks with dark fills, so they sit on white to stay visible
const PLATFORM_LOGOS: Record<number, { src: string; wordmark?: boolean }> = {
  8: { src: "/Svg/netflix.svg", wordmark: true },
  122: { src: "/Svg/jiohotstar.webp" },
  119: { src: "/Svg/prime-video.webp" },
  283: { src: "/Svg/crunchyroll.webp" },
  237: { src: "/Svg/sonyliv.png" },
  350: { src: "/Svg/apple-tv.svg", wordmark: true },
};

function PlatformIcon({ id, className }: { id: number; className: string }) {
  const logo = PLATFORM_LOGOS[id];
  if (!logo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo.src}
      alt=""
      aria-hidden="true"
      className={`${className} object-contain shrink-0 ${logo.wordmark ? "bg-white p-px" : ""}`}
    />
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
        <PlatformIcon id={active.id} className="w-4 h-4 rounded-sm" />
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
                  <PlatformIcon id={p.id} className="w-4 h-4 rounded-sm" />
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
// Two rows of six on screen; the rest of the pool feeds Shuffle
const PLATFORM_POOL = 24;
function PlatformShelf() {
  const [platformId, setPlatformId] = useState(PLATFORMS[0].id);
  // Results cached per platform so switching back is instant
  const [cache, setCache] = useState<Record<number, FeedItem[]>>({});
  const platform = PLATFORMS.find((p) => p.id === platformId) ?? PLATFORMS[0];
  const items = cache[platformId];

  useEffect(() => {
    if (cache[platformId]) return;
    let cancelled = false;
    fetchPlatformShelf(platformId, PLATFORM_POOL)
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
      skeletonCount={12}
      visibleCount={12}
      shuffleLabel={`Shuffle ${platform.name} titles`}
      gridClassName="catalog-poster-grid--wide"
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
  // Six on screen; the rest of today's trending pool feeds Shuffle
  const watchNow = useShuffle(landscapeItems, 6);
  // Watch Now trailer: looked up on click, then played in the modal
  const [trailer, setTrailer] = useState<{ title: string; url: string | null } | null>(null);
  const [trailerLoadingKey, setTrailerLoadingKey] = useState<string | null>(null);
  const playTrailer = async (item: FeedItem, key: string) => {
    if (trailerLoadingKey) return;
    setTrailerLoadingKey(key);
    const url = item.trailerUrl || (item.externalId ? await fetchTmdbTrailerUrl(item.mediaType, item.externalId) : null);
    setTrailerLoadingKey(null);
    setTrailer({ title: item.title, url });
  };
  // Hero carousel: today's top movie, series and anime (plus a book and the Games placeholder below)
  const [heroTrending, setHeroTrending] = useState<{ movie: HeroItem | null; series: HeroItem | null; anime: HeroItem | null }>({
    movie: null,
    series: null,
    anime: null,
  });

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
      const [movies, tvShows, anime] = await Promise.all([
        fetchTrendingMovies(),
        fetchTrendingTv(),
        fetchTrendingAnime().catch(() => []),
      ]);

      const all = [
        ...movies.map((m) => tmdbToMediaItem(m, "MOVIE")),
        ...tvShows.map((t) => tmdbToMediaItem(t, "SERIES")),
      ];

      // Top title with a backdrop; anime skips anything already featured as the series
      const toHero = (list: typeof movies, type: MediaType, skipId?: number): HeroItem | null => {
        const top = list.find((m) => m.backdrop_path && m.id !== skipId);
        return top
          ? {
              ...tmdbToMediaItem(top, type),
              genres: ((top as typeof top & { genre_ids?: number[] }).genre_ids ?? []).map((g) => TMDB_GENRES[g]).filter(Boolean),
            }
          : null;
      };
      const series = toHero(tvShows, "SERIES");
      setHeroTrending({
        movie: toHero(movies, "MOVIE"),
        series,
        anime: toHero(anime, "ANIME", series ? Number(series.externalId) : undefined),
      });

      const withBackdrops = all.filter((i) => Boolean(i.backdropImage));
      const uniqueBackdrops = deduplicateMedia(withBackdrops);

      setLandscapeItems(uniqueBackdrops);
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

  // Book reuses this week's first "Worth Your Time To Read" pick, so the hero adds no Google Books calls
  const firstBook = worthReading?.[0];
  const heroCandidates: (HeroSlide | null | undefined)[] = [
    heroTrending.movie && { kind: "MOVIE", item: heroTrending.movie, badge: "🔥 #1 Trending Movie Today" },
    heroTrending.series && { kind: "SERIES", item: heroTrending.series, badge: "📺 #1 Trending Series Today" },
    heroTrending.anime && { kind: "ANIME", item: heroTrending.anime, badge: "✨ Trending Anime" },
    firstBook && { kind: "BOOK", item: { ...firstBook, genres: [] }, badge: "📚 Book Of The Week" },
    { kind: "GAME", item: null, badge: "🎮 Games" },
  ];
  const heroSlides = heroCandidates.filter((s): s is HeroSlide => Boolean(s));

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
        <HomeHero
          slides={heroSlides}
          loading={landscapeLoading}
          onTrailer={(item) => playTrailer(item, `hero-${item.externalId}`)}
        />

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
          </main>

          {/* ═══════════ RIGHT COLUMN (Sidebar: Fixed 354px) ═══════════ */}
          <aside className="catalog-sidebar">
            <div className="catalog-sidebar-stack lg:sticky lg:top-[7rem]">
              {/* Most Interested */}
              <MostInterestedCard />
            </div>
          </aside>
        </div>

        {/* Fading rule closes the feed + sidebar area; the shelves below run full width */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-16" />

        {/* catalog-main keeps the shelf heading styles and the 48px section gap */}
        <div className="catalog-main w-full">
          {/* ── Editor's Pick Of The Week: this week's six, fixed until the weekly rotation (no Shuffle, no See All) ── */}
          <PosterShelf
            title={
              <>
                <span className="text-xl">🤍</span> Editor&apos;s Pick Of The Week
              </>
            }
            items={editorsPicks ?? []}
            loading={editorsPicks === null}
            skeletonCount={6}
            gridClassName="catalog-poster-grid--wide"
          />

          {/* ── Worth Your Time To Read: one row of six; each Shuffle brings in six not just shown ── */}
          <PosterShelf
            title={
              <>
                <span className="text-xl">📚</span> Worth Your Time To Read
              </>
            }
            items={worthReading ?? []}
            loading={worthReading === null}
            visibleCount={6}
            shuffleLabel="Shuffle books"
            gridClassName="catalog-poster-grid--wide"
            // Shown only while books load; a spent Google Books quota is covered by the fallback catalog
            fallback={
              <div className="w-full py-12 flex items-center justify-center border border-white/10 rounded-2xl bg-white/[0.02]">
                <p className="text-zinc-500 font-medium">Curating top book verdicts — back shortly.</p>
              </div>
            }
          />

          {/* ── Streaming platforms (single shelf + dropdown) ── */}
          <PlatformShelf />

          {/* ── Section B: "📺 Watch Now" (Landscape Banner Shelf) ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
                <span className="text-xl">📺</span> Watch Now
              </h2>
              {!landscapeLoading && watchNow.canShuffle && (
                <ShuffleButton onClick={watchNow.shuffle} label="Shuffle Watch Now" />
              )}
            </div>

            {landscapeLoading ? (
              <div className="catalog-watch-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <LandscapeSkeleton key={i} />
                ))}
              </div>
            ) : watchNow.visible.length > 0 ? (
              <div className="catalog-watch-grid">
                {watchNow.visible.map((item) => {
                  const key = item.id || `${item.mediaType}-${item.externalId}`;
                  return (
                    <LandscapeCard
                      key={key}
                      item={item}
                      loading={trailerLoadingKey === key}
                      onPlay={() => playTrailer(item, key)}
                    />
                  );
                })}
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <TrailerModal
        isOpen={!!trailer}
        onClose={() => setTrailer(null)}
        trailerUrl={trailer?.url ?? null}
        title={trailer?.title ?? ""}
      />
    </div>
  );
}
