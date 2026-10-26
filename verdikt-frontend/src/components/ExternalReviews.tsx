"use client";

import React, { useEffect, useState } from "react";
import { ArrowUpRight, MessageSquareQuote, Star } from "lucide-react";
import { externalReviewsApi } from "@/lib/api";
import { ExternalReview } from "@/types/media";

function formatDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * "What others are saying" — TMDB user reviews as plain text (never HTML). Fetched after
 * the main content; the whole section is hidden when there is nothing to show.
 */
export function ExternalReviews({ mediaId }: { mediaId: string }) {
  const [reviews, setReviews] = useState<ExternalReview[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    externalReviewsApi
      .get(mediaId, controller.signal)
      .then(setReviews)
      .catch(() => {
        if (!controller.signal.aborted) setReviews([]);
      });
    return () => controller.abort();
  }, [mediaId]);

  if (reviews !== null && reviews.length === 0) return null;

  return (
    <section className="space-y-5" aria-labelledby="external-reviews-heading" aria-busy={reviews === null || undefined}>
      <div className="pb-3 border-b border-white/[0.06]">
        <h2 id="external-reviews-heading" className="text-lg font-bold text-white flex items-center gap-2">
          <MessageSquareQuote className="w-5 h-5 text-violet-400" aria-hidden="true" />
          What others are saying
        </h2>
        <p className="text-xs text-zinc-400 mt-1">Reviews from TMDB</p>
      </div>

      {reviews === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-48 rounded-3xl bg-white/[0.04] border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((review) => {
            const date = formatDate(review.createdAt);
            return (
              <article
                key={review.url}
                className="glass-surface flex flex-col gap-3 p-5 rounded-3xl bg-zinc-900/40 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_12px_32px_rgba(0,0,0,0.35)]"
              >
                <header className="flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-sm font-bold text-violet-200 shrink-0"
                    aria-hidden="true"
                  >
                    {review.author.charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{review.author}</p>
                    {date && <p className="text-[11px] text-zinc-500">{date}</p>}
                  </div>
                  {review.rating !== null && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 border border-amber-400/25 text-xs font-bold text-amber-300 shrink-0">
                      <Star className="w-3 h-3 fill-amber-300" aria-hidden="true" />
                      {review.rating}/10
                    </span>
                  )}
                </header>
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{review.excerpt}</p>
                <a
                  href={review.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-violet-200 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded self-start"
                >
                  Read full review on TMDB
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ExternalReviews;
