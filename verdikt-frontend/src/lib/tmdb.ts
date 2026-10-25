/**
 * TMDB API helpers, image sanitizers, franchise grouping, and vote-to-verdict calculation.
 */

import { MediaItem, MediaType, Verdict } from "@/types/media";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY =
  process.env.NEXT_PUBLIC_TMDB_API_KEY || "801a93954c3a3f63f691e72f175cf265";

export interface TmdbItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count?: number;
  popularity?: number;
  media_type?: string;
  overview?: string;
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
  } | null;
}

export interface TmdbCollection {
  id: number;
  name: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: TmdbItem[];
}

/** Ensure URLs are https and handle both full URLs and relative TMDB paths. */
export function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://")) return url.replace("http://", "https://");
  if (url.startsWith("/")) return `https://image.tmdb.org/t/p/w500${url}`;
  return url;
}

/** For backdrop images, use w1280 if only a relative path is provided. */
export function sanitizeBackdropUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://")) return url.replace("http://", "https://");
  if (url.startsWith("/")) return `https://image.tmdb.org/t/p/w1280${url}`;
  return url;
}

/**
 * 4-tier verdict conversion from TMDB vote_average:
 * > 8.2      -> Perfection
 * 7.0 - 8.2  -> Go For It
 * 5.5 - 6.9  -> Timepass
 * < 5.5      -> Skip
 */
export function voteToVerdict(vote: number): Verdict {
  if (vote > 8.2) return "PERFECTION";
  if (vote >= 7.0) return "GO_FOR_IT";
  if (vote >= 5.5) return "TIMEPASS";
  return "SKIP_IT";
}

/** Convert raw TMDB item into normalized Verdikt MediaItem with voteAverage attached. */
export function tmdbToMediaItem(
  item: TmdbItem,
  fallbackType: MediaType = "MOVIE"
): MediaItem & { voteAverage: number; popularity?: number } {
  const isTv =
    item.media_type === "tv" ||
    Boolean(item.first_air_date) ||
    fallbackType === "SERIES";
  const title = (item.title || item.name || "Untitled").trim();
  const dateStr = item.release_date || item.first_air_date || "";
  const year = dateStr ? parseInt(dateStr.substring(0, 4), 10) : null;
  const mediaType: MediaType = isTv ? "SERIES" : "MOVIE";

  return {
    id: `tmdb-${item.id}`,
    externalId: String(item.id),
    mediaType,
    title,
    releaseYear: Number.isNaN(year) ? null : year,
    coverImage: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null,
    backdropImage: item.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
      : null,
    description: item.overview || null,
    trailerUrl: null,
    creatorsJson: null,
    genresJson: null,
    platformsJson: null,
    voteAverage: item.vote_average ?? 7.0,
    popularity: item.popularity,
  };
}

/**
 * Extracts a normalized franchise root name from a title.
 * E.g., "Dune: Part Two" -> "dune"
 *       "Spider-Man: Brand New Day" -> "spider-man"
 *       "Avatar: Fire and Ash" -> "avatar"
 *       "Moana 2" -> "moana"
 */
export function extractFranchiseKey(title: string): string {
  let clean = title.toLowerCase().trim();
  // Split on subtitle delimiters (colon or hyphen/dash surrounded by spaces)
  clean = clean.split(/:\s*|\s+[\-\u2014]\s+/)[0].trim();
  // Strip sequel / part indicators
  clean = clean.replace(/\b(part|chapter|vol|volume|episode|season)\s+([0-9]+|[ivx]+)\b/gi, "").trim();
  // Strip trailing numbers or Roman numerals (e.g. "Moana 2" -> "moana")
  clean = clean.replace(/\s+([0-9]+|[ivx]+)$/gi, "").trim();
  return clean || title.toLowerCase().trim();
}

/**
 * Smart Franchise Deduplication:
 * Groups incoming titles by franchise key and retains ONLY the single highest-rated
 * or most popular entry per franchise in the discovery shelf.
 */
export function deduplicateFranchises<
  T extends {
    id?: string | number;
    externalId?: string;
    title?: string;
    voteAverage?: number;
    popularity?: number;
  }
>(items: T[]): T[] {
  const franchiseGroups = new Map<string, T>();

  for (const item of items) {
    const title = (item.title || "").trim();
    if (!title) continue;

    const franchiseKey = extractFranchiseKey(title);
    const existing = franchiseGroups.get(franchiseKey);

    if (!existing) {
      franchiseGroups.set(franchiseKey, item);
    } else {
      // Compare quality: higher vote score wins, tie-break with popularity
      const existingVote = existing.voteAverage ?? 0;
      const currentVote = item.voteAverage ?? 0;
      const existingPop = existing.popularity ?? 0;
      const currentPop = item.popularity ?? 0;

      const existingRank = existingVote * 10 + Math.log10(existingPop + 1);
      const currentRank = currentVote * 10 + Math.log10(currentPop + 1);

      if (currentRank > existingRank) {
        franchiseGroups.set(franchiseKey, item);
      }
    }
  }

  return Array.from(franchiseGroups.values());
}

/** Standard deduplication by ID and exact normalized title. */
export function deduplicateMedia<
  T extends { id?: string | number; externalId?: string; title?: string }
>(items: T[]): T[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  return items.filter((item) => {
    const rawId = String(item.externalId || item.id || "");
    const rawTitle = (item.title || "").toLowerCase().trim();

    if (!rawTitle) return false;
    if (rawId && seenIds.has(rawId)) return false;
    if (seenTitles.has(rawTitle)) return false;

    if (rawId) seenIds.add(rawId);
    seenTitles.add(rawTitle);
    return true;
  });
}

/** Fetch trending movies of the day from TMDB */
export async function fetchTrendingMovies(): Promise<TmdbItem[]> {
  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_API_KEY}&language=en-US`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((m: TmdbItem) => ({
      ...m,
      media_type: "movie",
    }));
  } catch (err) {
    console.error("Failed to fetch TMDB trending movies", err);
    return [];
  }
}

/** Fetch trending TV shows of the day from TMDB */
export async function fetchTrendingTv(): Promise<TmdbItem[]> {
  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/trending/tv/day?api_key=${TMDB_API_KEY}&language=en-US`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((t: TmdbItem) => ({
      ...t,
      media_type: "tv",
    }));
  } catch (err) {
    console.error("Failed to fetch TMDB trending TV", err);
    return [];
  }
}

/** Fetch trending mixed media of the day from TMDB */
export async function fetchTrendingAll(): Promise<TmdbItem[]> {
  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/trending/all/day?api_key=${TMDB_API_KEY}&language=en-US`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error("Failed to fetch TMDB trending all", err);
    return [];
  }
}

/** Fetch popular Anime series (TV with animation genre in Japanese) */
export async function fetchTrendingAnime(): Promise<TmdbItem[]> {
  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=16&with_original_language=ja&sort_by=popularity.desc&language=en-US`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((a: TmdbItem) => ({
      ...a,
      media_type: "tv",
    }));
  } catch (err) {
    console.error("Failed to fetch TMDB anime", err);
    return [];
  }
}

/**
 * Fetch detailed movie information from TMDB, including belongs_to_collection.
 */
export async function fetchTmdbMovieDetails(tmdbId: string | number): Promise<TmdbItem | null> {
  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Failed to fetch movie details for ${tmdbId}`, err);
    return null;
  }
}

/**
 * Fetch complete franchise/collection details with all timeline parts.
 */
export async function fetchTmdbCollection(collectionId: string | number): Promise<TmdbCollection | null> {
  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/collection/${collectionId}?api_key=${TMDB_API_KEY}&language=en-US`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Failed to fetch collection ${collectionId}`, err);
    return null;
  }
}

/**
 * Fetch recommendations for a movie or TV show.
 */
export async function fetchTmdbRecommendations(
  type: MediaType,
  tmdbId: string | number
): Promise<TmdbItem[]> {
  try {
    const endpoint = type === "SERIES" || type === "ANIME" ? "tv" : "movie";
    const res = await fetch(
      `${TMDB_BASE_URL}/${endpoint}/${tmdbId}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((item: TmdbItem) => ({
      ...item,
      media_type: type === "SERIES" || type === "ANIME" ? "tv" : "movie",
    }));
  } catch (err) {
    console.error(`Failed to fetch recommendations for ${tmdbId}`, err);
    return [];
  }
}
