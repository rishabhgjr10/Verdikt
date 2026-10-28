"use client";

import React, { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Popcorn, Sparkles, ThumbsUp, X, XCircle } from "lucide-react";
import { MediaItem, ReviewWithRelations, Verdict } from "@/types/media";
import { useToast } from "@/context/ToastContext";
import { verdictOption } from "./verdicts";

const TYPE_LABELS: Record<string, string> = { MOVIE: "Movie", SERIES: "Series", ANIME: "Anime", GAME: "Game", BOOK: "Book" };

// Story card is a fixed 9:16 box; the panel's blurred backdrop is positioned in these coordinates
const CARD_W = 320;
const CARD_H = Math.round((CARD_W * 16) / 9);
const PANEL_INSET = 16; // mx-4 / mb-4

// Outline pill in the verdict's colour. Go For It carries the thumbs-up, so Timepass uses popcorn
const VERDICT_OUTLINE: Record<Verdict, { className: string; icon: React.ElementType }> = {
  PERFECTION: { className: "border-purple-500 text-purple-400", icon: Sparkles },
  GO_FOR_IT: { className: "border-emerald-500 text-emerald-400", icon: ThumbsUp },
  TIMEPASS: { className: "border-amber-500 text-amber-400", icon: Popcorn },
  SKIP_IT: { className: "border-rose-500 text-rose-400", icon: XCircle },
};

/** TMDB w500 posters look soft at 3x export; ask for w780 when the URL allows it. */
const hiResPoster = (url: string | null | undefined) => url?.replace("/t/p/w500/", "/t/p/w780/") ?? null;

// 1x1 transparent PNG, used when a cross-origin image refuses to be embedded in the export
const BLANK_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/**
 * Export needs CORS-readable images. The page already loaded the same poster without CORS, and the
 * browser would reuse that cached (header-less) copy, so a distinct URL forces a fresh CORS fetch.
 */
const corsUrl = (url: string | null | undefined) => {
  if (!url) return null;
  const secure = url.replace(/^http:\/\//, "https://");
  return `${secure}${secure.includes("?") ? "&" : "?"}cors=1`;
};

export function ShareCardModal({
  review,
  mediaItem,
  onClose,
}: {
  review: ReviewWithRelations;
  mediaItem: MediaItem;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const verdict = verdictOption(review.verdict);
  const poster = corsUrl(hiResPoster(mediaItem.coverImage));
  const avatar = corsUrl(review.user?.avatarUrl);
  const VerdictIcon = VERDICT_OUTLINE[review.verdict].icon;
  // e.g. "Movie • 2026 • Reviewed 28 Oct 2026"
  const subtitle = [
    TYPE_LABELS[mediaItem.mediaType] ?? mediaItem.mediaType,
    mediaItem.releaseYear,
    review.createdAt &&
      `Reviewed ${new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
  ].filter(Boolean);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      // The clone keeps the computed mx-auto margin, which would shift the card and clip its right edge
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3, imagePlaceholder: BLANK_PNG, style: { margin: "0" } });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `verdikt-${mediaItem.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
      a.click();
    } catch {
      showToast("Couldn't create the image", { tone: "error", detail: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      // my-auto (not items-center) keeps the header reachable by scrolling on short viewports
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-card-title"
        className="my-auto w-full max-w-sm bg-zinc-950/75 backdrop-blur-2xl saturate-150 border border-white/[0.12] shadow-[0_24px_48px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id="share-card-title" className="text-lg font-semibold text-white">
            Share Your Review
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -mr-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Exportable card */}
        <div
          ref={cardRef}
          style={{ width: CARD_W, height: CARD_H }}
          // Dark fallback shows only when there is no poster
          className={`relative flex flex-col overflow-hidden mx-auto rounded-3xl border border-white/10 ${poster ? "" : "bg-zinc-900"}`}
        >
          {/* z-0 full-bleed poster, z-10 soft scrim, z-20 glass panel */}
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="Poster" crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover z-0" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10 z-10" />

          {/* backdrop-blur shows in the preview but html-to-image drops it from the PNG, so the panel also carries
              a blurred copy of the poster pinned to the card's coordinates; preview and export then match. */}
          <div className="relative z-20 mt-auto mx-4 mb-4 p-5 bg-zinc-950/40 backdrop-blur-xl border border-white/[0.15] shadow-2xl rounded-2xl flex flex-col overflow-hidden">
            {poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt=""
                aria-hidden="true"
                crossOrigin="anonymous"
                // Inside the card's 1px border, offset by the panel inset plus the panel's own 1px border
                style={{ width: CARD_W - 2, height: CARD_H - 2, left: -(PANEL_INSET + 1), bottom: -(PANEL_INSET + 1) }}
                className="absolute max-w-none object-cover blur-xl -z-10"
              />
            )}
            {/* Same tint as the panel's own bg (scrim + zinc-950/40) so colours still bleed through */}
            <div className="absolute inset-0 bg-zinc-950/50 -z-10" />

            <p className="text-3xl font-serif font-bold text-white leading-tight mb-1 line-clamp-2 break-words">{mediaItem.title}</p>
            {/* Each part stays whole, so a long line wraps at a bullet rather than inside the date */}
            <p className="text-[10px] text-zinc-300 font-medium tracking-widest mb-4 uppercase">
              {subtitle.map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 && " • "}
                  <span className="whitespace-nowrap">{part}</span>
                </React.Fragment>
              ))}
            </p>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-widest mb-5 w-max ${VERDICT_OUTLINE[review.verdict].className}`}
            >
              <VerdictIcon className="w-3.5 h-3.5" aria-hidden="true" />
              {verdict.label}
            </span>

            {/* Spoilers never go into an image, since there is no way to hide them there */}
            <div className="relative">
              <span
                aria-hidden="true"
                className="absolute -top-6 -left-3 text-7xl font-serif text-white/[0.07] pointer-events-none select-none"
              >
                &ldquo;
              </span>
              <p className="relative z-10 text-sm font-serif text-zinc-200 leading-relaxed line-clamp-4 mb-5 whitespace-pre-line break-words">
                {review.containsSpoilers ? "Contains spoilers. Read the full review on Verdikt." : review.content}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.15] pt-3">
              <div className="flex items-center gap-2 min-w-0">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" crossOrigin="anonymous" className="w-6 h-6 rounded-full object-cover bg-zinc-800 shrink-0" />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-zinc-800 shrink-0" />
                )}
                <span className="text-xs font-semibold text-white truncate">@{review.user?.username ?? "verdikt"}</span>
              </div>
              <p className="text-sm font-black text-white tracking-tighter shrink-0">VERDIKT.</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full bg-white text-black font-semibold py-3 rounded-xl mt-6 hover:bg-zinc-200 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          {saving ? "Preparing…" : "Save Image"}
        </button>
      </div>
    </div>
  );
}
