"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Bookmark, Check, Clock, Eye, Flame, Loader2 } from "lucide-react";
import { GlassButton } from "@/components/GlassButton";
import { GlassConfirmDialog } from "@/components/GlassConfirmDialog";
import { CollectionsSheet } from "@/components/CollectionsSheet";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { buildAuthHref, useRequireAuth } from "@/lib/auth-redirect";
import { userMediaApi } from "@/lib/api";
import { MediaType, MediaUserState } from "@/types/media";

export interface MediaActionsProps {
  mediaId: string;
  mediaTitle: string;
  /** Books use reading vocabulary; labels only, the stored state and API calls are unchanged. */
  mediaType?: MediaType;
  /** Called after a confirmed unwatch so the page can drop the user's verdict immediately. */
  onUnwatched?: (deletedReview: boolean) => void;
  /** Write/Edit verdict button: last when unwatched, moved up under the primary once watched. */
  verdictAction?: React.ReactNode;
  /** Not out yet: no Mark as Watched or verdict, only Watch Later and Collections */
  unreleased?: boolean;
  /** Collection membership changed in the sheet, so the page's save button can update */
  onCollectionsChange?: (collectionIds: string[]) => void;
  /** Name of the member's most recently used collection holding this title; shown on the Collections button */
  collectionLabel?: string;
  /** Watched state changed here, so the page (e.g. the franchise progress rail) can update */
  onWatchedChange?: (watched: boolean) => void;
}

const PRIMARY_BASE =
  "w-full py-3 rounded-xl text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

const EMPTY_STATE: MediaUserState = { watched: false, watchLater: false, collectionIds: [], hasReview: false, favorite: false };

const LABELS = {
  default: { done: "Watched", mark: "Mark as Watched", undo: "Unwatch", later: "Watch Later", history: "Watch History", content: "Content" },
  book: { done: "Read", mark: "Mark as Read", undo: "Mark as Unread", later: "Read Later", history: "Reading History", content: "Book" },
};

/**
 * Watched / Watch Later / Collections actions for one title. Toggles are optimistic
 * with rollback; unwatch waits for the server because it can delete the user's verdict.
 */
export function MediaActions({
  mediaId,
  mediaTitle,
  mediaType,
  onUnwatched,
  verdictAction,
  unreleased = false,
  onCollectionsChange,
  collectionLabel,
  onWatchedChange,
}: MediaActionsProps) {
  const t = mediaType === "BOOK" ? LABELS.book : LABELS.default;
  const { user, isLoading: authLoading, logout } = useAuth();
  const { showToast } = useToast();
  const requireAuth = useRequireAuth();
  const router = useRouter();

  // The stored user outlives its 24h JWT, so a 401 means the session expired: sign out and send to login.
  const handleExpired = (err: unknown) => {
    if (!axios.isAxiosError(err) || err.response?.status !== 401) return false;
    logout();
    showToast("Session expired", { tone: "error", detail: "Please sign in again." });
    router.push(buildAuthHref("/login"));
    return true;
  };
  const [state, setState] = useState<MediaUserState>(EMPTY_STATE);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [busy, setBusy] = useState<"watched" | "later" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unwatching, setUnwatching] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Only signed-in users have state; logged-out visitors never call /me.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    userMediaApi
      .getState(mediaId)
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch((err) => {
        // Expired token: drop the stale session quietly so the buttons route to login on click
        if (axios.isAxiosError(err) && err.response?.status === 401) logout();
        /* otherwise keep defaults; actions still work */
      })
      .finally(() => {
        if (!cancelled) setStateLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaId, user, authLoading, logout]);

  const markWatched = () =>
    requireAuth(async () => {
      if (busy) return;
      const previous = state;
      setState({ ...state, watched: true, watchLater: false });
      setBusy("watched");
      try {
        await userMediaApi.setWatched(mediaId, true);
        onWatchedChange?.(true);
        showToast(`Added to ${t.history}`);
      } catch (err) {
        setState(previous);
        if (handleExpired(err)) return;
        showToast(`Couldn't ${t.mark.toLowerCase()}`, { tone: "error", detail: "Please try again." });
      } finally {
        setBusy(null);
      }
    });

  const toggleWatchLater = () =>
    requireAuth(async () => {
      if (busy) return;
      const previous = state;
      const next = !state.watchLater;
      setState({ ...state, watchLater: next });
      setBusy("later");
      try {
        await userMediaApi.setWatchLater(mediaId, next);
      } catch (err) {
        setState(previous);
        if (handleExpired(err)) return;
        showToast(`Couldn't update ${t.later}`, { tone: "error", detail: "Please try again." });
      } finally {
        setBusy(null);
      }
    });

  const toggleInterested = () =>
    requireAuth(async () => {
      if (busy) return;
      const previous = state;
      const next = !state.watchLater;
      setState({ ...state, watchLater: next });
      setBusy("later");
      try {
        await userMediaApi.setWatchLater(mediaId, next);
        showToast(
          next ? "Marked as Interested" : "Removed from Interested",
          next ? { detail: `It's in your ${t.later} list.` } : undefined
        );
      } catch (err) {
        setState(previous);
        if (handleExpired(err)) return;
        showToast("Couldn't update Interested", { tone: "error", detail: "Please try again." });
      } finally {
        setBusy(null);
      }
    });

  const confirmUnwatch = async () => {
    setUnwatching(true);
    try {
      const result = await userMediaApi.setWatched(mediaId, false);
      onWatchedChange?.(false);
      const deletedReview = !!result.deletedReview;
      setState((s) => ({ ...s, watched: false, watchLater: result.watchLater, hasReview: false }));
      setConfirmOpen(false);
      onUnwatched?.(deletedReview);
      showToast(`Removed from ${t.history}`, deletedReview ? { detail: "Your review was deleted" } : undefined);
    } catch (err) {
      setConfirmOpen(false);
      if (handleExpired(err)) return;
      showToast(`Couldn't ${t.undo.toLowerCase()}`, { tone: "error", detail: "Nothing was changed. Please try again." });
    } finally {
      setUnwatching(false);
    }
  };

  // Signed-in users see disabled buttons until their state arrives, so nothing flips after load.
  const pendingState = !!user && !stateLoaded;
  // Half-width buttons trade side padding for label room; text size stays text-sm
  // Tablet column is 220px (halves = 104px): drop the icon and tighten padding so labels fit
  const half = "[--gb-px:12px] [--gb-gap:6px] min-w-0 sm:max-lg:[--gb-px:8px] sm:max-lg:[&_svg]:hidden";

  return (
    // Layout only: fills its column (poster width in the hero); 12px between rows and halves.
    <div className="w-full flex flex-col gap-3" aria-busy={pendingState || undefined}>
      {unreleased ? (
        // Saved: calm orange tint, and hovering offers the way back out
        <button
          type="button"
          onClick={toggleInterested}
          disabled={pendingState || busy === "later"}
          aria-pressed={state.watchLater}
          aria-label={state.watchLater ? "Interested. Activate to unmark" : "Mark as Interested"}
          className={`group/int ${PRIMARY_BASE} font-semibold ${
            state.watchLater
              ? "bg-orange-500/15 border border-orange-400/40 text-orange-200 hover:bg-rose-500/20 hover:border-rose-400/40"
              : "bg-gradient-to-r from-orange-500 to-rose-500 shadow-lg hover:brightness-110"
          }`}
        >
          {busy === "later" ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : state.watchLater ? (
            <Check className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Flame className="w-4 h-4" aria-hidden="true" />
          )}
          {state.watchLater ? (
            <>
              <span className="group-hover/int:hidden group-focus-visible/int:hidden">Interested</span>
              <span className="hidden group-hover/int:inline group-focus-visible/int:inline">Unmark as Interested?</span>
            </>
          ) : (
            "Mark as Interested"
          )}
        </button>
      ) : state.watched ? (
        <button
          type="button"
          onClick={() => requireAuth(() => setConfirmOpen(true))}
          aria-label={`${t.done}. Activate to ${t.undo.toLowerCase()}`}
          disabled={pendingState}
          className={`${PRIMARY_BASE} bg-emerald-600 hover:bg-emerald-500 font-semibold`}
        >
          <Check className="w-4 h-4" aria-hidden="true" />
          {t.done}
        </button>
      ) : (
        <button
          type="button"
          onClick={markWatched}
          disabled={pendingState || busy === "watched"}
          aria-busy={busy === "watched" || undefined}
          className={`${PRIMARY_BASE} bg-gradient-to-r from-purple-600 to-indigo-600 font-medium shadow-lg hover:brightness-110`}
        >
          {busy === "watched" ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
          {t.mark}
        </button>
      )}

      {/* Seen it: reviewing becomes the next step, so the verdict button moves up */}
      {!unreleased && state.watched && verdictAction}

      {/* Two equal halves ((width - 12px) / 2); Watch Later is hidden once watched */}
      <div className={state.watched || unreleased ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}>
        {!state.watched && !unreleased && (
          <GlassButton
            variant={state.watchLater ? "selected" : "neutral"}
            size="hero"
            block
            className={half}
            icon={state.watchLater ? <Check className="text-violet-300" /> : <Clock />}
            onClick={toggleWatchLater}
            aria-pressed={state.watchLater}
            aria-label={state.watchLater ? `In ${t.later}` : t.later}
            title={state.watchLater ? `In ${t.later} — click to remove` : undefined}
            disabled={pendingState || busy === "later"}
          >
            {state.watchLater ? (
              <>
                {/* "In" fits the phone and desktop halves; the 104px tablet halves rely on the tint and check */}
                <span className="sm:hidden lg:inline">In&nbsp;</span>{t.later}
              </>
            ) : (
              t.later
            )}
          </GlassButton>
        )}
        <GlassButton
          variant={collectionLabel ? "selected" : "neutral"}
          size="hero"
          block
          className={state.watched || unreleased ? "" : half}
          icon={<Bookmark className={collectionLabel ? "fill-current" : ""} />}
          onClick={() => requireAuth(() => setSheetOpen(true))}
          disabled={pendingState}
          aria-label={collectionLabel ? `Saved in ${collectionLabel}. Manage collections` : "Add to Collections"}
          title={collectionLabel ? `Saved in ${collectionLabel}` : undefined}
        >
          {/* min-w-0 + truncate: long collection names end in an ellipsis inside the button */}
          <span className="min-w-0 truncate">
            {collectionLabel ?? (state.watched || unreleased ? "Add to Collections" : "Collections")}
          </span>
        </GlassButton>
      </div>

      {!unreleased && !state.watched && verdictAction}

      <GlassConfirmDialog
        open={confirmOpen}
        title={`${t.undo} ${t.content}?`}
        description="This action will also delete your submitted review if you have one."
        confirmLabel={t.undo}
        confirmVariant="danger"
        loading={unwatching}
        onConfirm={confirmUnwatch}
        onClose={() => setConfirmOpen(false)}
      />

      {user && sheetOpen && (
        <CollectionsSheet
          open
          onClose={() => setSheetOpen(false)}
          mediaId={mediaId}
          mediaTitle={mediaTitle}
          watched={state.watched}
          collectionIds={state.collectionIds}
          onCollectionsChange={(ids) => {
            setState((s) => ({ ...s, collectionIds: ids }));
            onCollectionsChange?.(ids);
          }}
        />
      )}
    </div>
  );
}

export default MediaActions;
