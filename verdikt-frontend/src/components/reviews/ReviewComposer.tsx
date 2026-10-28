"use client";

import React, { useId, useState } from "react";
import { EyeOff } from "lucide-react";
import { MediaItem, ReviewWithRelations, User, Verdict } from "@/types/media";
import { reviewApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { ReviewAvatar } from "./ReviewAvatar";
import { MAX_REVIEW_LENGTH, VERDICT_OPTIONS } from "./verdicts";

/**
 * Inline review form. With `review` it edits that review (Cancel / Update);
 * without, it writes a new one (Clear / Post). Saving goes through the same upsert endpoint.
 */
export function ReviewComposer({
  mediaItem,
  user,
  review,
  onSaved,
  onCancel,
}: {
  mediaItem: MediaItem;
  user: User;
  review?: ReviewWithRelations;
  onSaved: (saved: ReviewWithRelations) => void;
  onCancel?: () => void;
}) {
  const editing = !!review;
  const { showToast } = useToast();
  const [verdict, setVerdict] = useState<Verdict>(review?.verdict ?? "GO_FOR_IT");
  const [content, setContent] = useState(review?.content ?? "");
  const [containsSpoilers, setContainsSpoilers] = useState(review?.containsSpoilers ?? false);
  const [allowComments, setAllowComments] = useState(review?.allowComments ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  const reset = () => {
    setVerdict("GO_FOR_IT");
    setContent("");
    setContainsSpoilers(false);
    setAllowComments(true);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("Write a few words before posting.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await reviewApi.create({
        mediaItemId: mediaItem.id,
        verdict,
        content: content.trim(),
        containsSpoilers,
        allowComments,
        mediaDetails: mediaItem,
      });
      onSaved(saved);
      showToast(editing ? "Review updated" : "Review posted");
      if (!editing) reset();
    } catch {
      setError(editing ? "Couldn't update your review. Please try again." : "Couldn't post your review. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-zinc-900/50 border border-white/[0.08] rounded-2xl p-5">
      {/* User + integrated rating selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ReviewAvatar url={user.avatarUrl} name={user.username} />
          <span className="font-semibold text-white truncate">@{user.username}</span>
        </div>
        <div
          role="radiogroup"
          aria-label="Verdict"
          // Phones get ~240px here, too narrow for four labels in a row: 2x2 there, one pill row from sm up
          className="w-full sm:w-auto bg-black/40 border border-white/[0.1] rounded-2xl sm:rounded-full p-1 grid grid-cols-2 gap-1 sm:gap-0 sm:flex sm:items-center"
        >
          {VERDICT_OPTIONS.map((o) => {
            const active = verdict === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setVerdict(o.value)}
                className={`rounded-full px-4 py-1.5 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer ${
                  active ? `${o.solid} font-semibold` : "text-zinc-400 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <label htmlFor={`${ids}-text`} className="sr-only">
        Your review
      </label>
      <textarea
        id={`${ids}-text`}
        rows={3}
        value={content}
        maxLength={MAX_REVIEW_LENGTH}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`What did you think of ${mediaItem.title}?`}
        className="w-full bg-transparent border-b border-white/[0.1] text-white text-sm leading-relaxed placeholder-zinc-600 mt-4 pb-2 focus:outline-none focus:border-white/[0.3] resize-none transition-colors"
      />
      <p className="text-right text-xs text-zinc-500 mt-1" aria-live="polite">
        {content.length}/{MAX_REVIEW_LENGTH}
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-400">
          {error}
        </p>
      )}

      {/* Bottom action bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={allowComments}
              aria-labelledby={`${ids}-comments`}
              onClick={() => setAllowComments(!allowComments)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 cursor-pointer ${
                allowComments ? "bg-purple-500" : "bg-zinc-700"
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                  allowComments ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span id={`${ids}-comments`} className="text-sm text-zinc-300">
              Allow comments
            </span>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={containsSpoilers}
              onChange={(e) => setContainsSpoilers(e.target.checked)}
              className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
            />
            <EyeOff className={`w-4 h-4 ${containsSpoilers ? "text-purple-400" : "text-zinc-500"}`} aria-hidden="true" />
            Contains spoilers
          </label>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          <button
            type="button"
            onClick={editing ? onCancel : reset}
            className="text-zinc-400 hover:text-white text-sm font-medium transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
          >
            {editing ? "Cancel" : "Clear"}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-white text-black hover:bg-zinc-200 px-6 py-2 rounded-full font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 cursor-pointer"
          >
            {saving ? (editing ? "Updating…" : "Posting…") : editing ? "Update" : "Post"}
          </button>
        </div>
      </div>
    </form>
  );
}
