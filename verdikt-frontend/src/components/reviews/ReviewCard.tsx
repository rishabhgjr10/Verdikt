"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  Download,
  Eye,
  EyeOff,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Send,
  Share2,
  Trash2,
} from "lucide-react";
import { ReviewComment, ReviewWithRelations } from "@/types/media";
import { reviewApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useRequireAuth } from "@/lib/auth-redirect";
import { ReviewAvatar } from "./ReviewAvatar";
import { verdictOption } from "./verdicts";

const MENU_ITEM =
  "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer outline-none focus-visible:bg-white/[0.06] focus-visible:text-white";

export function ReviewCard({
  review,
  onEdit,
  onDelete,
  onShareCard,
  onShareStory,
}: {
  review: ReviewWithRelations;
  onEdit?: () => void;
  onDelete?: () => void;
  onShareCard: () => void;
  onShareStory: () => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const requireAuth = useRequireAuth();
  const isOwner = !!user && review.user?.id === user.id;
  const verdict = verdictOption(review.verdict);
  const allowComments = review.allowComments ?? true;

  const [revealed, setRevealed] = useState(false);
  const [liked, setLiked] = useState(!!review.likedByMe);
  const [likeCount, setLikeCount] = useState(review.likeCount ?? 0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<ReviewComment[] | null>(null);
  const [commentCount, setCommentCount] = useState(review.commentCount ?? 0);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ids = useId();

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const toggleLike = () =>
    requireAuth(async () => {
      if (likeBusy) return;
      const prev = { liked, likeCount };
      setLiked(!liked);
      setLikeCount(likeCount + (liked ? -1 : 1));
      setLikeBusy(true);
      try {
        const res = await reviewApi.toggleLike(review.id);
        setLiked(res.liked);
        setLikeCount(res.likeCount);
      } catch {
        setLiked(prev.liked);
        setLikeCount(prev.likeCount);
        showToast("Couldn't update like", { tone: "error", detail: "Please try again." });
      } finally {
        setLikeBusy(false);
      }
    });

  const toggleComments = async () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && comments === null) {
      try {
        setComments(await reviewApi.getComments(review.id));
      } catch {
        setComments([]);
        showToast("Couldn't load comments", { tone: "error" });
      }
    }
  };

  const postComment = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    requireAuth(async () => {
      setPosting(true);
      try {
        const created = await reviewApi.addComment(review.id, text);
        setComments((c) => [...(c ?? []), created]);
        setCommentCount((n) => n + 1);
        setDraft("");
      } catch {
        showToast("Couldn't post comment", { tone: "error", detail: "Please try again." });
      } finally {
        setPosting(false);
      }
    });
  };

  const menuAction = (fn?: () => void) => () => {
    setMenuOpen(false);
    fn?.();
  };

  return (
    <article className="bg-zinc-900/50 border border-white/[0.08] rounded-2xl p-5 mb-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ReviewAvatar url={review.user?.avatarUrl} name={review.user?.username} />
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">
              {review.user?.username || "Verdikt Member"}
              {isOwner && <span className="ml-2 text-xs font-medium text-zinc-500">You</span>}
            </p>
            <p className="text-xs text-zinc-500">
              {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "Recently"}
            </p>
          </div>
        </div>
        <span className={`${verdict.solid} font-semibold px-3 py-1 rounded-full text-xs shrink-0`}>{verdict.label}</span>
      </header>

      {/* Body (spoilers stay blurred until revealed) */}
      <div className="mt-4 mb-6">
        {review.containsSpoilers && !revealed ? (
          <div className="relative rounded-xl bg-black/40 border border-white/[0.06] p-4">
            <p className="text-sm text-zinc-500 blur-sm select-none" aria-hidden="true">
              {review.content}
            </p>
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                Contains spoilers. Reveal
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{review.content}</p>
            {review.containsSpoilers && (
              <button
                type="button"
                onClick={() => setRevealed(false)}
                className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <EyeOff className="w-3 h-3" aria-hidden="true" />
                Hide spoiler
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer: like / comment on the left, menu on the right */}
      <footer className="flex items-center justify-between">
        <div className="flex gap-4 text-zinc-400">
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            aria-label={liked ? "Unlike review" : "Like review"}
            className={`inline-flex items-center gap-1.5 text-sm transition-colors cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              liked ? "text-rose-500" : "hover:text-white"
            }`}
          >
            <Heart className={`w-[18px] h-[18px] transition-transform ${liked ? "fill-current scale-110" : ""}`} aria-hidden="true" />
            {likeCount > 0 && <span className="tabular-nums">{likeCount}</span>}
          </button>
          <button
            type="button"
            onClick={toggleComments}
            aria-expanded={commentsOpen}
            aria-controls={`${ids}-comments`}
            aria-label="Comments"
            className={`inline-flex items-center gap-1.5 text-sm transition-colors cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              commentsOpen ? "text-white" : "hover:text-white"
            }`}
          >
            <MessageCircle className="w-[18px] h-[18px]" aria-hidden="true" />
            {commentCount > 0 && <span className="tabular-nums">{commentCount}</span>}
          </button>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Review options"
            className="p-1.5 -mr-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-40 bg-zinc-950/90 backdrop-blur-xl border border-white/[0.1] rounded-xl p-1.5 shadow-2xl z-50"
            >
              <button role="menuitem" type="button" className={MENU_ITEM} onClick={menuAction(onShareStory)}>
                <Share2 className="w-4 h-4" aria-hidden="true" />
                Share Story
              </button>
              <button role="menuitem" type="button" className={MENU_ITEM} onClick={menuAction(onShareCard)}>
                <Download className="w-4 h-4" aria-hidden="true" />
                Share Card
              </button>
              {isOwner && (
                <>
                  <button role="menuitem" type="button" className={MENU_ITEM} onClick={menuAction(onEdit)}>
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                    Edit Review
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className={`${MENU_ITEM} text-rose-500 hover:text-rose-400 hover:bg-rose-500/10`}
                    onClick={menuAction(onDelete)}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </footer>

      {/* Comments */}
      {commentsOpen && (
        <section id={`${ids}-comments`} aria-label="Comments" className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
          {comments === null ? (
            <p className="text-xs text-zinc-500">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-zinc-500">{allowComments ? "No comments yet. Start the conversation." : "No comments."}</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <ReviewAvatar url={c.user?.avatarUrl} name={c.user?.username} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs">
                      <span className="font-semibold text-zinc-200">{c.user?.username}</span>
                      <span className="ml-2 text-zinc-500">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "Just now"}
                      </span>
                    </p>
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line break-words">{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {allowComments ? (
            <form onSubmit={postComment} className="flex items-center gap-2">
              <label htmlFor={`${ids}-draft`} className="sr-only">
                Write a comment
              </label>
              <input
                id={`${ids}-draft`}
                value={draft}
                maxLength={1000}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 min-w-0 bg-transparent border-b border-white/[0.1] text-sm text-white placeholder-zinc-600 py-1.5 focus:outline-none focus:border-white/[0.3] transition-colors"
              />
              <button
                type="submit"
                disabled={posting || !draft.trim()}
                aria-label="Post comment"
                className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          ) : (
            <p className="text-xs text-zinc-500">The author turned off comments.</p>
          )}
        </section>
      )}
    </article>
  );
}
