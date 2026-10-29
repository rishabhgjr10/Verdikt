"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, Check, Dices, Lock, PenLine, Play, Shuffle, Star, X, Zap } from "lucide-react";
import { PosterImage } from "@/components/PosterImage";
import { VerdictBadge } from "@/components/VerdictBadge";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { mediaApi, reviewApi, userMediaApi } from "@/lib/api";
import { CURATED_WORTH_READING } from "@/lib/discovery";
import {
  fetchTmdbHeroDetails,
  fetchTmdbTrailerUrl,
  fetchTopRatedPage,
  voteToVerdict,
  type DrawPool,
  type TmdbItem,
} from "@/lib/tmdb";
import { buildAuthHref } from "@/lib/auth-redirect";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useIsClient } from "@/lib/use-is-client";
import { MediaType } from "@/types/media";

const STORAGE_KEY = "verdikt_blind_draw_v1";
const DAILY_DRAWS = 3;
/** "Already watched" mulligans: mark the card watched and get a replacement without spending a draw */
const DAILY_REDRAWS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Accounts (comma-separated usernames or emails) that may switch off the daily limits to test the feature.
 * The limits only live in localStorage, so this is a testing convenience, not a privilege to protect.
 */
const OWNERS = (process.env.NEXT_PUBLIC_BLIND_VERDIKT_OWNERS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
/** "normal" while an owner has switched back to regular limits (to test the 0/3 states) */
const OWNER_MODE_KEY = "verdikt_blind_owner_mode";

type DeckType = "MOVIE" | "SERIES" | "ANIME" | "BOOK";
const DECKS: { type: DeckType; label: string }[] = [
  { type: "MOVIE", label: "Movie" },
  { type: "SERIES", label: "Series" },
  { type: "ANIME", label: "Anime" },
  { type: "BOOK", label: "Book" },
];
/** The audience is in India: this share of movie, series and book draws is made in India */
const INDIA_SHARE = 0.7;
/** Never reach deeper than this many pages (~20 titles each) into a best-first list */
const MAX_PAGES = 15;
/** Page counts per deck and pool, learnt from TMDB's total_pages; these are first guesses */
const poolPages: Record<string, number> = {
  "MOVIE-india": 5,
  "SERIES-india": 2,
  "MOVIE-global": 15,
  "SERIES-global": 12,
  "ANIME-global": 8,
};
/** Indian titles in the curated book list (it has no origin field) */
const INDIAN_BOOKS = new Set([
  "The God of Small Things",
  "Sacred Games",
  "Malgudi Days",
  "A Suitable Boy",
  "Midnight's Children",
  "The White Tiger",
  "The Immortals of Meluha",
  "Train to Pakistan",
  "The Palace of Illusions",
]);

interface BlindCard {
  key: string;
  externalId: string;
  /** The deck it was dealt from; tabs only ever show their own cards */
  type: MediaType;
  title: string;
  year: number | null;
  poster: string | null;
  overview: string | null;
  vote: number | null;
  runtime: number | null;
  people: string[];
  genres: string[];
  href: string;
  drawnAt: number;
  /** Database id once known (imported to read or set the live watched state) */
  mediaId?: string;
}

interface BlindDrawState {
  remaining: number;
  /** Set on the first draw of a cycle; 0 while no cycle is running */
  resetAt: number;
  watchedRedrawsRemaining: number;
  /** Never deal the same title twice, across cycles */
  seenIds: string[];
  /** Titles marked watched from a card: the watched state for signed-out visitors, and a fallback when the API is unreachable */
  watchedIds: string[];
  /** This cycle's cards in draw order; a free redraw replaces the card it was used on */
  todayDraws: BlindCard[];
}

const FRESH: BlindDrawState = {
  remaining: DAILY_DRAWS,
  resetAt: 0,
  watchedRedrawsRemaining: DAILY_REDRAWS,
  seenIds: [],
  watchedIds: [],
  todayDraws: [],
};

/** Starts a new cycle once the 24h window has passed. */
const refresh = (s: BlindDrawState, now = Date.now()): BlindDrawState =>
  s.resetAt && now >= s.resetAt
    ? { ...s, remaining: DAILY_DRAWS, watchedRedrawsRemaining: DAILY_REDRAWS, resetAt: 0, todayDraws: [] }
    : s;

function loadState(): BlindDrawState {
  if (typeof window === "undefined") return FRESH;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (typeof raw?.remaining !== "number" || !Array.isArray(raw.seenIds)) return FRESH;
    // Older saves kept one lastPickedItem and no todayDraws: carry that card over as today's only draw
    const { lastPickedItem, ...rest } = raw;
    const todayDraws: BlindCard[] = Array.isArray(raw.todayDraws)
      ? raw.todayDraws
      : lastPickedItem
        ? [{ ...lastPickedItem, drawnAt: 0 }]
        : [];
    // Spread over FRESH so fields added after a state was saved pick up their defaults
    return refresh({ ...FRESH, ...rest, todayDraws });
  } catch {
    return FRESH;
  }
}

function saveState(s: BlindDrawState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode or full storage: the draw still works for this visit
  }
}

/**
 * Stored state once `card` has landed: only a card that actually landed costs a draw. A free redraw
 * (`replacing` set) costs a redraw instead and takes the replaced card's slot, so draw numbers stay put.
 * `unlimited` (owner testing) costs nothing.
 */
function afterDeal(card: BlindCard, replacing?: string, unlimited = false) {
  const at = Date.now();
  const base = refresh(loadState(), at);
  const slot = replacing ? base.todayDraws.findIndex((d) => d.key === replacing) : -1;
  const todayDraws =
    slot >= 0
      ? base.todayDraws.map((d, i) => (i === slot ? { ...card, drawnAt: d.drawnAt } : d))
      : [...base.todayDraws, { ...card, drawnAt: at }];
  const state: BlindDrawState = {
    ...base,
    remaining: replacing || unlimited ? base.remaining : Math.max(0, base.remaining - 1),
    watchedRedrawsRemaining:
      replacing && !unlimited ? Math.max(0, base.watchedRedrawsRemaining - 1) : base.watchedRedrawsRemaining,
    resetAt: base.resetAt || at + DAY_MS,
    seenIds: [...base.seenIds, card.key].slice(-300),
    todayDraws,
  };
  return { state, at };
}

const pickRandom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

async function drawCard(type: DeckType, seen: Set<string>): Promise<BlindCard | null> {
  const indiaFirst = Math.random() < INDIA_SHARE;
  if (type === "BOOK") {
    const pool = CURATED_WORTH_READING.filter((b) => b.coverImage && !seen.has(`BOOK-${b.externalId}`));
    const indian = pool.filter((b) => INDIAN_BOOKS.has(b.title));
    const book = pickRandom(indiaFirst && indian.length ? indian : pool.length ? pool : CURATED_WORTH_READING);
    return {
      key: `BOOK-${book.externalId}`,
      externalId: book.externalId,
      type: "BOOK",
      title: book.title,
      year: book.releaseYear,
      poster: book.coverImage,
      overview: book.description,
      vote: null,
      runtime: null,
      people: book.creatorsJson || [],
      genres: book.genresJson || [],
      href: book.href || `/media/external/BOOK/${encodeURIComponent(book.externalId)}`,
      drawnAt: 0,
    };
  }

  // Made in India first (most of the time), then what's popular on Indian streaming, then the best anywhere.
  // There's no Indian anime, so Anime starts from what streams in India.
  const pools: DrawPool[] =
    type === "ANIME"
      ? ["india-popular", "global"]
      : indiaFirst
        ? ["india", "india-popular", "global"]
        : ["india-popular", "india", "global"];
  // Two random pages per pool, in case one is unreachable or every title on it was already dealt
  for (const pool of pools.flatMap((p) => [p, p])) {
    const pagesKey = `${type}-${pool}`;
    const page = 1 + Math.floor(Math.random() * (poolPages[pagesKey] ?? 10));
    const { results: rows, totalPages } = await fetchTopRatedPage(type, page, pool);
    if (totalPages) poolPages[pagesKey] = Math.min(totalPages, MAX_PAGES);
    const animated = (t: TmdbItem) => Boolean(t.genre_ids?.includes(16));
    const results = rows.filter(
      (t) =>
        t.poster_path &&
        !seen.has(`${type}-${t.id}`) &&
        // Series is live-action only and Anime is Japanese animation only, so the decks never bleed into each other
        (type === "SERIES" ? !animated(t) : type === "ANIME" ? animated(t) && t.original_language === "ja" : true)
    );
    if (!results.length) continue;
    const pick = pickRandom(results);
    const details = await fetchTmdbHeroDetails(type, pick.id);
    // List rows can miss genre ids, so the detail genres get the final say for Series
    if (type === "SERIES" && details?.genres.some((g) => g === "Animation" || g === "Anime")) continue;
    const date = pick.release_date || pick.first_air_date || "";
    return {
      key: `${type}-${pick.id}`,
      externalId: String(pick.id),
      type,
      title: (pick.title || pick.name || "Untitled").trim(),
      year: date ? parseInt(date.slice(0, 4), 10) : null,
      poster: `/tmdb-img/t/p/w500${pick.poster_path}`,
      overview: pick.overview || null,
      vote: pick.vote_average ?? null,
      runtime: details?.runtimeMinutes ?? null,
      people: (details?.cast || []).slice(0, 4).map((c) => c.name),
      genres: (details?.genres || []).slice(0, 3),
      href: `/media/external/${type}/${pick.id}`,
      drawnAt: 0,
    };
  }
  return null;
}

/** The database id the watched API needs; dealt cards come straight from TMDB / the book list, so this imports the title. */
async function resolveMediaId(card: BlindCard): Promise<string> {
  if (card.mediaId) return card.mediaId;
  // Cards saved before externalId existed still carry it in their key ("MOVIE-603")
  const externalId = card.externalId ?? card.key.slice(card.type.length + 1);
  return (await mediaApi.getByExternalId(card.type, externalId)).id;
}

const formatRuntime = (min: number, type: MediaType) => {
  const text = min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`;
  return type === "MOVIE" ? text : `${text} / ep`;
};

function formatCountdown(ms: number) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

/** Navbar pill plus the 3-draws-a-day random pick modal; both read one localStorage-backed state. */
export function BlindVerdikt() {
  const router = useRouter();
  const isClient = useIsClient();
  const { user } = useAuth();
  const [ownerNormalMode, setOwnerNormalMode] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(OWNER_MODE_KEY) === "normal";
    } catch {
      return false;
    }
  });
  const [state, setState] = useState<BlindDrawState>(loadState);
  const [open, setOpen] = useState(false);
  const [deck, setDeck] = useState<DeckType>(() => (state.todayDraws.at(-1)?.type as DeckType) || "MOVIE");
  /** A card picked from the list view; null shows the newest card (or the list) */
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Status line under the card (trailer not found, reset done); confirmations go to toasts instead */
  const [note, setNote] = useState<{ text: string } | null>(null);
  /** The card whose trailer is playing in place of its dossier */
  const [trailer, setTrailer] = useState<{ key: string; embed: string; url: string } | null>(null);
  const [loadingTrailer, setLoadingTrailer] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [reviewedKeys, setReviewedKeys] = useState<Set<string> | null>(null);
  /** Live watched state from the API, keyed by card; wins over the local watchedIds when present */
  const [liveWatched, setLiveWatched] = useState<Record<string, boolean>>({});
  const [liveLater, setLiveLater] = useState<Record<string, boolean>>({});
  const [savingLater, setSavingLater] = useState(false);
  const { showToast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  const current = refresh(state, now);
  // The server has no localStorage, so the badge shows the default until hydration finishes
  const remaining = isClient ? current.remaining : DAILY_DRAWS;
  const isOwner = !!user && [user.username, user.email].some((id) => id && OWNERS.includes(id.toLowerCase()));
  const unlimited = isClient && isOwner && !ownerNormalMode;
  const deckLabel = DECKS.find((d) => d.type === deck)!.label;
  const categoryDraws = current.todayDraws.filter((d) => d.type === deck);
  const listView = categoryDraws.length > 1 && !focusKey && (showAll || current.remaining <= 0);
  const focused = listView
    ? undefined
    : (categoryDraws.find((d) => d.key === focusKey) ?? categoryDraws.at(-1));
  const isWatched = (card: BlindCard) =>
    user && card.key in liveWatched ? liveWatched[card.key] : current.watchedIds.includes(card.key);

  const update = (next: BlindDrawState) => {
    setState(next);
    saveState(next);
  };

  useFocusTrap(panelRef, open, () => setOpen(false));

  // Ticks the cooldown and lets an expired cycle refill while the page stays open
  useEffect(() => {
    if (!current.resetAt) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [current.resetAt]);

  // Re-reads the live watched state of this tab's cards whenever the modal opens, the tab changes or the page is
  // shown again, so unmarking a title on its detail page clears the badge here too
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    const sync = async () => {
      const cards = loadState().todayDraws.filter((d) => d.type === deck);
      const results = await Promise.all(
        cards.map(async (card) => {
          try {
            const mediaId = await resolveMediaId(card);
            const live = await userMediaApi.getState(mediaId);
            return { card, mediaId, watched: live.watched, later: live.watchLater };
          } catch {
            return null; // Unknown stays on the local fallback
          }
        })
      );
      if (cancelled) return;
      const found = results.filter((r) => r !== null);
      setLiveWatched((prev) => ({ ...prev, ...Object.fromEntries(found.map((r) => [r.card.key, r.watched])) }));
      setLiveLater((prev) => ({ ...prev, ...Object.fromEntries(found.map((r) => [r.card.key, r.later])) }));
      // Keep the ids so the next check skips the import
      const base = loadState();
      const ids = new Map(found.map((r) => [r.card.key, r.mediaId]));
      if (base.todayDraws.some((d) => ids.has(d.key) && !d.mediaId)) {
        update({ ...base, todayDraws: base.todayDraws.map((d) => (ids.has(d.key) ? { ...d, mediaId: ids.get(d.key) } : d)) });
      }
    };
    sync();
    const onVisible = () => document.visibilityState === "visible" && sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open, deck, user]);

  const openModal = () => {
    const t = Date.now();
    setNow(t);
    // Re-read storage so a draw made in another tab counts here too
    update(refresh(loadState(), t));
    setError(null);
    setNote(null);
    setTrailer(null);
    setFocusKey(null);
    setShowAll(false);
    setOpen(true);
    // shortcut: the API has no watched-history list, so reviewed titles stand in for "already watched" on the server
    if (user && !reviewedKeys) {
      reviewApi
        .getByUserId(user.id)
        .then((reviews) => {
          setReviewedKeys(
            new Set(reviews.flatMap((r) => (r.mediaItem ? [`${r.mediaItem.mediaType}-${r.mediaItem.externalId}`] : [])))
          );
        })
        .catch(() => {});
    }
  };

  const switchDeck = (type: DeckType) => {
    setDeck(type);
    setFocusKey(null);
    setShowAll(false);
    setError(null);
    setNote(null);
    setTrailer(null);
  };

  /** Deals from the selected deck; `replacing` makes it a free redraw that takes that card's slot. */
  const deal = async (replacing?: string) => {
    if (dealing || (!replacing && !unlimited && current.remaining <= 0)) return false;
    setDealing(true);
    setError(null);
    setTrailer(null);
    try {
      const skip = new Set([...current.seenIds, ...current.watchedIds, ...(reviewedKeys ?? [])]);
      if (replacing) skip.add(replacing);
      const next = await drawCard(deck, skip);
      if (!next) throw new Error("empty deck");
      const { state: dealt, at } = afterDeal(next, replacing, unlimited);
      setNow(at);
      update(dealt);
      setFocusKey(next.key);
      setShowAll(false);
      return true;
    } catch {
      setError(
        `Couldn't deal a card right now. Check your connection and try again. No ${replacing ? "free redraw" : "draw"} was used.`
      );
      return false;
    } finally {
      setDealing(false);
    }
  };

  /**
   * Marks the card watched (on the profile when signed in, on this device otherwise). The card stays so the verdict
   * can be written while the title is fresh; the main shuffle button then becomes the free redraw.
   */
  const markWatched = async (card: BlindCard) => {
    if (dealing || marking) return;
    setMarking(true);
    setError(null);
    setNote(null);
    if (user) {
      try {
        const mediaId = await resolveMediaId(card);
        await userMediaApi.setWatched(mediaId, true);
        // Watching clears Watch Later on the server
        setLiveWatched((prev) => ({ ...prev, [card.key]: true }));
        setLiveLater((prev) => ({ ...prev, [card.key]: false }));
        showToast("Added to your watched list", { detail: card.title, alert: { href: `/media/${mediaId}` } });
      } catch (err) {
        // Falls back to this device's list below; a 401 is the stored login outliving its 24h token
        showToast("Saved on this device", {
          tone: "error",
          detail:
            axios.isAxiosError(err) && err.response?.status === 401
              ? "Your session expired. Sign in again to add it to your profile."
              : "Couldn't reach your profile. Please try again later.",
        });
      }
    } else {
      showToast("Saved on this device", { detail: "Sign in to track it on your profile." });
    }
    const base = refresh(loadState());
    update({ ...base, watchedIds: [...new Set([...base.watchedIds, card.key])].slice(-500) });
    setMarking(false);
  };

  /** The mulligan: swaps a watched card for a new one from the same deck without spending a daily draw. */
  const dealReplacement = (card: BlindCard) => {
    setNote(null);
    deal(card.key);
  };

  /** Watch Later, the same list as the Library's Watch Later tab. */
  const toggleLater = async (card: BlindCard) => {
    if (!user) {
      setOpen(false);
      router.push(buildAuthHref("/login"));
      return;
    }
    if (savingLater) return;
    const next = !liveLater[card.key];
    setSavingLater(true);
    try {
      const mediaId = await resolveMediaId(card);
      await userMediaApi.setWatchLater(mediaId, next);
      setLiveLater((prev) => ({ ...prev, [card.key]: next }));
      if (next) showToast("Saved to Watch Later", { detail: card.title, alert: { href: "/library" } });
      else showToast("Removed from Watch Later", { detail: card.title });
    } catch {
      showToast("Couldn't update Watch Later", { tone: "error", detail: "Nothing was changed. Please try again." });
    } finally {
      setSavingLater(false);
    }
  };

  const goTo = (card: BlindCard) => {
    setOpen(false);
    router.push(card.href);
  };

  /** Opens the title's page with its verdict composer in view (the page scrolls to #review-composer). */
  const writeVerdikt = async (card: BlindCard) => {
    try {
      const mediaId = await resolveMediaId(card);
      setOpen(false);
      router.push(`/media/${mediaId}#review-composer`);
    } catch {
      goTo(card);
    }
  };

  const watchTrailer = async (card: BlindCard) => {
    if (loadingTrailer) return;
    setLoadingTrailer(true);
    setError(null);
    setNote(null);
    const url = await fetchTmdbTrailerUrl(card.type, card.externalId);
    setLoadingTrailer(false);
    const id = url?.split("v=")[1]?.split("&")[0];
    if (id) setTrailer({ key: card.key, embed: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`, url: url! });
    else setNote({ text: `No trailer found for ${card.title}.` });
  };

  const pillBase = "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all";

  const outOfDraws = !unlimited && current.remaining <= 0;

  const setOwnerMode = (normal: boolean) => {
    setOwnerNormalMode(normal);
    try {
      if (normal) localStorage.setItem(OWNER_MODE_KEY, "normal");
      else localStorage.removeItem(OWNER_MODE_KEY);
    } catch {
      // Storage blocked: the switch still holds for this visit
    }
  };

  /** Owner testing: a fresh 3/3 day; seen and watched titles stay so the deck doesn't repeat */
  const resetToday = () => {
    const base = loadState();
    update({ ...FRESH, seenIds: base.seenIds, watchedIds: base.watchedIds });
    setFocusKey(null);
    setShowAll(false);
    setTrailer(null);
    setNote({ text: "Today's draws were reset." });
  };
  const canRedraw = unlimited || current.watchedRedrawsRemaining > 0;
  /** A watched card can be swapped for free from the main shuffle button while redraws are left (even at 0/3) */
  const freeRedraw = !!focused && isWatched(focused) && canRedraw;
  const cardActions = (card: BlindCard) => {
    const watched = isWatched(card);
    const later = !!liveLater[card.key];
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
        {!watched ? (
          <button
            type="button"
            onClick={() => markWatched(card)}
            disabled={marking}
            className={`${pillBase} border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-60 cursor-pointer`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            {marking ? "Saving…" : card.type === "BOOK" ? "Already Read" : "Already Watched"}
          </button>
        ) : (
          // Watched: the verdict takes the button's place while the title is fresh in mind
          <button
            type="button"
            onClick={() => {
              if (user) return writeVerdikt(card);
              setOpen(false);
              router.push(buildAuthHref("/login"));
            }}
            className={`${pillBase} border border-purple-400/50 bg-purple-500/20 text-purple-50 shadow-[0_0_18px_rgba(168,85,247,0.25)] hover:bg-purple-500/30 cursor-pointer`}
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden />
            {user ? "Write a Verdikt" : "Sign in to write a Verdikt"}
          </button>
        )}
        {card.type !== "BOOK" && (
          <button
            type="button"
            onClick={() => watchTrailer(card)}
            disabled={loadingTrailer}
            className={`${pillBase} border border-white/10 bg-white/[0.04] text-zinc-200 hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-60 cursor-pointer`}
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            {loadingTrailer ? "Finding…" : "Trailer"}
          </button>
        )}
        {/* Watch Later is for titles still to see; the server refuses it for watched ones */}
        {!watched && (
          <button
            type="button"
            onClick={() => toggleLater(card)}
            disabled={savingLater}
            aria-pressed={later}
            aria-label={later ? "Remove from Watch Later" : "Save to Watch Later"}
            title={later ? "Saved to Watch Later" : "Save to Watch Later"}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all disabled:cursor-wait disabled:opacity-60 cursor-pointer ${
              later
                ? "border-purple-400/60 bg-purple-500/25 text-purple-100"
                : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            <Bookmark className={`h-4 w-4 ${later ? "fill-current" : ""}`} aria-hidden />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="group relative flex shrink-0">
        <button
          type="button"
          onClick={openModal}
          aria-haspopup="dialog"
          aria-label={unlimited ? "Blind Verdikt, unlimited draws" : `Blind Verdikt, ${remaining} of ${DAILY_DRAWS} draws left today`}
          className="relative flex h-8 w-8 items-center justify-center gap-2 rounded-full border border-purple-500/30 bg-white/[0.06] shadow-[0_0_20px_rgba(168,85,247,0.15)] backdrop-blur-md transition-all hover:border-purple-400/60 hover:bg-white/[0.12] md:h-auto md:w-auto md:px-3 md:py-1.5 xl:px-3.5 cursor-pointer"
        >
          <Dices className="h-4 w-4 text-purple-400 transition-transform group-hover:rotate-12" aria-hidden />
          {/* Below xl the categories need the room: dice + count, and on phones just the dice with a count badge */}
          <span className="hidden text-xs font-bold tracking-wide text-white xl:inline">Blind Verdikt</span>
          <span className="absolute -right-1.5 -top-1.5 rounded-full border border-purple-500/30 bg-purple-950 px-1 text-[9px] font-extrabold tabular-nums text-purple-300 md:static md:bg-purple-500/20 md:px-1.5 md:py-0.5 md:text-[10px]">
            {unlimited ? (
              "∞"
            ) : (
              <>
                {remaining}
                <span className="hidden md:inline">/{DAILY_DRAWS}</span>
              </>
            )}
          </span>
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-[calc(100%+14px)] hidden w-60 -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-950/90 px-3 py-2 text-center text-[11px] leading-snug text-zinc-300 opacity-0 shadow-xl backdrop-blur-xl transition-opacity duration-200 group-hover:opacity-100 md:block"
        >
          Can&apos;t decide what to watch? Pull a top-rated random pick (3 draws/day)
        </span>
      </div>

      {open &&
        isClient &&
        createPortal(
          <div
            className="bv-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-xl"
            onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="blind-verdikt-title"
              className="bv-panel relative my-auto w-full max-w-3xl rounded-[28px] border border-white/10 bg-zinc-950/85 p-5 shadow-[0_40px_120px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)] md:p-7"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Blind Verdikt"
                className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="pr-10">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 id="blind-verdikt-title" className="text-xl font-black tracking-tight text-white md:text-2xl">
                    Blind Verdikt
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/40 bg-purple-500/15 px-2.5 py-1 text-[11px] font-bold text-purple-200 shadow-[0_0_18px_rgba(168,85,247,0.35)]">
                    <Zap className="h-3 w-3 fill-current" aria-hidden />
                    {unlimited ? (
                      "Owner · Unlimited Draws"
                    ) : (
                      <>
                        <span className="tabular-nums">{remaining}/{DAILY_DRAWS}</span> Daily Draws Left
                      </>
                    )}
                  </span>
                </div>
                {isOwner && (
                  // Owner-only test controls; everyone else never sees them
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!ownerNormalMode}
                        onChange={(e) => setOwnerMode(!e.target.checked)}
                        className="h-3.5 w-3.5 accent-purple-500"
                      />
                      Unlimited draws (owner testing)
                    </label>
                    <button
                      type="button"
                      onClick={resetToday}
                      disabled={dealing || marking}
                      className="font-semibold text-purple-300 underline-offset-2 hover:text-purple-200 hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      Reset today
                    </button>
                  </div>
                )}
                <p className="mt-1 text-xs text-zinc-400 md:text-sm">
                  Can&apos;t decide what to watch or read? Pick a category and deal a high-rated random recommendation. You
                  get 3 global draws every 24 hours across all media.
                </p>
              </div>

              {/* Deck switcher */}
              <div role="radiogroup" aria-label="Category to draw from" className="mt-5 flex flex-wrap gap-2">
                {DECKS.map((d) => {
                  const active = deck === d.type;
                  const count = current.todayDraws.filter((c) => c.type === d.type).length;
                  return (
                    <button
                      key={d.type}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={count ? `${d.label}, ${count} drawn today` : d.label}
                      disabled={dealing || marking}
                      onClick={() => switchDeck(d.type)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer disabled:cursor-wait ${
                        active
                          ? "border-purple-400/60 bg-purple-500/20 text-white shadow-[0_0_16px_rgba(168,85,247,0.3)]"
                          : "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {d.label}
                      {count > 0 && (
                        <span className="rounded-full bg-white/10 px-1.5 text-[10px] font-bold tabular-nums text-zinc-200">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
                <span
                  aria-disabled="true"
                  className="rounded-full border border-dashed border-white/10 px-3.5 py-1.5 text-xs font-semibold text-zinc-600"
                >
                  Games · Soon
                </span>
              </div>

              {/* Table */}
              <div className="mt-6 min-h-[18rem]" aria-live="polite">
                {dealing ? (
                  <Deck count={Math.max(remaining, 1)} dealing />
                ) : listView ? (
                  <PickList
                    cards={categoryDraws}
                    isWatched={isWatched}
                    onOpen={(c) => setFocusKey(c.key)}
                    onView={goTo}
                  />
                ) : focused ? (
                  <>
                    {categoryDraws.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFocusKey(null);
                          setShowAll(true);
                        }}
                        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 transition-colors hover:text-purple-200 cursor-pointer"
                      >
                        {focusKey && outOfDraws && <ArrowLeft className="h-3.5 w-3.5" aria-hidden />}
                        View all {categoryDraws.length} {deckLabel} picks today
                      </button>
                    )}
                    {trailer?.key === focused.key ? (
                      <div className="bv-reveal">
                        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
                          <iframe
                            src={trailer.embed}
                            title={`${focused.title} trailer`}
                            allow="autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen
                            className="h-full w-full"
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => setTrailer(null)}
                            className="inline-flex items-center gap-1.5 text-purple-300 transition-colors hover:text-purple-200 cursor-pointer"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                            Back to {focused.title}
                          </button>
                          {/* Some uploads block embedding or are region-locked; YouTube itself still plays them */}
                          <a
                            href={trailer.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-400 transition-colors hover:text-white"
                          >
                            Open on YouTube ↗
                          </a>
                        </div>
                      </div>
                    ) : (
                      <Dossier key={focused.key} card={focused}>
                        {cardActions(focused)}
                      </Dossier>
                    )}
                  </>
                ) : outOfDraws ? (
                  <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center">
                    <Lock className="h-5 w-5 text-zinc-500" aria-hidden />
                    <p className="mt-3 max-w-sm text-sm text-zinc-300">
                      No {deckLabel.toLowerCase()} shuffled today. You used your 3 daily draws in other categories — come
                      back in {formatCountdown(current.resetAt - now)}!
                    </p>
                  </div>
                ) : (
                  <Deck count={Math.max(remaining, 1)} dealing={false} />
                )}
                {error && <p className="mt-4 text-center text-xs text-rose-300">{error}</p>}
                {note && !error && <p className="mt-4 text-center text-xs text-zinc-400">{note.text}</p>}
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                {freeRedraw && !dealing ? (
                  // The card on show is watched: shuffling swaps it for free, even at 0/3
                  <button
                    type="button"
                    onClick={() => dealReplacement(focused!)}
                    disabled={marking}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-100 backdrop-blur-md transition-all hover:border-emerald-300/70 hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                  >
                    <Shuffle className="h-4 w-4" aria-hidden />
                    Shuffle Free • Already Watched (
                    {unlimited ? "∞" : `${current.watchedRedrawsRemaining}/${DAILY_REDRAWS}`} left)
                  </button>
                ) : outOfDraws ? (
                  // The empty-tab box already carries the countdown
                  categoryDraws.length > 0 && (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-400"
                    >
                      <Lock className="h-4 w-4" aria-hidden />
                      Daily Limit Reached • Next 3 Draws in {formatCountdown(current.resetAt - now)}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setNote(null);
                      deal();
                    }}
                    disabled={dealing || marking}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-400/50 bg-purple-500/10 px-5 py-3 text-sm font-semibold text-purple-100 backdrop-blur-md transition-all hover:border-purple-300/70 hover:bg-purple-500/20 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                  >
                    {categoryDraws.length ? <Shuffle className="h-4 w-4" aria-hidden /> : <Dices className="h-4 w-4" aria-hidden />}
                    {dealing
                      ? "Shuffling…"
                      : categoryDraws.length
                        ? `Shuffle Another ${deckLabel} (${unlimited ? "∞" : `${current.remaining}/${DAILY_DRAWS}`} Left)`
                        : `Deal a Random ${deckLabel} (${unlimited ? "Unlimited" : `${current.remaining}/${DAILY_DRAWS} Daily Draws Left`})`}
                  </button>
                )}
                {focused && !dealing && (
                  <button
                    type="button"
                    onClick={() => goTo(focused)}
                    className="rounded-full bg-white px-5 py-3 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 cursor-pointer"
                  >
                    Lock It In — View Full Page
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/** Face-down cards, one per draw left; they shuffle while a card is being dealt. */
function Deck({ count, dealing }: { count: number; dealing: boolean }) {
  return (
    <div className="flex h-72 items-center justify-center">
      <div className="relative h-60 w-40">
        {Array.from({ length: count }).map((_, i) => {
          const spread = (i - (count - 1) / 2) * 9;
          return (
            <div
              key={i}
              className={`bv-card-back absolute inset-0 flex items-center justify-center rounded-2xl ${dealing ? "bv-shuffling" : ""}`}
              style={
                {
                  transform: `translateX(${spread * 1.6}px) rotate(${spread}deg)`,
                  "--r": `${spread}deg`,
                  "--dx": `${spread * 1.6}px`,
                  animationDelay: `${i * 90}ms`,
                } as React.CSSProperties
              }
            >
              <span className="text-3xl font-black tracking-tight text-white/80">
                V<span className="text-purple-400">.</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Rating = ({ vote }: { vote: number }) => (
  <>
    <span className="inline-flex items-center gap-1 font-semibold text-amber-300 tabular-nums">
      <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
      {vote.toFixed(1)}
    </span>
    <VerdictBadge verdict={voteToVerdict(vote)} size="sm" />
  </>
);

function Dossier({ card, children }: { card: BlindCard; children?: React.ReactNode }) {
  const meta = [card.year, card.runtime ? formatRuntime(card.runtime, card.type) : null].filter(Boolean);
  return (
    <div className="bv-reveal flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <div className="relative shrink-0">
        {/* Ambient glow taken from the poster itself */}
        {card.poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.poster}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 rounded-2xl object-cover opacity-60 blur-2xl"
          />
        )}
        <PosterImage
          url={card.poster}
          title={card.title}
          mediaType={card.type}
          releaseYear={card.year}
          aspect="aspect-[2/3]"
          className="!w-40 !rounded-2xl shadow-2xl ring-1 ring-white/15 md:!w-52"
        />
      </div>

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-400 sm:justify-start">
          <span className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
            {card.type}
          </span>
          {meta.map((m) => (
            <span key={String(m)} className="tabular-nums">
              {m}
            </span>
          ))}
          {card.vote !== null && <Rating vote={card.vote} />}
        </div>

        <h3 className="mt-3 text-2xl font-black leading-tight text-white text-balance md:text-3xl">{card.title}</h3>

        {card.overview && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-300">{card.overview}</p>
        )}

        {card.people.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {card.people.map((name) => (
              <span
                key={name}
                className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-zinc-200"
              >
                {name}
              </span>
            ))}
          </div>
        )}

        {card.genres.length > 0 && (
          <p className="mt-3 text-xs text-zinc-500">{card.genres.join(" · ")}</p>
        )}

        {children && <div className="mt-4 flex justify-center sm:justify-start">{children}</div>}
      </div>
    </div>
  );
}

/** Today's picks in one category, in draw order, to compare before choosing one. */
function PickList({
  cards,
  isWatched,
  onOpen,
  onView,
}: {
  cards: BlindCard[];
  isWatched: (card: BlindCard) => boolean;
  onOpen: (card: BlindCard) => void;
  onView: (card: BlindCard) => void;
}) {
  return (
    <ol className="flex flex-col gap-3">
      {[...cards]
        .sort((a, b) => a.drawnAt - b.drawnAt)
        .map((card, i) => {
          const watched = isWatched(card);
          return (
            <li
              key={card.key}
              className="bv-reveal flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="mt-1 w-6 shrink-0 text-xs font-black tabular-nums text-purple-300">#{i + 1}</span>
              <button
                type="button"
                onClick={() => onOpen(card)}
                aria-label={`Open ${card.title}`}
                className="flex min-w-0 flex-1 items-start gap-3 text-left cursor-pointer"
              >
                <PosterImage
                  url={card.poster}
                  title={card.title}
                  mediaType={card.type}
                  aspect="aspect-[2/3]"
                  className="!w-16 shrink-0 !rounded-lg"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white">{card.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    {card.year && <span className="tabular-nums">{card.year}</span>}
                    {card.vote !== null && <Rating vote={card.vote} />}
                  </span>
                  {card.overview && (
                    <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-400">{card.overview}</span>
                  )}
                  {card.people.length > 0 && (
                    <span className="mt-1 block truncate text-[11px] text-zinc-500">{card.people.slice(0, 3).join(", ")}</span>
                  )}
                </span>
              </button>
              <span className="flex shrink-0 flex-col items-end gap-2">
                {watched ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <Check className="h-3 w-3" aria-hidden />
                    Watched
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                    {card.type === "BOOK" ? "Unread • Ready to Read" : "Unwatched • Ready to Watch"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onView(card)}
                  className="text-xs font-semibold text-purple-300 transition-colors hover:text-purple-200 cursor-pointer"
                >
                  View Page →
                </button>
              </span>
            </li>
          );
        })}
    </ol>
  );
}
