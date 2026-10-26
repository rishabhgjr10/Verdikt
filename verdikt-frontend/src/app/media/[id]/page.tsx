"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { MediaDetailSkeleton } from "@/components/MediaDetailSkeleton";
import { VerdictBadge } from "@/components/VerdictBadge";
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
import { CreatorsFact, ExpandableDescription } from "@/components/MediaHeroDetails";
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
  TmdbCollection,
  TmdbItem,
  voteToVerdict,
} from "@/lib/tmdb";
import {
  Play,
  PlusCircle,
  Calendar,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  Sparkles,
  Eye,
  EyeOff,
  User as UserIcon,
  Clock,
  ExternalLink,
  Layers,
} from "lucide-react";

/** Converts http:// → https:// (Google Books / insecure CDN links) and builds high-res TMDB URLs */
function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string" || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://")) return trimmed.replace("http://", "https://");
  if (trimmed.startsWith("/")) return `https://image.tmdb.org/t/p/w1280${trimmed}`;
  return trimmed;
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

  const [trailerModalOpen, setTrailerModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
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
    if (mediaItem?.mediaType) {
      setActiveCategory(mediaItem.mediaType as NavMediaCategory);
    }
    return () => {
      setActiveCategory(null);
    };
  }, [mediaItem?.mediaType, setActiveCategory]);

  const toggleSpoiler = (reviewId: string) => {
    setRevealedSpoilers((prev) => ({ ...prev, [reviewId]: !prev[reviewId] }));
  };

  const reloadReviews = async () => {
    if (mediaItem?.id) {
      const revs = await reviewApi.getByMediaId(mediaItem.id);
      setReviews(revs);
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
        {/* ── Hero: poster + library actions | details + content actions ── */}
        <div className="media-hero-container pt-8 pb-12 lg:pt-12">
          <div className="media-hero-grid">
            <div className="media-hero-left">
              <div className="media-hero-poster">
                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                  <PosterImage
                    url={mediaItem.coverImage}
                    title={mediaItem.title}
                    mediaType={mediaItem.mediaType}
                    releaseYear={mediaItem.releaseYear}
                    className="border-0 rounded-none"
                  />
                </div>
              </div>

              {/* Library actions: Watched / Watch Later / Collections (same width as the poster) */}
              <div className="media-hero-library">
                <MediaActions
                  mediaId={mediaItem.id}
                  mediaTitle={mediaItem.title}
                  mediaType={mediaItem.mediaType}
                  onUnwatched={() =>
                    setReviews((prev) => prev.filter((rev) => rev.user?.id !== user?.id))
                  }
                />
              </div>
            </div>

            <div className="media-hero-right">
              {/* Title block */}
              <div className="media-hero-head">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="media-hero-chip media-hero-chip--type text-xs font-semibold">
                    <TypeIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    {mediaTypeConfig.label}
                  </span>
                  {mediaItem.releaseYear && (
                    <span className="media-hero-chip text-xs font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-zinc-300" aria-hidden="true" />
                      {mediaItem.releaseYear}
                    </span>
                  )}
                </div>

                <h1
                  data-rhythm="title"
                  title={mediaItem.title}
                  className="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.05] text-white line-clamp-2 break-words"
                >
                  {mediaItem.title}
                </h1>
              </div>

              {/* Details */}
              <div className="media-hero-details">
                {/* External ratings (client-side, never blocks the page; empty slot collapses) */}
                <div data-rhythm="ratings">
                  <RatingBadges mediaId={mediaItem.id} />
                </div>

                {mediaItem.creatorsJson && mediaItem.creatorsJson.length > 0 && (
                  <CreatorsFact data-rhythm="facts" creators={mediaItem.creatorsJson} />
                )}

                {mediaItem.description && (
                  <ExpandableDescription data-rhythm="description" text={mediaItem.description} />
                )}

                {mediaItem.genresJson && mediaItem.genresJson.length > 0 && (
                  <ul data-rhythm="genres" className="flex flex-wrap gap-2" aria-label="Genres">
                    {mediaItem.genresJson.map((genre, idx) => (
                      <li key={idx} className="media-hero-chip text-xs font-medium">
                        {genre}
                      </li>
                    ))}
                  </ul>
                )}

                {mediaItem.platformsJson && mediaItem.platformsJson.length > 0 && (
                  <div data-rhythm="platforms">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Available on
                    </h2>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {mediaItem.platformsJson.map((plat, idx) => {
                        const { bg, text } = getPlatformColor(plat);
                        const url = getPlatformSearchUrl(plat, mediaItem.title);
                        return (
                          <li key={idx}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="media-hero-chip media-hero-chip--link media-hero-chip--platform gap-2 text-sm font-medium group outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            >
                              <span
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${bg} ${text}`}
                                aria-hidden="true"
                              >
                                {plat.charAt(0).toUpperCase()}
                              </span>
                              {plat}
                              <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0" aria-hidden="true" />
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/* Content actions: one matched pair on the text column's left edge */}
              <div data-rhythm="actions" className="media-hero-content-actions flex flex-col sm:flex-row sm:flex-wrap gap-3">
                <GlassButton
                  variant="neutral"
                  size="hero"
                  className="w-full sm:w-auto sm:min-w-[176px]"
                  icon={<PlusCircle className="text-violet-300" />}
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
                    icon={<Play className="text-violet-300 fill-violet-300" />}
                  >
                    Watch Trailer
                  </GlassButton>
                )}
              </div>
            </div>
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

          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((rev) => {
                const isSpoiler = rev.containsSpoilers;
                const isRevealed = revealedSpoilers[rev.id];

                return (
                  <div
                    key={rev.id}
                    className="p-5 rounded-2xl bg-zinc-900/60 border border-white/[0.08] shadow-md space-y-3"
                  >
                    {/* Author Header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden">
                          {rev.user?.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={rev.user.avatarUrl}
                              alt={rev.user.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <UserIcon className="w-5 h-5 text-zinc-400" />
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-white block">
                            {rev.user?.username || "Verdikt Member"}
                          </span>
                          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {rev.createdAt
                              ? new Date(rev.createdAt).toLocaleDateString()
                              : "Recently"}
                          </span>
                        </div>
                      </div>

                      <VerdictBadge verdict={rev.verdict} size="md" />
                    </div>

                    {/* Review Content with Spoiler Blur */}
                    <div className="relative pt-1">
                      {isSpoiler && !isRevealed ? (
                        <div className="relative p-4 rounded-xl bg-black/60 border border-amber-900/50 text-center">
                          <p className="text-sm text-zinc-500 filter blur-sm select-none">
                            {rev.content}
                          </p>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <button
                              onClick={() => toggleSpoiler(rev.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-md hover:bg-amber-900 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Warning: Spoiler — Click to Reveal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                            {rev.content}
                          </p>
                          {isSpoiler && (
                            <button
                              onClick={() => toggleSpoiler(rev.id)}
                              className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-400 cursor-pointer"
                            >
                              <EyeOff className="w-3 h-3" />
                              Hide Spoiler
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
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
    </div>
  );
}
