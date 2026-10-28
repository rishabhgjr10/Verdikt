/**
 * TMDB API helpers, image sanitizers, franchise grouping, and vote-to-verdict calculation.
 */

import { MediaItem, MediaType, Verdict } from "@/types/media";
import { bucketForDate, scheduleWindow, type ScheduleTimeline } from "@/lib/schedule-dates";

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
  /** Movie details only (minutes) */
  runtime?: number | null;
  /** Movie details only, e.g. "Released", "In Production", "Post Production", "Planned" */
  status?: string;
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

export interface TmdbCrewCredit {
  name: string;
  job: string;
}

export interface TmdbCastCredit {
  id: number;
  name: string;
  character: string;
  profileUrl: string | null;
}

export interface TmdbHeroDetails {
  tagline: string | null;
  /** TMDB audience score (0-10), the fallback for the consensus verdict when no member has reviewed */
  voteAverage: number | null;
  /** Billed order, up to 12 */
  cast: TmdbCastCredit[];
  ageRating: string | null;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  crew: TmdbCrewCredit[];
  backdrops: string[];
  belongs_to_collection: TmdbItem["belongs_to_collection"];
}

const CREW_JOBS = ["Director", "Screenplay", "Writer", "Story"];

/**
 * Movie or TV details with credits, age ratings and backdrops in one request.
 * Age rating prefers India, then US. Returns null on failure.
 */
export async function fetchTmdbHeroDetails(
  type: MediaType,
  tmdbId: string | number
): Promise<TmdbHeroDetails | null> {
  const isTv = type === "SERIES" || type === "ANIME";
  try {
    // Text-free (null) backdrops first so the slideshow has no burned-in titles
    const res = await fetch(
      `${TMDB_BASE_URL}/${isTv ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US` +
        `&append_to_response=credits,release_dates,content_ratings,images&include_image_language=null,en`
    );
    if (!res.ok) return null;
    const d = await res.json();

    let ageRating: string | null = null;
    for (const region of ["IN", "US"]) {
      if (isTv) {
        ageRating = d.content_ratings?.results?.find((r: { iso_3166_1: string }) => r.iso_3166_1 === region)?.rating || null;
      } else {
        const dates: { certification: string }[] =
          d.release_dates?.results?.find((r: { iso_3166_1: string }) => r.iso_3166_1 === region)?.release_dates || [];
        ageRating = dates.find((x) => x.certification)?.certification || null;
      }
      if (ageRating) break;
    }

    // One entry per person, jobs merged ("Director, Writer"), in CREW_JOBS order
    const byName = new Map<string, string[]>();
    for (const job of CREW_JOBS) {
      for (const c of (d.credits?.crew || []) as TmdbCrewCredit[]) {
        if (c.job !== job) continue;
        const jobs = byName.get(c.name) || [];
        if (!jobs.includes(job)) byName.set(c.name, [...jobs, job]);
      }
    }
    const crew = [...byName].slice(0, 6).map(([name, jobs]) => ({ name, job: jobs.join(", ") }));

    const backdrops = ((d.images?.backdrops || []) as { file_path: string; iso_639_1: string | null }[])
      .sort((a, b) => Number(a.iso_639_1 !== null) - Number(b.iso_639_1 !== null))
      .slice(0, 3)
      .map((b) => `https://image.tmdb.org/t/p/w1280${b.file_path}`);

    const cast = ((d.credits?.cast || []) as { id: number; name: string; character?: string; profile_path: string | null }[])
      .slice(0, 12)
      .map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character || "",
        profileUrl: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
      }));

    return {
      tagline: d.tagline || null,
      voteAverage: d.vote_count ? d.vote_average : null,
      cast,
      ageRating,
      releaseDate: (isTv ? d.first_air_date : d.release_date) || null,
      runtimeMinutes: (isTv ? d.episode_run_time?.[0] : d.runtime) || null,
      crew,
      backdrops,
      belongs_to_collection: d.belongs_to_collection ?? null,
    };
  } catch (err) {
    console.error(`Failed to fetch hero details for ${tmdbId}`, err);
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

/**
 * YouTube trailer for a movie or TV show: official trailer first, then any trailer, then a teaser.
 * Returns null when TMDB lists none or the request fails.
 */
export async function fetchTmdbTrailerUrl(type: MediaType, tmdbId: string | number): Promise<string | null> {
  try {
    const endpoint = type === "SERIES" || type === "ANIME" ? "tv" : "movie";
    const res = await fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=en-US`);
    if (!res.ok) return null;
    const data = await res.json();
    const videos: { site: string; type: string; official: boolean; key: string }[] = (data.results || []).filter(
      (v: { site: string }) => v.site === "YouTube"
    );
    const pick =
      videos.find((v) => v.type === "Trailer" && v.official) ||
      videos.find((v) => v.type === "Trailer") ||
      videos.find((v) => v.type === "Teaser");
    return pick ? `https://www.youtube.com/watch?v=${pick.key}` : null;
  } catch (err) {
    console.error(`Failed to fetch trailer for ${tmdbId}`, err);
    return null;
  }
}

export type WatchOffer ="flatrate" | "free" | "ads" | "rent" | "buy";

export interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  offer: WatchOffer;
}

/**
 * India (IN) watch providers for a movie or TV show, one entry per provider,
 * streaming offers (flatrate, free, ads) before rent/buy. Returns null on failure.
 */
export async function fetchTmdbWatchProvidersIN(
  type: MediaType,
  tmdbId: string | number
): Promise<TmdbWatchProvider[] | null> {
  try {
    const endpoint = type === "SERIES" || type === "ANIME" ? "tv" : "movie";
    const res = await fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    const inProviders = data.results?.IN;
    if (!inProviders) return [];
    const seen = new Set<number>();
    const out: TmdbWatchProvider[] = [];
    for (const offer of ["flatrate", "free", "ads", "rent", "buy"] as WatchOffer[]) {
      for (const p of inProviders[offer] || []) {
        if (seen.has(p.provider_id)) continue;
        seen.add(p.provider_id);
        out.push({ provider_id: p.provider_id, provider_name: p.provider_name, logo_path: p.logo_path, offer });
      }
    }
    return out;
  } catch (err) {
    console.error(`Failed to fetch watch providers for ${tmdbId}`, err);
    return null;
  }
}

// ── Discovery helpers (homepage shelves) ─────────────────────────────────────

type TmdbParams = Record<string, string | number | boolean>;

/** GET a TMDB v3 list endpoint; returns `results` (tagged with media_type) or [] on any failure. */
async function tmdbList(path: string, params: TmdbParams, mediaType?: "movie" | "tv"): Promise<TmdbItem[]> {
  try {
    const query = new URLSearchParams({ api_key: TMDB_API_KEY, language: "en-US" });
    for (const [key, value] of Object.entries(params)) query.set(key, String(value));
    const res = await fetch(`${TMDB_BASE_URL}${path}?${query}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const results: TmdbItem[] = data.results || [];
    return mediaType ? results.map((r) => ({ ...r, media_type: mediaType })) : results;
  } catch (err) {
    console.error(`TMDB request failed: ${path}`, err);
    return [];
  }
}

/** Trending movies + TV of the week. */
export function fetchTrendingAllWeek(): Promise<TmdbItem[]> {
  return tmdbList("/trending/all/week", {}).then((items) =>
    items.filter((i) => i.media_type === "movie" || i.media_type === "tv")
  );
}

/** Popular Indian movies or series (Hindi, Tamil, Telugu, Malayalam, Kannada) available in India. */
export function fetchIndianTitles(kind: "movie" | "tv"): Promise<TmdbItem[]> {
  return tmdbList(
    `/discover/${kind}`,
    {
      watch_region: "IN",
      with_origin_country: "IN",
      with_original_language: "hi|ta|te|ml|kn",
      sort_by: "popularity.desc",
      include_adult: false,
    },
    kind
  );
}

/** Popular titles on one streaming provider in India (TMDB watch-provider id). */
export function fetchProviderTitles(providerId: number, kind: "movie" | "tv"): Promise<TmdbItem[]> {
  return tmdbList(
    `/discover/${kind}`,
    { watch_region: "IN", with_watch_providers: providerId, sort_by: "popularity.desc", include_adult: false },
    kind
  );
}

/** JioHotstar India: Hotstar (122) + JioCinema (220) incl. free/ads, plus flagship TV networks. */
export async function fetchJioHotstarTitles(): Promise<{ movies: TmdbItem[]; tv: TmdbItem[] }> {
  const providers: TmdbParams = {
    watch_region: "IN",
    with_watch_providers: "122|220",
    with_watch_monetization_types: "flatrate|free|ads",
    sort_by: "popularity.desc",
    include_adult: false,
  };
  const networks: TmdbParams = { with_networks: "49|1436|3919", include_adult: false };
  const [movies, pTv, pTv2, nPop, nVotes] = await Promise.all([
    tmdbList("/discover/movie", providers, "movie"),
    tmdbList("/discover/tv", providers, "tv"),
    tmdbList("/discover/tv", { ...providers, page: 2 }, "tv"),
    tmdbList("/discover/tv", { ...networks, sort_by: "popularity.desc" }, "tv"),
    tmdbList("/discover/tv", { ...networks, sort_by: "vote_count.desc" }, "tv"),
  ]);
  return { movies, tv: [...pTv, ...pTv2, ...nPop, ...nVotes] };
}

/** Best TMDB match for a known title (year narrows remakes and namesakes). */
export async function searchTmdbTitle(kind: "movie" | "tv", query: string, year?: number): Promise<TmdbItem | null> {
  const params: TmdbParams = { query, include_adult: false };
  if (year) params[kind === "movie" ? "year" : "first_air_date_year"] = year;
  const results = await tmdbList(`/search/${kind}`, params, kind);
  return results.find((r) => r.poster_path) ?? null;
}

// ── Entertainment schedule ───────────────────────────────────────────────────

export type { ScheduleTimeline };
export type ScheduleMediaFilter = "ALL" | "MOVIE" | "SERIES" | "ANIME" | "BOOK";

export interface ScheduleEntry {
  id: string;
  type: MediaType;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  poster: string;
  popularity: number;
}

/** Indian + global movies, series and anime releasing in the timeline's window, from TMDB discover. */
export async function fetchEntertainmentSchedule({
  timeline,
  mediaType,
}: {
  timeline: ScheduleTimeline;
  mediaType: Exclude<ScheduleMediaFilter, "BOOK">;
}): Promise<ScheduleEntry[]> {
  const [from, to] = scheduleWindow(timeline);
  const movieDates: TmdbParams = { "primary_release_date.gte": from, ...(to && { "primary_release_date.lte": to }) };
  const tvDates: TmdbParams = { "first_air_date.gte": from, ...(to && { "first_air_date.lte": to }) };
  // No `region`: TMDB would then filter on India dates while we group by the global date shown
  const base: TmdbParams = { sort_by: "popularity.desc", include_adult: false };
  const india: TmdbParams = { with_origin_country: "IN" };
  const anime: TmdbParams = { with_genres: 16, with_origin_country: "JP" };

  const wantsMovie = mediaType === "ALL" || mediaType === "MOVIE";
  const wantsTv = mediaType === "ALL" || mediaType === "SERIES";
  const wantsAnime = mediaType === "ALL" || mediaType === "ANIME";

  const jobs: Promise<ScheduleEntry[]>[] = [];
  const run = (path: string, params: TmdbParams, kind: "movie" | "tv", type: MediaType) =>
    jobs.push(
      tmdbList(path, params, kind).then((items) =>
        items.flatMap((i) => {
          const date = i.release_date || i.first_air_date;
          return i.poster_path && date && bucketForDate(date) === timeline
            ? [{
                id: String(i.id),
                type,
                title: (i.title || i.name || "Untitled").trim(),
                date,
                poster: `https://image.tmdb.org/t/p/w500${i.poster_path}`,
                popularity: i.popularity ?? 0,
              }]
            : [];
        })
      )
    );

  if (wantsMovie) {
    run("/discover/movie", { ...base, ...movieDates, ...india }, "movie", "MOVIE");
    run("/discover/movie", { ...base, ...movieDates }, "movie", "MOVIE");
  }
  if (wantsTv) {
    run("/discover/tv", { ...base, ...tvDates, ...india }, "tv", "SERIES");
    run("/discover/tv", { ...base, ...tvDates, without_genres: 16 }, "tv", "SERIES");
  }
  if (wantsAnime) {
    run("/discover/tv", { ...base, ...tvDates, ...anime }, "tv", "ANIME");
    if (mediaType === "ANIME") run("/discover/movie", { ...base, ...movieDates, ...anime }, "movie", "ANIME");
  }

  const seen = new Set<string>();
  const entries = (await Promise.all(jobs))
    .flat()
    .filter((e) => {
      const key = `${e.type === "MOVIE" ? "m" : "t"}${e.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}
