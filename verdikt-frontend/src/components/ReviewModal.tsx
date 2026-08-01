"use client";

import React, { useState } from "react";
import { MediaItem, Verdict } from "@/types/media";
import { reviewApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { VerdictBadge } from "./VerdictBadge";
import { X, Sparkles, AlertCircle, ShieldAlert } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-lg">Submit Your Verdict</h3>
              <p className="text-xs text-slate-400 line-clamp-1">{mediaItem.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Verdict Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Select Verdict Rating
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {verdictOptions.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSelectedVerdict(v)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                    selectedVerdict === v
                      ? "border-violet-500 bg-violet-950/40 ring-2 ring-violet-500/30"
                      : "border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/80"
                  }`}
                >
                  <VerdictBadge verdict={v} size="sm" />
                </button>
              ))}
            </div>
          </div>

          {/* Review Textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Your Review / Verdict Notes
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What made this great? Is it worth watching/playing? Tell the community your honest thoughts..."
              className="w-full p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all resize-none"
            />
          </div>

          {/* Spoiler Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-slate-200">Contains Spoilers</p>
                <p className="text-xs text-slate-400">Blur this review to protect plot details for others</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={containsSpoilers}
              onChange={(e) => setContainsSpoilers(e.target.checked)}
              className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-600/25 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Post Verdict"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
