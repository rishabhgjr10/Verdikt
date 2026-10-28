"use client";

import React, { useEffect, useState, use } from "react";
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
import { MediaItem, ReviewWithRelations, Verdict } from "@/types/media";
import { mediaApi, reviewApi } from "@/lib/api";
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
  fetchTmdbMovieDetails,
  fetchTmdbCollection,
  fetchTmdbRecommendations,
  fetchTmdbWatchProvidersIN,
  TmdbCollection,
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
} from "lucide-react";

/** Converts http:// → https:// (Google Books / insecure CDN links) and builds high-res TMDB URLs */
function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string" || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://")) return trimmed.replace("http://", "https://");
  if (trimmed.startsWith("/")) return `https://image.tmdb.org/t/p/w1280${trimmed}`;
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
  const sources = [local?.src, provider.logo_path && `https://image.tmdb.org/t/p/original${provider.logo_path}`].filter(
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

export default function MediaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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
        const item = await mediaApi.getById(id);
        setMediaItem(item);

        if (item.id) {
          const revs = await reviewApi.getByMediaId(item.id);
          setReviews(revs);
        }

        // Fetch Franchise Collection & Recommendations
        if (item.externalId) {
          const extId = item.externalId;

          // 1. Check for Franchise Collection if Movie
          if (item.mediaType === "MOVIE") {
            const movieDetails = await fetchTmdbMovieDetails(extId);
            if (movieDetails?.belongs_to_collection?.id) {
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
  }, [id]);

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

  // The viewer's own review leads the list
  const myReview = user ? reviews.find((r) => r.user?.id === user.id) : undefined;
  const orderedReviews = myReview ? [myReview, ...reviews.filter((r) => r !== myReview)] : reviews;

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
      {/* Hero Backdrop Layer (seamless 640px behind the navbar; bottom mask fades into the page) */}
      {heroImg && (
        <div
          className="absolute top-0 left-0 right-0 h-[640px] z-0 overflow-hidden pointer-events-none"
          style={{
            maskImage:
              "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
          }}
          aria-hidden="true"
        >
          {/* Subtle dark underlay to soften ambient violet blobs and prevent hard edges */}
          <div className="absolute inset-0 bg-[#09090b]/40" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImg}
            alt=""
            onError={() => setBackdropError(true)}
            className="w-full h-full object-cover blur-3xl scale-125 opacity-50 saturate-150 pointer-events-none"
          />
          {/* Subtle second tint layer of dominant/poster color */}
          <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 via-transparent to-black/30 mix-blend-overlay pointer-events-none" />
          {/* Contrast scrim: darker toward the bottom and behind the text column */}
          <div className="media-hero-scrim" />
        </div>
      )}

      {/* Detail Page Content (relative z-10 with existing pt-28 clearance) */}
      <div className="relative z-10 flex-1 flex flex-col pt-28">
        {/* ── Hero: poster | title, facts, overview | library actions + watch online ── */}
        {/* Same container as the shelves below so the poster lines up with their titles */}
        <div className="max-w-[1400px] w-[calc(100%-48px)] mx-auto px-6 pt-12 pb-12 relative z-10 flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Left: poster only */}
          {/* lg:w-64 until xl: a 320px poster at 1024px squeezes the center column to ~220px */}
          <div className="flex-shrink-0 w-56 lg:w-64 xl:w-80 self-center lg:self-start">
            <div className="aspect-[2/3] rounded-xl shadow-2xl border border-white/10 relative overflow-hidden">
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
          <div className="flex-1 min-w-0 flex flex-col">
            <p className="text-sm text-zinc-400 font-medium flex items-center gap-1.5">
              <TypeIcon className="w-3.5 h-3.5" aria-hidden="true" />
              {[mediaTypeConfig.label, mediaItem.releaseYear].filter(Boolean).join(" • ")}
            </p>

            <h1
              title={mediaItem.title}
              className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight mt-1 mb-4 leading-[1.05] line-clamp-2 break-words"
            >
              {mediaItem.title}
            </h1>

            {/* External ratings (client-side, never blocks the page; empty slot collapses) */}
            <div className="mb-6 empty:hidden">
              <RatingBadges mediaId={mediaItem.id} />
            </div>

            {/* shortcut: MediaItem has no director/country/language/age rating, so only known facts show; add cells when the API returns them */}
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-6">
              {[
                {
                  label: mediaItem.mediaType === "BOOK" ? "Author" : "Created By",
                  value: mediaItem.creatorsJson?.length
                    ? mediaItem.creatorsJson.slice(0, 2).join(", ") +
                      (mediaItem.creatorsJson.length > 2 ? ` +${mediaItem.creatorsJson.length - 2}` : "")
                    : null,
                  title: mediaItem.creatorsJson?.join(", "),
                },
                { label: "Type", value: mediaTypeConfig.label },
                { label: "Released", value: mediaItem.releaseYear },
                { label: "Genre", value: mediaItem.genresJson?.[0] },
              ]
                .filter((f) => f.value)
                .map((f) => (
                  <div key={f.label} className="min-w-0">
                    <dt className="text-zinc-500">{f.label}</dt>
                    <dd className="text-white font-medium truncate" title={f.title}>
                      {f.value}
                    </dd>
                  </div>
                ))}
            </dl>

            {mediaItem.description && (
              <ExpandableDescription text={mediaItem.description} />
            )}

            {mediaItem.genresJson && mediaItem.genresJson.length > 0 && (
              <ul className="flex flex-wrap gap-2 mt-4" aria-label="Genres">
                {mediaItem.genresJson.map((genre, idx) => (
                  <li key={idx} className="media-hero-chip text-xs font-medium">
                    {genre}
                  </li>
                ))}
              </ul>
            )}

            {/* Content actions: verdict + trailer */}
            <div className="flex flex-wrap items-center gap-4 mt-6">
              <GlassButton
                  variant="neutral"
                  size="hero"
                  className="w-full sm:w-auto sm:min-w-[176px]"
                  icon={<PlusCircle />}
                  onClick={() => requireAuth(() => setReviewModalOpen(true))}
                >
                  Write a Verdict
                </GlassButton>

                {mediaItem.mediaType !== "BOOK" && mediaItem.mediaType !== "GAME" && (
                  <GlassButton
                    href={mediaItem.trailerUrl || youtubeTrailerUrl(mediaItem.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="neutral"
                    size="hero"
                    className="w-full sm:w-auto sm:min-w-[176px]"
                    title={mediaItem.trailerUrl ? undefined : "Opens a trailer search on YouTube"}
                    icon={<Play className="fill-current" />}
                  >
                    Watch Trailer
                  </GlassButton>
                )}
            </div>
          </div>

          {/* Right: library actions + watch online */}
          <div className="flex-shrink-0 w-full lg:w-72 flex flex-col gap-3">
            <MediaActions
              mediaId={mediaItem.id}
              mediaTitle={mediaItem.title}
              mediaType={mediaItem.mediaType}
              onUnwatched={() =>
                setReviews((prev) => prev.filter((rev) => rev.user?.id !== user?.id))
              }
            />

            {primaryProviders.length > 0 && (
              <section className="mt-6 bg-zinc-900/40 backdrop-blur-md border border-white/[0.08] rounded-2xl p-4">
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
              <details className="group/other rounded-2xl border border-white/[0.06] px-4 py-2">
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

        {/* ── Main Discovery & Community Content ── */}
        <div className="max-w-[1400px] w-[calc(100%-48px)] mx-auto px-6 py-10 space-y-12">
          {/* ── Shelf 1: Complete Franchise & Sequels ── */}
          {collection && collection.parts && collection.parts.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-violet-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Complete Franchise &amp; Sequels
                  </h2>
                  <span className="text-xs text-zinc-400 bg-white/[0.04] border border-white/[0.08] px-2.5 py-0.5 rounded-full font-medium">
                    {collection.name}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  {collection.parts.length} Chronological Entries
                </span>
              </div>

              {/* Horizontal Shelf */}
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {collection.parts.map((part) => {
                  const isCurrent =
                    String(part.id) === String(mediaItem.externalId);
                  const partPoster = sanitizeImageUrl(part.poster_path);
                  const partYear = part.release_date
                    ? part.release_date.slice(0, 4)
                    : "TBA";
                  const partVerdict = voteToVerdict(part.vote_average);
                  const cfg = VERDICT_CONFIG[partVerdict];

                  return (
                    <Link
                      key={part.id}
                      href={`/media/external/MOVIE/${part.id}`}
                      className={`w-36 sm:w-44 shrink-0 group ${
                        isCurrent ? "pointer-events-none" : ""
                      }`}
                    >
                      <PosterImage
                        url={partPoster}
                        title={part.title || "Franchise Entry"}
                        mediaType="MOVIE"
                        releaseYear={partYear}
                        className={
                          isCurrent
                            ? "border-violet-500 ring-2 ring-violet-500/30"
                            : "border-white/10 group-hover:border-white/20"
                        }
                      >
                        {/* Current Item Indicator */}
                        {isCurrent && (
                          <div className="absolute top-2 left-2 bg-violet-600/95 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow z-10 pointer-events-none">
                            CURRENT
                          </div>
                        )}

                        {/* Overlaid Verdict Chip */}
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10 flex items-center gap-1 shadow z-10 pointer-events-none">
                          <span
                            className={`text-[9px] font-semibold leading-none ${cfg.textClass}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                      </PosterImage>

                      <div className="mt-2 space-y-0.5">
                        <p className="text-sm font-medium text-white truncate leading-snug group-hover:text-violet-400 transition-colors">
                          {part.title}
                        </p>
                        <p className="text-xs text-zinc-500">{partYear}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Shelf 2: "More Like This" Recommendations ── */}
          {recommendations.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    More Like This
                  </h2>
                </div>
                <span className="text-xs text-zinc-500">
                  Recommended for You
                </span>
              </div>

              {/* Horizontal Shelf */}
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {recommendations.slice(0, 10).map((rec) => {
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
                    <Link
                      key={rec.id}
                      href={`/media/external/${recType}/${rec.id}`}
                      className="w-36 sm:w-44 shrink-0 group"
                    >
                      <PosterImage
                        url={recPoster}
                        title={recTitle}
                        mediaType={recType}
                        releaseYear={recYear}
                        className="border-white/10 group-hover:border-white/20"
                      >
                        {/* Verdict Chip */}
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10 flex items-center gap-1 shadow z-10 pointer-events-none">
                          <span
                            className={`text-[9px] font-semibold leading-none ${cfg.textClass}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                      </PosterImage>

                      <div className="mt-2 space-y-0.5">
                        <p className="text-sm font-medium text-white truncate leading-snug group-hover:text-violet-400 transition-colors">
                          {recTitle}
                        </p>
                        <p className="text-xs text-zinc-500">{recYear}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

        {/* ── Community Verdicts / Reviews Section ── */}
        <section className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                Community Verdicts ({reviews.length})
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Honest ratings and reviews from Verdikt members
              </p>
            </div>

            <button
              onClick={() => requireAuth(() => setReviewModalOpen(true))}
              className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
            >
              + Submit Verdict
            </button>
          </div>

          {/* Inline composer for signed-in members who haven't reviewed this title yet */}
          {user && !myReview && (
            <ReviewComposer mediaItem={mediaItem} user={user} onSaved={reloadReviews} />
          )}

          {orderedReviews.length > 0 ? (
            <div>
              {orderedReviews.map((rev) =>
                rev.id === editingReviewId && user ? (
                  <div key={rev.id} className="mb-4">
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
          ) : user ? null : (
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

      {shareTarget && (
        <ShareCardModal review={shareTarget} mediaItem={mediaItem} onClose={() => setShareTarget(null)} />
      )}
    </div>
  );
}
