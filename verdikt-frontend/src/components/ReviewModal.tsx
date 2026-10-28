"use client";

import React, { useState } from "react";
import { MediaItem, Verdict } from "@/types/media";
import { reviewApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { X, Sparkles, AlertCircle, ShieldAlert, CheckCircle2, ThumbsUp, XCircle } from "lucide-react";

// Same labels and icons as VerdictBadge; each verdict glows in its own colour when selected
const VERDICT_PILLS: Record<Verdict, { label: string; icon: React.ElementType; active: string }> = {
  PERFECTION: {
    label: "Perfection",
    icon: Sparkles,
    active:
      "bg-purple-500/20 border-purple-500/60 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  },
  GO_FOR_IT: {
    label: "Go For It",
    icon: CheckCircle2,
    active:
      "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  },
  TIMEPASS: {
    label: "Timepass",
    icon: ThumbsUp,
    active:
      "bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  },
  SKIP_IT: {
    label: "Skip",
    icon: XCircle,
    active:
      "bg-rose-500/20 border-rose-500/60 text-rose-300 shadow-[0_0_20px_rgba(225,29,72,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  },
};

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItem: MediaItem;
  onSuccess?: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  mediaItem,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [selectedVerdict, setSelectedVerdict] = useState<Verdict>("GO_FOR_IT");
  const [content, setContent] = useState("");
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to post a verdict.");
      return;
    }
    if (!content.trim()) {
      setError("Please write a review before submitting.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await reviewApi.create({
        mediaItemId: mediaItem.id,
        verdict: selectedVerdict,
        content: content.trim(),
        containsSpoilers,
        mediaDetails: mediaItem,
      });

      setContent("");
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Failed to submit review", err);
      setError(err.response?.data?.message || "Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const verdictOptions: Verdict[] = ["PERFECTION", "GO_FOR_IT", "TIMEPASS", "SKIP_IT"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verdict-modal-title"
    >
      <div className="relative w-full max-w-lg p-6 rounded-2xl bg-zinc-950/75 backdrop-blur-2xl saturate-150 border border-white/[0.12] shadow-[0_24px_48px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)]">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-5 mb-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-violet-500/15 text-violet-300 border border-violet-400/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 id="verdict-modal-title" className="font-semibold text-white text-lg tracking-tight">
                Submit Your Verdict
              </h3>
              <p className="text-xs text-zinc-400 line-clamp-1">{mediaItem.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -mr-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div role="alert" className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Verdict Selector */}
          <fieldset>
            <legend className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
              Select Verdict Rating
            </legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {verdictOptions.map((v) => {
                const { label, icon: Icon } = VERDICT_PILLS[v];
                const active = selectedVerdict === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSelectedVerdict(v)}
                    aria-pressed={active}
                    className={`rounded-full py-2 px-4 flex items-center justify-center gap-2 border text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer ${
                      active
                        ? VERDICT_PILLS[v].active
                        : "bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08]"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Review Textarea */}
          <div>
            <label
              htmlFor="verdict-review"
              className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2"
            >
              Your Review / Verdict Notes
            </label>
            <textarea
              id="verdict-review"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What made this great? Is it worth watching/playing? Tell the community your honest thoughts..."
              className="w-full bg-black/40 border border-white/[0.08] rounded-xl p-4 text-sm leading-relaxed text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all resize-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
            />
          </div>

          {/* Spoiler Toggle */}
          <div className="flex items-center justify-between gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl mt-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
              <div>
                <p id="verdict-spoilers-label" className="text-sm font-medium text-zinc-100">
                  Contains Spoilers
                </p>
                <p id="verdict-spoilers-hint" className="text-xs text-zinc-400">
                  Blur this review to protect plot details for others
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={containsSpoilers}
              aria-labelledby="verdict-spoilers-label"
              aria-describedby="verdict-spoilers-hint"
              onClick={() => setContainsSpoilers(!containsSpoilers)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 cursor-pointer ${
                containsSpoilers ? "bg-amber-500" : "bg-zinc-700"
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                  containsSpoilers ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-zinc-400 hover:text-white font-medium px-4 py-2 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold py-2.5 px-6 rounded-xl shadow-[0_4px_16px_rgba(139,92,246,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] transition-all flex items-center justify-center disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Submitting..." : "Post Verdict"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
