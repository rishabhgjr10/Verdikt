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
      {/* Hero Backdrop Layer (FIX 1 - Seamless 640px Behind Navbar with Zero Offset) */}
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
        </div>
      )}

      {/* Detail Page Content (relative z-10 with existing pt-28 clearance) */}
      <div className="relative z-10 flex-1 flex flex-col pt-28">
        {/* Hero Meta Header */}
        <div className="max-w-[1400px] w-[calc(100%-48px)] mx-auto px-6 py-10 md:py-16">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Cover Poster with Shared PosterImage */}
            <div className="w-48 sm:w-56 md:w-64 shrink-0 mx-auto md:mx-0 shadow-2xl">
              <PosterImage
                url={mediaItem.coverImage}
                title={mediaItem.title}
                mediaType={mediaItem.mediaType}
                releaseYear={mediaItem.releaseYear}
                className="shadow-2xl border-white/15"
              />
            </div>

            {/* Meta Information */}
            <div className="flex-1 space-y-5 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40">
                  <TypeIcon className="w-3.5 h-3.5" />
                  {mediaTypeConfig.label}
                </span>

                {mediaItem.releaseYear && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-zinc-900/80 text-zinc-300 border border-white/10">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    {mediaItem.releaseYear}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                {mediaItem.title}
              </h1>

              {/* Creators & Authors */}
              {mediaItem.creatorsJson && mediaItem.creatorsJson.length > 0 && (
                <p className="text-xs sm:text-sm text-zinc-400">
                  <span className="font-semibold text-zinc-300">Created by: </span>
                  {mediaItem.creatorsJson.join(", ")}
                </p>
              )}

              {/* Synopsis */}
              {mediaItem.description && (
                <p className="text-sm text-zinc-300 leading-relaxed max-w-3xl">
                  {mediaItem.description}
                </p>
              )}

              {/* Genre Badges */}
              {mediaItem.genresJson && mediaItem.genresJson.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                  {mediaItem.genresJson.map((genre, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-900 text-zinc-300 border border-white/10"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Platforms / Where to Watch */}
              <div className="pt-2">
                <span className="text-xs font-semibold text-zinc-400 block mb-2 uppercase tracking-wider">
                  Available On / Platforms
                </span>
                {mediaItem.platformsJson && mediaItem.platformsJson.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    {mediaItem.platformsJson.map((plat, idx) => {
                      const { bg, text } = getPlatformColor(plat);
                      const url = getPlatformSearchUrl(plat, mediaItem.title);
                      return (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-zinc-900/80 text-zinc-200 hover:border-purple-500/50 hover:scale-[1.02] hover:bg-zinc-800 transition-all shadow-sm group"
                        >
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 ${bg} ${text}`}
                          >
                            {plat.charAt(0).toUpperCase()}
                          </span>
                          {plat}
                          <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-purple-400 transition-colors shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">
                    Not currently available for direct streaming or digital rent / purchase
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-wrap items-center justify-center md:justify-start gap-3">
                {mediaItem.mediaType !== "BOOK" && mediaItem.mediaType !== "GAME" && (
                  <a
                    href={
                      mediaItem.trailerUrl || youtubeTrailerUrl(mediaItem.title)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-zinc-900 border border-white/10 hover:bg-zinc-800 hover:border-violet-500/50 transition-all shadow-lg"
                  >
                    <Play className="w-4 h-4 text-violet-400 fill-violet-400" />
                    Watch Trailer
                    {!mediaItem.trailerUrl && (
                      <span className="text-[10px] text-zinc-500 font-normal">
                        (YouTube)
                      </span>
                    )}
                  </a>
                )}

                <button
                  onClick={() => setReviewModalOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-600/30 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-5 h-5" />
                  Write a Verdict
                </button>
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
              onClick={() => setReviewModalOpen(true)}
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
              <button
                onClick={() => setReviewModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors cursor-pointer"
              >
                Write First Verdict
              </button>
            </div>
          )}
        </section>
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
