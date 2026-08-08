"use client";

import React, { useEffect, useState, use } from "react";
import { Navbar } from "@/components/Navbar";
import { VerdictBadge } from "@/components/VerdictBadge";
import { TrailerModal } from "@/components/TrailerModal";
import { ReviewModal } from "@/components/ReviewModal";
import { MediaItem, ReviewWithRelations } from "@/types/media";
import { mediaApi, reviewApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getPlatformSearchUrl, getPlatformColor, youtubeTrailerUrl } from "@/lib/streamingUtils";
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
} from "lucide-react";

/** Converts http:// → https:// (Google Books / insecure CDN links) */
function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("http://") ? url.replace("http://", "https://") : url;
}

export default function MediaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();

  const [mediaItem, setMediaItem] = useState<MediaItem | null>(null);
  const [reviews, setReviews] = useState<ReviewWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err: any) {
        console.error("Error loading media details", err);
        setError("Failed to load media details.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id]);

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
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-20 w-full animate-pulse space-y-8">
          <div className="h-72 bg-slate-900 rounded-3xl" />
          <div className="h-40 bg-slate-900 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !mediaItem) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Navbar />
        <div className="max-w-md mx-auto my-20 text-center p-8 bg-slate-900 rounded-2xl border border-slate-800">
          <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-200">Media Title Not Found</h2>
          <p className="mt-2 text-xs text-slate-400">The requested item could not be retrieved.</p>
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />

      {/* Hero Backdrop Section */}
      <div className="relative w-full overflow-hidden bg-slate-950 border-b border-slate-900">
        {sanitizeImageUrl(mediaItem.backdropImage) && !backdropError && (
          <div className="absolute inset-0 z-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sanitizeImageUrl(mediaItem.backdropImage)!}
              alt={mediaItem.title}
              onError={() => setBackdropError(true)}
              className="w-full h-full object-cover opacity-20 filter blur-sm scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
          </div>
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Cover Poster */}
            <div className="w-48 sm:w-56 md:w-64 shrink-0 mx-auto md:mx-0 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-900 aspect-[2/3] relative">
              {sanitizeImageUrl(mediaItem.coverImage) && !posterError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sanitizeImageUrl(mediaItem.coverImage)!}
                  alt={mediaItem.title}
                  onError={() => setPosterError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-slate-600 bg-gradient-to-br from-slate-800 to-slate-900">
                  <TypeIcon className="w-12 h-12 mb-2 opacity-40" />
                  <span className="text-xs font-medium opacity-60">No Cover</span>
                </div>
              )}
            </div>

            {/* Meta Information */}
            <div className="flex-1 space-y-5 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-950/80 text-violet-300 border border-violet-500/40">
                  <TypeIcon className="w-3.5 h-3.5" />
                  {mediaTypeConfig.label}
                </span>

                {mediaItem.releaseYear && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-900/80 text-slate-300 border border-slate-800">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {mediaItem.releaseYear}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight">
                {mediaItem.title}
              </h1>

              {/* Creators & Authors */}
              {mediaItem.creatorsJson && mediaItem.creatorsJson.length > 0 && (
                <p className="text-xs sm:text-sm text-slate-400">
                  <span className="font-semibold text-slate-300">Created by: </span>
                  {mediaItem.creatorsJson.join(", ")}
                </p>
              )}

              {/* Synopsis */}
              {mediaItem.description && (
                <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                  {mediaItem.description}
                </p>
              )}

              {/* Genre Badges */}
              {mediaItem.genresJson && mediaItem.genresJson.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                  {mediaItem.genresJson.map((genre, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Platforms / Where to Watch */}
              <div className="pt-2">
                <span className="text-xs font-semibold text-slate-400 block mb-2 uppercase tracking-wider">
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
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700/60 bg-slate-900/80 text-slate-200 hover:border-purple-500/50 hover:scale-[1.02] hover:bg-slate-800 transition-all shadow-sm group"
                        >
                          {/* Brand-colour initial dot */}
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 ${bg} ${text}`}>
                            {plat.charAt(0).toUpperCase()}
                          </span>
                          {plat}
                          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-purple-400 transition-colors shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Not currently available for direct streaming or digital rent / purchase
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-wrap items-center justify-center md:justify-start gap-3">
                {/* Watch Trailer — always shown for Movies, Series, Anime;
                    uses trailerUrl if present, otherwise YouTube search fallback */}
                {mediaItem.mediaType !== "BOOK" && mediaItem.mediaType !== "GAME" && (
                  <a
                    href={mediaItem.trailerUrl || youtubeTrailerUrl(mediaItem.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-slate-900 border border-slate-700 hover:bg-slate-800 hover:border-violet-500/50 transition-all shadow-lg"
                  >
                    <Play className="w-4 h-4 text-violet-400 fill-violet-400" />
                    Watch Trailer
                    {!mediaItem.trailerUrl && (
                      <span className="text-[10px] text-slate-500 font-normal">(YouTube)</span>
                    )}
                  </a>
                )}

                <button
                  onClick={() => setReviewModalOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-600/30 transition-all"
                >
                  <PlusCircle className="w-5 h-5" />
                  Write a Verdict
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Community Verdicts / Reviews Section */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-900">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              Community Verdicts ({reviews.length})
            </h2>
            <p className="text-xs text-slate-400 mt-1">Honest ratings and reviews from Verdikt members</p>
          </div>

          <button
            onClick={() => setReviewModalOpen(true)}
            className="text-xs font-semibold text-violet-400 hover:text-violet-300"
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
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-3"
                >
                  {/* Author Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                        {rev.user?.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={rev.user.avatarUrl} alt={rev.user.username} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-200 block">
                          {rev.user?.username || "Verdikt Member"}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : "Recently"}
                        </span>
                      </div>
                    </div>

                    <VerdictBadge verdict={rev.verdict} size="md" />
                  </div>

                  {/* Review Content with Spoiler Blur */}
                  <div className="relative pt-1">
                    {isSpoiler && !isRevealed ? (
                      <div className="relative p-4 rounded-xl bg-slate-950/80 border border-amber-900/50 text-center">
                        <p className="text-sm text-slate-500 filter blur-sm select-none">
                          {rev.content}
                        </p>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button
                            onClick={() => toggleSpoiler(rev.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800/80 shadow-md hover:bg-amber-900 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Warning: Spoiler — Click to Reveal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{rev.content}</p>
                        {isSpoiler && (
                          <button
                            onClick={() => toggleSpoiler(rev.id)}
                            className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-400"
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
          <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800">
            <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-300">No verdicts submitted yet</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">Be the first to share your verdict on {mediaItem.title}!</p>
            <button
              onClick={() => setReviewModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white"
            >
              Write First Verdict
            </button>
          </div>
        )}
      </main>

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
