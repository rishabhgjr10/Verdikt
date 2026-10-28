"use client";

import React, { useCallback, useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { MediaDetailSkeleton } from "@/components/MediaDetailSkeleton";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { ReviewComposer } from "@/components/reviews/ReviewComposer";
import { DeleteReviewDialog } from "@/components/reviews/DeleteReviewDialog";
import { ShareCardModal } from "@/components/reviews/ShareCardModal";
import { verdictOption } from "@/components/reviews/verdicts";
import { useToast } from "@/context/ToastContext";
import { TrailerModal } from "@/components/TrailerModal";
import { ReviewModal } from "@/components/ReviewModal";
import { CollectionsSheet } from "@/components/CollectionsSheet";
import { CollectionSummary, MediaItem, MediaType, MediaUserState, ReviewWithRelations, Verdict } from "@/types/media";
import { collectionsApi, mediaApi, reviewApi, userMediaApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNav } from "@/context/NavContext";
import { useRequireAuth } from "@/lib/auth-redirect";
import { GlassButton } from "@/components/GlassButton";
import { MediaActions } from "@/components/MediaActions";
import { RatingBadges } from "@/components/RatingBadges";
import { ExternalReviews } from "@/components/ExternalReviews";
import { ExpandableDescription } from "@/components/MediaHeroDetails";
import { NavMediaCategory } from "@/components/Navbar";
import { PosterImage } from "@/components/PosterImage";
import {
  getPlatformSearchUrl,
  getPlatformColor,
  youtubeTrailerUrl,
} from "@/lib/streamingUtils";
import {
  fetchTmdbHeroDetails,
  fetchTmdbMovieDetails,
  fetchTmdbCollection,
  fetchTmdbRecommendations,
  fetchTmdbWatchProvidersIN,
  TmdbCollection,
  TmdbHeroDetails,
  TmdbItem,
  TmdbWatchProvider,
  WatchOffer,
  voteToVerdict,
} from "@/lib/tmdb";
import {
  Play,
  PlusCircle,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  Sparkles,
  ExternalLink,
  Layers,
  ChevronDown,
  Heart,
  Bookmark,
  Edit3,
  Users,
  Scale,
  ChevronLeft,
  ChevronRight,
  Share2,
  CalendarClock,
  Check,
} from "lucide-react";

const SLIDE_SECONDS = 8;

/** Crossfade keyframes for n stacked slides: each is visible for 1/n of the cycle, fading over 1.5s. */
function slideshowCss(n: number) {
  const cycle = n * SLIDE_SECONDS;
  const fade = (1.5 / cycle) * 100;
  const shown = 100 / n;
  return `@keyframes hero-fade-${n}{0%{opacity:0}${fade}%{opacity:1}${shown}%{opacity:1}${shown + fade}%{opacity:0}100%{opacity:0}}`;
}

// Toggle that is on (e.g. saved): violet tint, same shape as ICON_PILL
const ICON_PILL_ON =
  "inline-flex items-center justify-center bg-violet-500/20 hover:bg-violet-500/30 backdrop-blur-lg border border-violet-400/40 text-violet-200 rounded-full p-3 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer";

const ICON_PILL =
  "inline-flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.1] backdrop-blur-lg border border-white/[0.1] text-zinc-200 hover:text-white rounded-full p-3 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer";

const formatRuntime = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

/** Converts http:// → https:// (Google Books / insecure CDN links) and builds high-res TMDB URLs */
function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string" || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://")) return trimmed.replace("http://", "https://");
  if (trimmed.startsWith("/tmdb-img/")) return trimmed;
  if (trimmed.startsWith("/")) return `/tmdb-img/t/p/w1280${trimmed}`;
  return trimmed;
}

/** Featured services with local logos in /public/Svg; wordmarks are transparent with dark fills, so they sit on a white tile */
const PLATFORM_LOGOS: { match: string[]; src: string; wordmark?: boolean }[] = [
  { match: ["netflix"], src: "/Svg/netflix.svg", wordmark: true },
  { match: ["prime video"], src: "/Svg/prime-video.webp" },
  { match: ["apple"], src: "/Svg/apple-tv.svg", wordmark: true },
  { match: ["crunchyroll"], src: "/Svg/crunchyroll.webp" },
  { match: ["hotstar", "jio"], src: "/Svg/jiohotstar.webp" },
  { match: ["sony"], src: "/Svg/sonyliv.png" },
];

// Resold add-ons ("Crunchyroll Amazon Channel") are not the service itself
const findPlatformLogo = (name: string) =>
  /channel/i.test(name) ? undefined : PLATFORM_LOGOS.find((l) => l.match.some((m) => name.toLowerCase().includes(m)));

const OFFER_LABELS: Record<WatchOffer, string> = {
  flatrate: "Subscription",
  free: "Free",
  ads: "Free with ads",
  rent: "Rent",
  buy: "Buy",
};

/** Logo falls back local file → TMDB logo → coloured initial if an image fails to load. */
function ProviderRow({ provider, title }: { provider: TmdbWatchProvider; title: string }) {
  const name = provider.provider_name;
  const local = findPlatformLogo(name);
  const sources = [local?.src, provider.logo_path && `/tmdb-img/t/p/original${provider.logo_path}`].filter(
    Boolean
  ) as string[];
  const [failed, setFailed] = useState(0);
  const src = sources[failed];
  const { bg, text } = getPlatformColor(name);
  return (
    <li className="border-b border-white/[0.04] last:border-0">
      <a
        href={getPlatformSearchUrl(name, title)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 py-2 group rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            onError={() => setFailed((f) => f + 1)}
            className={`w-8 h-8 rounded-md object-contain shadow-sm border border-white/10 shrink-0 ${
              src === local?.src && local.wordmark ? "bg-white p-1" : ""
            }`}
          />
        ) : (
          <span
            className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${bg} ${text}`}
            aria-hidden="true"
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-white truncate">{name}</span>
          <span className="block text-xs text-zinc-500">{OFFER_LABELS[provider.offer]}</span>
        </span>
        <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-200 transition-colors shrink-0" aria-hidden="true" />
      </a>
    </li>
  );
}

/**
 * Horizontal shelf. Without `header`: frosted chevrons float at the edges (desktop) and hide at either end.
 * With `header`: it renders the header row with a ‹ › button pair on the right, faded when there's nowhere to go.
 * Either way the buttons scroll by `step` px, and each edge fades while more items are off-screen on that side.
 */
function ShelfRail({
  step,
  label,
  className = "",
  header,
  children,
}: {
  step: number;
  label: string;
  className?: string;
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  // ResizeObserver fires once on observe, so the edges are known on first paint without a setState-in-effect
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);

  // Each edge fades only while there is more to scroll that way (left after swiping, right until the end)
  const fade = `linear-gradient(to right, ${edges.start ? "black" : "transparent"} 0%, black 12%, black 88%, ${edges.end ? "black" : "transparent"} 100%)`;
  const arrow =
    "hidden lg:flex absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/15 items-center justify-center text-white hover:bg-white/20 transition shadow-lg opacity-70 group-hover/rail:opacity-100 cursor-pointer outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/60";

  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * step, behavior: "smooth" });
  const list = (
    <ul
      ref={ref}
      className={`flex overflow-x-auto no-scrollbar scroll-smooth ${className}`}
      style={edges.start && edges.end ? undefined : { maskImage: fade, WebkitMaskImage: fade }}
    >
      {children}
    </ul>
  );

  if (header) {
    const pairBtn =
      "w-8 h-8 rounded-full border border-white/10 bg-white/[0.06] backdrop-blur-md hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-white/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-white/60";
    return (
      <div>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
          {header}
          <div className="flex items-center gap-2">
            <button type="button" aria-label={`Scroll ${label} left`} disabled={edges.start} onClick={() => scroll(-1)} className={pairBtn}>
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label={`Scroll ${label} right`} disabled={edges.end} onClick={() => scroll(1)} className={pairBtn}>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {list}
      </div>
    );
  }

  return (
    <div className="relative group/rail">
      {list}
      {!edges.start && (
        <button
          type="button"
          aria-label={`Scroll ${label} left`}
          onClick={() => scroll(-1)}
          className={`${arrow} -left-4`}
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          aria-label={`Scroll ${label} right`}
          onClick={() => scroll(1)}
          className={`${arrow} -right-4`}
        >
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const CONSENSUS_BADGE: Record<Verdict, string> = {
  PERFECTION: "border-purple-400/50 bg-purple-400/10 text-purple-400 shadow-[0_0_14px_rgba(192,132,252,0.35)]",
  GO_FOR_IT: "border-emerald-400/50 bg-emerald-400/10 text-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.35)]",
  TIMEPASS: "border-amber-400/50 bg-amber-400/10 text-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.35)]",
  SKIP_IT: "border-rose-400/50 bg-rose-400/10 text-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.35)]",
};

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEDIA_TYPES: MediaType[] = ["MOVIE", "SERIES", "ANIME", "GAME", "BOOK"];

export default function MediaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = use(params);
  const { type: typeParam } = use(searchParams);
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const { setActiveCategory } = useNav();

  const [mediaItem, setMediaItem] = useState<MediaItem | null>(null);
  const [reviews, setReviews] = useState<ReviewWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Franchise & Recommendation Shelves
  const [collection, setCollection] = useState<TmdbCollection | null>(null);
  const [recommendations, setRecommendations] = useState<TmdbItem[]>([]);
  // India watch providers fetched live: stored platformsJson is US-region names without logos
  const [watchProviders, setWatchProviders] = useState<TmdbWatchProvider[] | null>(null);
  const [heroDetails, setHeroDetails] = useState<TmdbHeroDetails | null>(null);
  // Collections sheet opened from the hero bookmark; null while closed, state fetched on open
  const [heroSheetState, setHeroSheetState] = useState<MediaUserState | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [savedCollectionIds, setSavedCollectionIds] = useState<string[]>([]);
  const [systemCollectionIds, setSystemCollectionIds] = useState<Set<string>>(new Set());
  const [collectionsList, setCollectionsList] = useState<CollectionSummary[]>([]);
  // The collection named on the big Collections button: the one this title was most recently saved to
  const [lastSavedCollectionId, setLastSavedCollectionId] = useState<string | null>(null);
  const latestCollection = (ids: string[], lists: CollectionSummary[]) =>
    lists.filter((c) => ids.includes(c.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.id ?? null;
  const onCollectionsChange = (ids: string[]) => {
    const own = ids.filter((id) => !systemCollectionIds.has(id));
    const added = own.find((id) => !savedCollectionIds.includes(id));
    setSavedCollectionIds(own);
    if (added) {
      setLastSavedCollectionId(added);
      // A collection just created in the sheet isn't in the cached list yet
      if (!collectionsList.some((c) => c.id === added)) collectionsApi.list().then(setCollectionsList).catch(() => {});
    } else if (lastSavedCollectionId && !own.includes(lastSavedCollectionId)) {
      setLastSavedCollectionId(latestCollection(own, collectionsList));
    }
  };
  // TMDB ids of franchise movies in the member's Watch History (drives the saga progress rail)
  const [watchedExternalIds, setWatchedExternalIds] = useState<Set<string>>(new Set());
  const [partDetails, setPartDetails] = useState<Record<number, { runtime: number | null; status: string | null }>>({});
  // Captured once per visit so the release check stays stable across renders
  const [now] = useState(() => Date.now());

  // Franchise entries' runtime and production status (one TMDB request per film, collections are small)
  useEffect(() => {
    const parts = collection?.parts;
    if (!parts?.length) return;
    let cancelled = false;
    Promise.all(parts.map((p) => fetchTmdbMovieDetails(p.id))).then((list) => {
      if (cancelled) return;
      const next: Record<number, { runtime: number | null; status: string | null }> = {};
      list.forEach((d, i) => {
        next[parts[i].id] = { runtime: d?.runtime ?? null, status: d?.status ?? null };
      });
      setPartDetails(next);
    });
    return () => {
      cancelled = true;
    };
  }, [collection]);

  // Desktop: the poster scales (2:3 kept, never cropped) so its height matches the details column.
  // Growing the poster narrows that column, which can only make it taller, so the size settles in a step or two.
  // Callback ref: attaches the moment the details column mounts (it doesn't exist while the skeleton shows),
  // measures once straight away, then re-measures on resize. The returned cleanup is React 19's ref cleanup.
  const [posterWidth, setPosterWidth] = useState<number | null>(null);
  const detailsRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      if (!desktop.matches) return setPosterWidth(null);
      const next = Math.round(Math.min(340, Math.max(240, (el.offsetHeight * 2) / 3)));
      setPosterWidth((w) => (w !== null && Math.abs(w - next) < 4 ? w : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    desktop.addEventListener("change", update);
    return () => {
      ro.disconnect();
      desktop.removeEventListener("change", update);
    };
  }, []);
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "ALL">("ALL");

  const [trailerModalOpen, setTrailerModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReviewWithRelations | null>(null);
  const [shareTarget, setShareTarget] = useState<ReviewWithRelations | null>(null);
  const { showToast } = useToast();
  const [posterError, setPosterError] = useState(false);
  const [backdropError, setBackdropError] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        // /media/{uuid} is the canonical route; a TMDB id ("123" or "tmdb-123") would 400 on getById,
        // so import it by external id instead and swap the URL to the UUID without re-running this effect
        let item: MediaItem;
        if (UUID_RE.test(id)) {
          item = await mediaApi.getById(id);
        } else {
          // shortcut: without ?type= a bare TMDB id is assumed to be a movie; links should carry the type
          const type = MEDIA_TYPES.find((t) => t === typeParam?.toUpperCase()) ?? "MOVIE";
          item = await mediaApi.getByExternalId(type, decodeURIComponent(id).replace(/^tmdb-/, ""));
          window.history.replaceState(null, "", `/media/${item.id}`);
        }
        setMediaItem(item);

        if (item.id) {
          const revs = await reviewApi.getByMediaId(item.id);
          setReviews(revs);
        }

        // Fetch Franchise Collection & Recommendations
        if (item.externalId) {
          const extId = item.externalId;

          // 1. Hero extras (tagline, age rating, crew, backdrops), plus the franchise collection for movies
          const tmdbType = item.mediaType;
          if (tmdbType === "MOVIE" || tmdbType === "SERIES" || tmdbType === "ANIME") {
            const movieDetails = await fetchTmdbHeroDetails(tmdbType, extId);
            setHeroDetails(movieDetails);
            if (tmdbType === "MOVIE" && movieDetails?.belongs_to_collection?.id) {
              const col = await fetchTmdbCollection(
                movieDetails.belongs_to_collection.id
              );
              if (col && col.parts) {
                // Sort chronologically by release_date
                col.parts.sort((a, b) => {
                  const da = a.release_date || "";
                  const db = b.release_date || "";
                  return da.localeCompare(db);
                });
                setCollection(col);
              }
            }
          }

          // 2. Query Recommendations
          const recs = await fetchTmdbRecommendations(item.mediaType, extId);
          setRecommendations(recs);
        }
      } catch (err: any) {
        console.error("Error loading media details", err);
        setError("Failed to load media details.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id, typeParam]);

  useEffect(() => {
    const type = mediaItem?.mediaType;
    const extId = mediaItem?.externalId;
    if (!extId || (type !== "MOVIE" && type !== "SERIES" && type !== "ANIME")) return;
    let cancelled = false;
    fetchTmdbWatchProvidersIN(type, extId).then((list) => {
      if (!cancelled) setWatchProviders(list);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaItem?.mediaType, mediaItem?.externalId]);

  useEffect(() => {
    const mediaId = mediaItem?.id;
    if (!user || !mediaId) return;
    let cancelled = false;
    // The member's own collections (Watch History is a system collection, so it doesn't count as "saved")
    Promise.all([userMediaApi.getState(mediaId), collectionsApi.list()])
      .then(([s, lists]) => {
        if (cancelled) return;
        const system = new Set(lists.filter((c) => c.isSystem).map((c) => c.id));
        const own = s.collectionIds.filter((id) => !system.has(id));
        setIsFavorite(s.favorite);
        setSystemCollectionIds(system);
        setSavedCollectionIds(own);
        setCollectionsList(lists);
        setLastSavedCollectionId(latestCollection(own, lists));
        const history = lists.find((c) => c.systemType === "WATCH_HISTORY");
        if (history) {
          collectionsApi
            .get(history.id)
            .then((d) => {
              if (!cancelled) setWatchedExternalIds(new Set(d.items.filter((i) => i.mediaType === "MOVIE").map((i) => String(i.externalId))));
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, mediaItem?.id]);

  useEffect(() => {
    if (mediaItem?.mediaType) {
      setActiveCategory(mediaItem.mediaType as NavMediaCategory);
    }
    return () => {
      setActiveCategory(null);
    };
  }, [mediaItem?.mediaType, setActiveCategory]);

  const reloadReviews = async () => {
    if (mediaItem?.id) {
      const revs = await reviewApi.getByMediaId(mediaItem.id);
      setReviews(revs);
    }
  };

  // Optimistic: the card disappears at once and comes back if the server refuses
  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    const previous = reviews;
    setDeleteTarget(null);
    setReviews((list) => list.filter((r) => r.id !== target.id));
    try {
      await reviewApi.delete(target.id);
      showToast("Review deleted");
    } catch {
      setReviews(previous);
      showToast("Couldn't delete your review", { tone: "error", detail: "Nothing was changed. Please try again." });
    }
  };

  const shareStory = async (rev: ReviewWithRelations) => {
    const url = window.location.href;
    const title = `${rev.user?.username ?? "A Verdikt member"} on ${mediaItem?.title ?? "Verdikt"}`;
    // Spoilers stay out of anything that leaves the page
    const text = `${verdictOption(rev.verdict).label}${rev.containsSpoilers ? "" : `: ${rev.content}`}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") {
        showToast("Couldn't share this review", { tone: "error" });
      }
    }
  };

  if (isLoading) {
    return <MediaDetailSkeleton />;
  }

  if (error || !mediaItem) {
    return (
      <div className="min-h-screen text-zinc-100 flex flex-col">
        <div className="max-w-md mx-auto my-20 text-center p-8 bg-zinc-900 rounded-2xl border border-white/10">
          <Sparkles className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">Media Title Not Found</h2>
          <p className="mt-2 text-xs text-zinc-400">
            The requested item could not be retrieved.
          </p>
        </div>
      </div>
    );
  }

  const mediaTypeConfig = {
    MOVIE: { label: "Movie", icon: Film },
    SERIES: { label: "Series", icon: Tv },
    ANIME: { label: "Anime", icon: Sparkles },
    GAME: { label: "Game", icon: Gamepad2 },
    BOOK: { label: "Book", icon: BookOpen },
  }[mediaItem.mediaType] || { label: mediaItem.mediaType, icon: Film };

  const TypeIcon = mediaTypeConfig.icon;

  const heroImg = backdropError
    ? null
    : (sanitizeImageUrl(mediaItem.backdropImage) || sanitizeImageUrl(mediaItem.coverImage));
  // TMDB backdrops drive the slideshow; books/games (or a failed fetch) fall back to the stored image
  const slides = heroDetails?.backdrops.length ? heroDetails.backdrops : heroImg ? [heroImg] : [];
  // A cover used as a backdrop is portrait and low-res, so it stays blurred as before
  const blurSlides = !heroDetails?.backdrops.length && !sanitizeImageUrl(mediaItem.backdropImage);
  const releaseDate = heroDetails?.releaseDate
    ? new Date(heroDetails.releaseDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const metaParts = [releaseDate, heroDetails?.runtimeMinutes ? formatRuntime(heroDetails.runtimeMinutes) : null].filter(Boolean);

  // Optimistic: the heart flips at once and flips back if the server refuses
  const toggleFavorite = () =>
    requireAuth(async () => {
      const next = !isFavorite;
      setIsFavorite(next);
      try {
        await userMediaApi.setFavorite(mediaItem.id, next);
      } catch {
        setIsFavorite(!next);
        showToast("Couldn't update Favorites", { tone: "error", detail: "Nothing was changed. Please try again." });
      }
    });

  const openSaveSheet = () =>
    requireAuth(async () => {
      try {
        setHeroSheetState(await userMediaApi.getState(mediaItem.id));
      } catch {
        showToast("Couldn't load your collections", { tone: "error", detail: "Please try again." });
      }
    });

  // The viewer's own review leads the list
  const myReview = user ? reviews.find((r) => r.user?.id === user.id) : undefined;
  const orderedReviews = myReview ? [myReview, ...reviews.filter((r) => r !== myReview)] : reviews;

  // Not out yet (TMDB release date in the future): no watching or verdicts until it releases
  const releaseAt = heroDetails?.releaseDate ? new Date(`${heroDetails.releaseDate}T00:00:00`) : null;
  const isUnreleased = !!releaseAt && releaseAt.getTime() > now;
  const daysToRelease = releaseAt ? Math.ceil((releaseAt.getTime() - now) / 86_400_000) : 0;

  // One entry point for writing a verdict: edit your own, else jump to the inline composer, else the modal
  const composerOpen = !!user && !myReview && !isUnreleased;
  const openVerdict = () => {
    if (myReview) return editMyVerdict(myReview.id);
    if (composerOpen) {
      const form = document.getElementById("review-composer");
      form?.scrollIntoView({ behavior: "smooth", block: "center" });
      form?.querySelector("textarea")?.focus({ preventScroll: true });
      return;
    }
    requireAuth(() => setReviewModalOpen(true));
  };

  // Saga track: release state, watch progress and runtimes for each franchise entry
  const saga = (collection?.parts ?? []).map((p) => {
    const releasedAt = p.release_date ? new Date(`${p.release_date}T00:00:00`).getTime() : null;
    const d = partDetails[p.id];
    return {
      part: p,
      upcoming: releasedAt === null || releasedAt > now,
      watched: watchedExternalIds.has(String(p.id)),
      runtime: d?.runtime ?? null,
      status: d?.status ?? null,
    };
  });
  const sagaReleased = saga.filter((x) => !x.upcoming);
  const sagaWatched = saga.filter((x) => x.watched).length;
  const sagaRuntime = sagaReleased.reduce((sum, x) => sum + (x.runtime ?? 0), 0);
  const sagaNext = sagaReleased.find((x) => !x.watched && String(x.part.id) !== String(mediaItem.externalId));

  // Titles already on the franchise shelf don't repeat in More Like This
  const franchiseIds = new Set((collection?.parts ?? []).map((p) => p.id));

  const shareTitle = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${mediaItem.title} on Verdikt`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") showToast("Couldn't share this title", { tone: "error" });
    }
  };

  // Consensus verdict: the most common member verdict, else TMDB's audience score
  const consensus = (() => {
    if (reviews.length > 0) {
      const counts = new Map<Verdict, number>();
      for (const r of reviews) counts.set(r.verdict, (counts.get(r.verdict) ?? 0) + 1);
      const top = [...counts].sort((a, b) => b[1] - a[1])[0][0];
      return { verdict: top, source: `Community verdict from ${reviews.length} member review${reviews.length === 1 ? "" : "s"}` };
    }
    if (heroDetails?.voteAverage != null) {
      return { verdict: voteToVerdict(heroDetails.voteAverage), source: "Verdict from audience ratings" };
    }
    return null;
  })();

  // Opens the member's own review in the inline editor (pre-filled) and brings it into view
  const editMyVerdict = (reviewId: string) => {
    setEditingReviewId(reviewId);
    requestAnimationFrame(() =>
      document.getElementById(`review-${reviewId}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  // TMDB lists tiers separately ("Netflix Standard with Ads"); keep the first entry per base service
  const seenProviders = new Set<string>();
  const providers = (watchProviders ?? []).flatMap((p) => {
    const base = p.provider_name.split(" Standard")[0].split(" Premium")[0].split(" Free with Ads")[0].split(" with Ads")[0];
    if (seenProviders.has(base)) return [];
    seenProviders.add(base);
    return [{ ...p, provider_name: base }];
  });
  // Main card: streaming offers on the six featured services; everything else goes to "Other Options"
  const isPrimary = (p: TmdbWatchProvider) =>
    p.offer !== "rent" && p.offer !== "buy" && !!findPlatformLogo(p.provider_name);
  const primaryProviders = providers.filter(isPrimary);
  const secondaryProviders = providers.filter((p) => !isPrimary(p));

  return (
    <div className="relative min-h-screen -mt-28 flex flex-col text-zinc-100">
      {/* Cinematic backdrop: fixed to the viewport, clipped to this page so it never covers the footer */}
      {slides.length > 0 && (
        <div className="absolute inset-0 z-0 pointer-events-none [clip-path:inset(0)]" aria-hidden="true">
          <style>{`${slideshowCss(slides.length)}@keyframes hero-pan{from{transform:scale(1.12) translateX(-3%)}to{transform:scale(1.12) translateX(3%)}}`}</style>
          <div className="fixed inset-0 z-0 overflow-hidden">
            {slides.map((src, i) => (
              <div
                key={src}
                className="absolute inset-0 motion-reduce:!animate-none"
                style={{
                  opacity: i === 0 ? 1 : 0,
                  animation:
                    slides.length > 1
                      ? `hero-fade-${slides.length} ${slides.length * SLIDE_SECONDS}s linear ${i * SLIDE_SECONDS}s infinite backwards`
                      : undefined,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  onError={src === heroImg ? () => setBackdropError(true) : undefined}
                  className={`w-full h-full object-cover motion-reduce:!animate-none ${
                    blurSlides ? "blur-3xl opacity-50 saturate-150" : ""
                  }`}
                  style={{ animation: "hero-pan 30s ease-in-out infinite alternate", transform: "scale(1.12)" }}
                />
              </div>
            ))}
            {/* Even vignette keeps the whole backdrop visible; the bottom-up fade carries text contrast */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/60 to-transparent z-10" />
          </div>
        </div>
      )}

      {/* Detail Page Content (relative z-10 with existing pt-28 clearance) */}
      <div className="relative z-10 flex-1 flex flex-col pt-28">
        {/* ── Hero: poster | title, facts, overview | library actions + watch online ── */}
        <div className="w-full max-w-[1500px] mx-auto px-6 lg:px-12 pt-12 pb-2 relative z-20 flex flex-col lg:flex-row gap-8 justify-between items-start">
          {/* Left: poster only, always 2:3 (never stretched or cropped). 270px on phones; on desktop its width is
              set from the details column's height (240–340px) so both end level */}
          <div className="self-center lg:self-start">
            <div
              className="w-[270px] shrink-0 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative"
              style={posterWidth ? { width: posterWidth } : undefined}
            >
              {/* PosterImage fills its 2:3 box with an absolute w-full h-full object-cover image */}
              <PosterImage
                url={mediaItem.coverImage}
                title={mediaItem.title}
                mediaType={mediaItem.mediaType}
                releaseYear={mediaItem.releaseYear}
                className="border-0 rounded-none"
              />
            </div>
          </div>

          {/* Center: metadata, title, facts, overview, genres */}
          <div ref={detailsRef} className="flex-1 min-w-0 max-w-3xl flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.12] text-xs text-zinc-200 font-medium">
                <TypeIcon className="w-3.5 h-3.5" aria-hidden="true" />
                {[mediaTypeConfig.label, mediaItem.releaseYear].filter(Boolean).join(" • ")}
              </span>
              {consensus && (
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-extrabold uppercase tracking-widest ${CONSENSUS_BADGE[consensus.verdict]}`}
                  title={consensus.source}
                >
                  {VERDICT_CONFIG[consensus.verdict].label}
                </span>
              )}
              {myReview && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.12] text-xs text-zinc-200 font-medium">
                  Your verdict:
                  <span className={`font-semibold ${VERDICT_CONFIG[myReview.verdict].textClass}`}>
                    {VERDICT_CONFIG[myReview.verdict].label}
                  </span>
                </span>
              )}
            </div>

            <h1
              title={mediaItem.title}
              className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight drop-shadow-lg mt-1 mb-4 leading-[1.05] line-clamp-2 break-words"
            >
              {mediaItem.title}
            </h1>

            {(heroDetails?.ageRating || metaParts.length > 0) && (
              <p className="flex flex-wrap items-center text-sm text-zinc-300 mb-4">
                {heroDetails?.ageRating && (
                  <span
                    className="inline-flex items-center justify-center px-1.5 py-0.5 border border-white/30 text-white/70 text-[10px] rounded-sm font-medium mr-2"
                    title="Age rating"
                  >
                    {heroDetails.ageRating}
                  </span>
                )}
                {metaParts.join(" • ")}
              </p>
            )}

            {/* External ratings (client-side, never blocks the page; empty slot collapses) */}
            <div className="mb-6 empty:hidden">
              <RatingBadges mediaId={mediaItem.id} />
            </div>

            {/* Genres sit here, not at the bottom: Type, year and genre already show in the pill and date row,
                so the old facts grid is gone and the column ends near the poster instead of trailing below it */}
            {mediaItem.genresJson && mediaItem.genresJson.length > 0 && (
              <ul className="flex flex-wrap gap-2 mb-6" aria-label="Genres">
                {mediaItem.genresJson.map((genre, idx) => (
                  <li key={idx} className="media-hero-chip text-xs font-medium">
                    {genre}
                  </li>
                ))}
              </ul>
            )}

            {/* Books, games and some series have no TMDB crew, so their creators/author still show */}
            {!heroDetails?.crew.length && mediaItem.creatorsJson && mediaItem.creatorsJson.length > 0 && (
              <p className="text-sm mb-6 truncate" title={mediaItem.creatorsJson.join(", ")}>
                <span className="text-zinc-500">{mediaItem.mediaType === "BOOK" ? "Author" : "Created by"} </span>
                <span className="text-white font-medium">
                  {mediaItem.creatorsJson.slice(0, 2).join(", ") +
                    (mediaItem.creatorsJson.length > 2 ? ` +${mediaItem.creatorsJson.length - 2}` : "")}
                </span>
              </p>
            )}

            {/* Content actions: favorite, save, trailer, verdict */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <button
                type="button"
                className={`${ICON_PILL} active:scale-90`}
                aria-label="Favorite"
                aria-pressed={isFavorite}
                title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                onClick={toggleFavorite}
              >
                <Heart
                  className={`w-5 h-5 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    isFavorite ? "fill-rose-500 text-rose-500 scale-110" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                className={savedCollectionIds.length > 0 ? ICON_PILL_ON : ICON_PILL}
                aria-label={savedCollectionIds.length > 0 ? "Saved to a collection. Manage collections" : "Save to a collection"}
                aria-pressed={savedCollectionIds.length > 0}
                title={savedCollectionIds.length > 0 ? "Saved — manage collections" : "Save to a collection"}
                onClick={openSaveSheet}
              >
                <Bookmark className={`w-5 h-5 ${savedCollectionIds.length > 0 ? "fill-current" : ""}`} aria-hidden="true" />
              </button>
              <button type="button" className={ICON_PILL} aria-label="Share this title" title="Share" onClick={shareTitle}>
                <Share2 className="w-5 h-5" aria-hidden="true" />
              </button>

              {mediaItem.mediaType !== "BOOK" && mediaItem.mediaType !== "GAME" && (
                <a
                  href={mediaItem.trailerUrl || youtubeTrailerUrl(mediaItem.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={mediaItem.trailerUrl ? undefined : "Opens a trailer search on YouTube"}
                  className="flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.1] backdrop-blur-lg border border-white/[0.1] text-zinc-200 hover:text-white font-medium text-sm px-4 py-2.5 rounded-full transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  Watch Trailer
                </a>
              )}
            </div>

            {heroDetails?.tagline && (
              <p className="italic text-zinc-400 font-serif text-lg mb-4 drop-shadow-lg">&ldquo;{heroDetails.tagline}&rdquo;</p>
            )}

            {mediaItem.description && (
              <ExpandableDescription text={mediaItem.description} />
            )}

            {heroDetails && heroDetails.crew.length > 0 && (
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-5">
                {heroDetails.crew.map((c) => (
                  <div key={c.name} className="min-w-0 flex flex-col-reverse">
                    <dt className="text-xs text-zinc-400">{c.job}</dt>
                    <dd className="text-sm font-bold text-white mb-0.5 truncate" title={c.name}>
                      {c.name}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

          </div>

          {/* Right: library actions + watch online */}
          <div className="flex-shrink-0 w-full lg:w-72 xl:w-[320px] flex flex-col gap-4 lg:sticky lg:top-24">
            <MediaActions
              mediaId={mediaItem.id}
              mediaTitle={mediaItem.title}
              mediaType={mediaItem.mediaType}
              unreleased={isUnreleased}
              onCollectionsChange={onCollectionsChange}
              collectionLabel={
                savedCollectionIds.length > 0
                  ? collectionsList.find((c) => c.id === lastSavedCollectionId)?.name ?? "Saved"
                  : undefined
              }
              onWatchedChange={(watched) =>
                setWatchedExternalIds((prev) => {
                  const next = new Set(prev);
                  if (watched) next.add(String(mediaItem.externalId));
                  else next.delete(String(mediaItem.externalId));
                  return next;
                })
              }
              onUnwatched={() =>
                setReviews((prev) => prev.filter((rev) => rev.user?.id !== user?.id))
              }
              // A second submit would silently replace the member's verdict, so reviewers get Edit instead
              verdictAction={
                <button
                  type="button"
                  onClick={openVerdict}
                  className="w-full bg-white/[0.05] hover:bg-white/[0.1] backdrop-blur-md border border-white/[0.1] text-white px-4 py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  {myReview ? <Edit3 className="w-4 h-4" aria-hidden="true" /> : <PlusCircle className="w-4 h-4" aria-hidden="true" />}
                  {myReview ? "Edit Your Verdict" : "Write a Verdict"}
                </button>
              }
            />

            {isUnreleased ? (
              <section className="mt-2 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-start gap-3">
                <CalendarClock className="w-5 h-5 text-violet-300 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Coming soon</h2>
                  <p className="mt-1 text-white font-semibold">Releases {releaseDate}</p>
                  <p className="text-sm text-zinc-400">
                    {daysToRelease === 1 ? "Tomorrow" : `In ${daysToRelease} days`} · save it to Watch Later to keep track
                  </p>
                </div>
              </section>
            ) : (
              watchProviders !== null &&
              providers.length === 0 &&
              mediaItem.mediaType !== "BOOK" &&
              mediaItem.mediaType !== "GAME" && (
                <section className="mt-2 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-start gap-3">
                  <Tv className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Watch online</h2>
                    <p className="mt-1 text-white font-semibold">Not streaming in India yet</p>
                    <p className="text-sm text-zinc-400">Check back later, or save it to Watch Later.</p>
                  </div>
                </section>
              )
            )}

            {primaryProviders.length > 0 && (
              <section className="mt-2 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4">
                <h2 className="flex justify-between items-center text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  Watch Online
                </h2>
                <ul>
                  {primaryProviders.map((p) => (
                    <ProviderRow key={p.provider_id} provider={p} title={mediaItem.title} />
                  ))}
                </ul>
              </section>
            )}

            {secondaryProviders.length > 0 && (
              <details open={primaryProviders.length === 0} className="group/other rounded-2xl border border-white/[0.06] bg-zinc-900/40 backdrop-blur-md px-4 py-2">
                <summary className="cursor-pointer list-none flex justify-between items-center text-xs font-semibold text-zinc-500 uppercase tracking-wider py-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-white/40">
                  Other Options ({secondaryProviders.length})
                  <ChevronDown className="w-3.5 h-3.5 transition-transform group-open/other:rotate-180" aria-hidden="true" />
                </summary>
                <ul className="mt-2">
                  {secondaryProviders.map((p) => (
                    <ProviderRow key={p.provider_id} provider={p} title={mediaItem.title} />
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>

        {/* ── Main Discovery & Community Content (mt-8 keeps the cast close to the hero) ── */}
        <div className="w-full max-w-[1500px] mx-auto px-6 lg:px-12 mt-8 pb-10 space-y-12">
          {/* ── Top Cast (TMDB billing order) ── */}
          {heroDetails && heroDetails.cast.length > 0 && (
            <section aria-labelledby="top-cast-title">
              <ShelfRail
                step={408}
                label="cast"
                className="gap-6 items-start"
                header={
                  <h2 id="top-cast-title" className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-violet-400" aria-hidden="true" />
                    Top Cast
                  </h2>
                }
              >
                {heroDetails.cast.map((c) => (
                  <li key={c.id} className="flex-shrink-0 w-28 flex flex-col items-center">
                    {/* shrink-0 + fixed size: avatars stay 96px however many cast members there are */}
                    <div className="w-24 h-24 shrink-0 rounded-full overflow-hidden bg-zinc-800 border border-white/10 ring-2 ring-transparent hover:ring-white/20 transition flex items-center justify-center">
                      {c.profileUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.profileUrl} alt="" loading="lazy" className="w-24 h-24 rounded-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-zinc-400" aria-hidden="true">
                          {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white text-center mt-3 w-full leading-snug line-clamp-2" title={c.name}>
                      {c.name}
                    </p>
                    {c.character && (
                      <p className="text-xs text-zinc-400 text-center w-full mt-0.5 line-clamp-2">{c.character}</p>
                    )}
                  </li>
                ))}
              </ShelfRail>
            </section>
          )}

          {/* ── Shelf 1: Complete Franchise & Sequels ── */}
          {collection && collection.parts && collection.parts.length > 0 && (
            <section className="space-y-4">
              {/* Wraps on phones: the collection pill and progress pill don't fit beside the title */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Layers className="w-5 h-5 text-violet-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Complete Franchise &amp; Sequels
                  </h2>
                  <span className="text-xs text-zinc-400 bg-white/[0.04] border border-white/[0.08] px-2.5 py-0.5 rounded-full font-medium">
                    {collection.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="bg-white/5 border border-white/10 text-white/70 text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                    {user ? `${sagaWatched} of ${sagaReleased.length} Watched` : `${sagaReleased.length} Released`}
                    {sagaRuntime > 0 && (
                      <>
                        <span aria-hidden="true">•</span>
                        {formatRuntime(sagaRuntime)} Total Runtime
                      </>
                    )}
                  </span>
                  {user && sagaNext && (
                    <Link
                      href={`/media/external/MOVIE/${sagaNext.part.id}`}
                      title={`Next unwatched: ${sagaNext.part.title}`}
                      className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/40 px-3 py-1 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                      <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                      Marathon Next
                    </Link>
                  )}
                </div>
              </div>

              {/* Saga track: posters with release-gap bridges between them, and a progress rail below.
                  Rail segments glow emerald where both neighbouring films are watched, dashed otherwise. */}
              <ShelfRail step={440} label="franchise" className="py-3 snap-x snap-mandatory">
                {saga.flatMap((entry, i) => {
                  const { part, upcoming, watched, runtime, status } = entry;
                  const isCurrent = String(part.id) === String(mediaItem.externalId);
                  const partPoster = sanitizeImageUrl(part.poster_path);
                  const partYear = part.release_date ? part.release_date.slice(0, 4) : "TBA";
                  const cfg = VERDICT_CONFIG[voteToVerdict(part.vote_average)];
                  const prev = saga[i - 1];
                  const next = saga[i + 1];
                  const segment = (laser: boolean, cls: string) =>
                    laser ? (
                      <span className={`absolute top-1/2 -translate-y-1/2 h-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.6)] ${cls}`} />
                    ) : (
                      <span className={`absolute top-1/2 -translate-y-1/2 border-t-2 border-dashed border-white/20 ${cls}`} />
                    );
                  const statusLabel =
                    status === "In Production" ? "Filming" : status === "Post Production" ? "Post-production" : status || "Upcoming";
                  const expected = part.release_date
                    ? new Date(`${part.release_date}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
                    : "TBA";

                  const card = (
                    <li key={part.id} className="w-44 sm:w-48 flex-shrink-0 snap-start">
                      <Link
                        href={`/media/external/MOVIE/${part.id}`}
                        aria-current={isCurrent ? "page" : undefined}
                        className={`block group ${isCurrent ? "pointer-events-none" : ""}`}
                      >
                        <PosterImage
                          url={partPoster}
                          title={part.title || "Franchise Entry"}
                          mediaType="MOVIE"
                          releaseYear={partYear}
                          className={
                            isCurrent
                              ? "border-purple-500/60 ring-1 ring-purple-500/60 shadow-[0_0_24px_-4px_rgba(168,85,247,0.35)]"
                              : "border-white/10 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:border-purple-500/50 motion-reduce:group-hover:translate-y-0"
                          }
                        >
                          {upcoming ? (
                            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md border border-violet-400/60 bg-black/50 backdrop-blur-md text-[9px] font-semibold text-violet-300 z-10 pointer-events-none">
                              Upcoming
                            </div>
                          ) : (
                            (part.vote_count ?? 0) > 0 && (
                              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10 flex items-center gap-1 shadow z-10 pointer-events-none">
                                <span className={`text-[9px] font-semibold leading-none ${cfg.textClass}`}>{cfg.label}</span>
                              </div>
                            )
                          )}
                        </PosterImage>

                        {/* Rail: this card's halves meet the bridges on either side */}
                        <div className="relative h-5 mt-4 flex items-center justify-center" aria-hidden="true">
                          {prev && segment(prev.watched && watched, "left-0 right-1/2")}
                          {next && segment(watched && next.watched, "left-1/2 right-0")}
                          {watched ? (
                            <span className="relative z-[1] w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.7)]">
                              <Check className="w-2.5 h-2.5" strokeWidth={3} />
                            </span>
                          ) : upcoming ? (
                            <span className="relative z-[1] w-4 h-4 flex items-center justify-center">
                              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-40" />
                              <span className="relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-purple-400 bg-[#08080a]" />
                            </span>
                          ) : isCurrent ? (
                            <span className="relative z-[1] w-4 h-4 rounded-full bg-purple-500 ring-4 ring-purple-500/25 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
                          ) : (
                            <span className="relative z-[1] w-3 h-3 rounded-full bg-zinc-500 group-hover:bg-zinc-300 transition-colors" />
                          )}
                        </div>

                        <div className="mt-2 text-center space-y-0.5">
                          <p className={`text-sm font-semibold truncate leading-snug ${isCurrent ? "text-purple-300" : "text-white/90 group-hover:text-violet-300"}`}>
                            {part.title}
                          </p>
                          {upcoming ? (
                            <p className="text-xs text-purple-400 font-medium">
                              Expected {expected} • {statusLabel}
                            </p>
                          ) : (
                            <p className="text-xs text-white/50">
                              {[partYear, runtime ? formatRuntime(runtime) : null].filter(Boolean).join(" • ")}
                            </p>
                          )}
                          {watched && <span className="sr-only">Watched</span>}
                        </div>
                      </Link>
                    </li>
                  );

                  if (!next) return [card];

                  // Bridge: years between this release and the next (TMDB has no in-universe timeline)
                  const thisYear = part.release_date ? Number(part.release_date.slice(0, 4)) : null;
                  const nextYear = next.part.release_date ? Number(next.part.release_date.slice(0, 4)) : null;
                  const gap = thisYear !== null && nextYear !== null ? nextYear - thisYear : null;
                  const bridge = (
                    <li key={`gap-${part.id}`} className="w-24 sm:w-28 flex-shrink-0 flex flex-col" aria-hidden="true">
                      <div className="h-[264px] sm:h-[288px] flex items-center justify-center">
                        <div className="flex flex-col items-center justify-center px-2.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md shadow-sm">
                          <span className="text-[10px] font-mono tracking-wider text-purple-300 font-semibold uppercase">
                            {gap === null ? "TBA" : gap === 0 ? "Same yr" : `+${gap} ${gap === 1 ? "Yr" : "Yrs"}`}
                          </span>
                          <span className="flex items-center gap-1 text-[9px] text-white/50">
                            later <span className="text-purple-400">→</span>
                          </span>
                        </div>
                      </div>
                      <div className="relative h-5 mt-4">{segment(watched && next.watched, "left-0 right-0")}</div>
                    </li>
                  );
                  return [card, bridge];
                })}
              </ShelfRail>
            </section>
          )}

          {/* ── Shelf 2: "More Like This" Recommendations ── */}
          {recommendations.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-violet-400" aria-hidden="true" />
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    More Like This
                  </h2>
                </div>
                <span className="text-xs text-zinc-500">
                  Recommended for You
                </span>
              </div>

              {/* Horizontal Shelf: chevrons step about two cards (2 × 180px) */}
              <ShelfRail step={360} label="recommendations" className="gap-4 py-2 snap-x snap-mandatory">
                {recommendations.filter((rec) => !franchiseIds.has(rec.id)).slice(0, 10).map((rec) => {
                  const recPoster = sanitizeImageUrl(rec.poster_path);
                  const recTitle = rec.title || rec.name || "Untitled";
                  const recYear =
                    (rec.release_date || rec.first_air_date || "").slice(0, 4) ||
                    "TBA";
                  const recVerdict = voteToVerdict(rec.vote_average);
                  const cfg = VERDICT_CONFIG[recVerdict];
                  const recType =
                    rec.media_type === "tv" ? "SERIES" : "MOVIE";

                  return (
                    <li key={rec.id} className="w-[160px] sm:w-[180px] flex-shrink-0 snap-start">
                    <Link
                      href={`/media/external/${recType}/${rec.id}`}
                      className="block group"
                    >
                      <PosterImage
                        url={recPoster}
                        title={recTitle}
                        mediaType={recType}
                        releaseYear={recYear}
                        className="border-white/10 group-hover:border-white/20 transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:group-hover:translate-y-0"
                      >
                        {/* Verdict Chip: only once there are votes */}
                        {(rec.vote_count ?? 0) > 0 && (
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10 flex items-center gap-1 shadow z-10 pointer-events-none">
                          <span
                            className={`text-[9px] font-semibold leading-none ${cfg.textClass}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        )}
                      </PosterImage>

                      <div className="mt-2 space-y-0.5">
                        <p className="text-sm font-semibold text-white truncate leading-snug group-hover:text-violet-400 transition-colors">
                          {recTitle}
                        </p>
                        <p className="text-xs text-zinc-500">{recYear}</p>
                      </div>
                    </Link>
                    </li>
                  );
                })}
              </ShelfRail>
            </section>
          )}

        {/* ── Community Verdicts / Reviews Section ── */}
        <section className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-violet-400" aria-hidden="true" />
                Community Verdicts ({reviews.length})
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Honest ratings and reviews from Verdikt members
              </p>
            </div>

            {!isUnreleased && (
            <button
              type="button"
              onClick={openVerdict}
              className="shrink-0 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {myReview ? "Edit Your Verdict" : "+ Write a Verdict"}
            </button>
            )}
          </div>

          {/* How members split across the four verdicts */}
          {reviews.length > 0 && (
            <div>
              <div
                className="flex h-2 rounded-full overflow-hidden bg-white/[0.06]"
                role="img"
                aria-label={(["PERFECTION", "GO_FOR_IT", "TIMEPASS", "SKIP_IT"] as Verdict[])
                  .map((v) => `${VERDICT_CONFIG[v].label} ${reviews.filter((r) => r.verdict === v).length}`)
                  .join(", ")}
              >
                {(["PERFECTION", "GO_FOR_IT", "TIMEPASS", "SKIP_IT"] as Verdict[]).map((v) => {
                  const n = reviews.filter((r) => r.verdict === v).length;
                  return n > 0 ? (
                    <span key={v} style={{ width: `${(n / reviews.length) * 100}%`, backgroundColor: VERDICT_CONFIG[v].color }} />
                  ) : null;
                })}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400" aria-hidden="true">
                {(["PERFECTION", "GO_FOR_IT", "TIMEPASS", "SKIP_IT"] as Verdict[]).map((v) => {
                  const n = reviews.filter((r) => r.verdict === v).length;
                  return (
                    <li key={v} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: VERDICT_CONFIG[v].color }} />
                      {VERDICT_CONFIG[v].label} {Math.round((n / reviews.length) * 100)}%
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Sentiment filter: only worth it once there are more than three reviews */}
          {reviews.length > 3 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter verdicts">
              {[
                { value: "ALL" as const, label: "All", count: reviews.length },
                ...(["PERFECTION", "GO_FOR_IT", "TIMEPASS", "SKIP_IT"] as Verdict[])
                  .map((v) => ({ value: v, label: VERDICT_CONFIG[v].label, count: reviews.filter((r) => r.verdict === v).length }))
                  .filter((o) => o.count > 0),
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={verdictFilter === o.value}
                  onClick={() => setVerdictFilter(o.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                    verdictFilter === o.value
                      ? "bg-white text-black border-white"
                      : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
                  }`}
                >
                  {o.label} ({o.count})
                </button>
              ))}
            </div>
          )}

          {isUnreleased ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-8 text-center">
              <CalendarClock className="w-8 h-8 text-zinc-500 mx-auto mb-3" aria-hidden="true" />
              <p className="text-white font-semibold">Verdicts open on release</p>
              <p className="mt-1 text-sm text-zinc-400">
                {mediaItem.title} releases on {releaseDate}. Come back then to share yours.
              </p>
            </div>
          ) : (
            composerOpen &&
            user && (
              <>
                {reviews.length === 0 && (
                  <p className="text-sm text-zinc-400">No verdicts yet. Be the first to share yours.</p>
                )}
                {/* Inline composer for signed-in members who haven't reviewed this title yet */}
                <ReviewComposer id="review-composer" mediaItem={mediaItem} user={user} onSaved={reloadReviews} />
              </>
            )
          )}

          {orderedReviews.length > 0 ? (
            <div>
              {orderedReviews.filter((rev) => verdictFilter === "ALL" || rev.verdict === verdictFilter).map((rev) =>
                rev.id === editingReviewId && user ? (
                  <div key={rev.id} id={`review-${rev.id}`} className="mb-4 scroll-mt-28">
                    <ReviewComposer
                      mediaItem={mediaItem}
                      user={user}
                      review={rev}
                      // The upsert response carries fresh like/comment counts, so the remounted card starts current
                      onSaved={(saved) => {
                        setReviews((list) => list.map((r) => (r.id === saved.id ? saved : r)));
                        setEditingReviewId(null);
                      }}
                      onCancel={() => setEditingReviewId(null)}
                    />
                  </div>
                ) : (
                  <ReviewCard
                    key={rev.id}
                    review={rev}
                    onEdit={() => setEditingReviewId(rev.id)}
                    onDelete={() => setDeleteTarget(rev)}
                    onShareCard={() => setShareTarget(rev)}
                    onShareStory={() => shareStory(rev)}
                  />
                )
              )}
            </div>
          ) : user || isUnreleased ? null : (
            <div className="text-center py-12 bg-zinc-900/30 rounded-2xl border border-white/[0.06]">
              <Sparkles className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">
                No verdicts submitted yet
              </h3>
              <p className="text-xs text-zinc-400 mt-1 mb-4">
                Be the first to share your verdict on {mediaItem.title}!
              </p>
              <GlassButton
                variant="primary"
                icon={<PlusCircle className="w-4 h-4" />}
                onClick={() => requireAuth(() => setReviewModalOpen(true))}
              >
                Write First Verdict
              </GlassButton>
            </div>
          )}
        </section>

        {/* ── External reviews (TMDB) — hidden when empty ── */}
        <ExternalReviews mediaId={mediaItem.id} />
      </div>
    </div>

      {/* Modals */}
      <TrailerModal
        isOpen={trailerModalOpen}
        onClose={() => setTrailerModalOpen(false)}
        trailerUrl={mediaItem.trailerUrl}
        title={mediaItem.title}
      />

      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        mediaItem={mediaItem}
        onSuccess={reloadReviews}
      />

      <DeleteReviewDialog
        open={!!deleteTarget}
        deleting={false}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* shortcut: this sheet's changes don't reach the Collections button's copy of the state until reload; lift MediaActions state if that matters */}
      {user && heroSheetState && (
        <CollectionsSheet
          open
          onClose={() => setHeroSheetState(null)}
          onCollectionsChange={onCollectionsChange}
          mediaId={mediaItem.id}
          mediaTitle={mediaItem.title}
          watched={heroSheetState.watched}
          collectionIds={heroSheetState.collectionIds}
        />
      )}

      {shareTarget && (
        <ShareCardModal review={shareTarget} mediaItem={mediaItem} onClose={() => setShareTarget(null)} />
      )}
    </div>
  );
}
