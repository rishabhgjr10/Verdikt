"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Bookmark, Check, Clock, Eye } from "lucide-react";
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
}

const EMPTY_STATE: MediaUserState = { watched: false, watchLater: false, collectionIds: [], hasReview: false };

const LABELS = {
  default: { done: "Watched", mark: "Mark as Watched", undo: "Unwatch", later: "Watch Later", history: "Watch History", content: "Content" },
  book: { done: "Read", mark: "Mark as Read", undo: "Mark as Unread", later: "Read Later", history: "Reading History", content: "Book" },
};

/**
 * Watched / Watch Later / Collections actions for one title. Toggles are optimistic
 * with rollback; unwatch waits for the server because it can delete the user's verdict.
 */
export function MediaActions({ mediaId, mediaTitle, mediaType, onUnwatched }: MediaActionsProps) {
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

  const confirmUnwatch = async () => {
    setUnwatching(true);
    try {
      const result = await userMediaApi.setWatched(mediaId, false);
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
      {state.watched ? (
        <GlassButton
          variant="active"
          size="hero"
          block
          icon={<Check />}
          onClick={() => requireAuth(() => setConfirmOpen(true))}
          aria-label={`${t.done}. Activate to ${t.undo.toLowerCase()}`}
          disabled={pendingState}
        >
          {t.done}
        </GlassButton>
      ) : (
        <GlassButton
          variant="primary"
          size="hero"
          block
          icon={<Eye />}
          onClick={markWatched}
          loading={busy === "watched"}
          disabled={pendingState}
        >
          {t.mark}
        </GlassButton>
      )}

      {/* Two equal halves ((width - 12px) / 2); Watch Later is hidden once watched */}
      <div className={state.watched ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}>
        {!state.watched && (
          <GlassButton
            variant="neutral"
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
                {/* "In" only fits the phone layout's wider halves; the check icon marks the state elsewhere */}
                <span className="sm:hidden">In&nbsp;</span>{t.later}
              </>
            ) : (
              t.later
            )}
          </GlassButton>
        )}
        <GlassButton
          variant="neutral"
          size="hero"
          block
          className={state.watched ? "" : half}
          icon={<Bookmark />}
          onClick={() => requireAuth(() => setSheetOpen(true))}
          disabled={pendingState}
          aria-label="Add to Collections"
        >
          {state.watched ? "Add to Collections" : "Collections"}
        </GlassButton>
      </div>

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
          onCollectionsChange={(ids) => setState((s) => ({ ...s, collectionIds: ids }))}
        />
      )}
    </div>
  );
}

export default MediaActions;
