/**
 * Homepage discovery: the balanced "Talk Of The Town" mix, curated weekly shelves
 * and per-platform shelves. Built on the existing TMDB helpers and the backend's
 * Google Books / IGDB search; every source degrades to an empty list on failure.
 */

import { mediaApi } from "@/lib/api";
import { MediaItem, MediaType } from "@/types/media";
import {
  TmdbItem,
  fetchIndianTitles,
  fetchJioHotstarTitles,
  fetchProviderTitles,
  fetchTrendingAllWeek,
  fetchTrendingAnime,
  fetchTrendingMovies,
  fetchTrendingTv,
  searchTmdbTitle,
  tmdbToMediaItem,
} from "@/lib/tmdb";

export type DiscoveryItem = MediaItem & { voteAverage?: number; popularity?: number };

const FEED_SIZE = 10;
const SHELF_SIZE = 5;

// ── Utilities ────────────────────────────────────────────────────────────────

/** Round-robin across buckets until `limit` items, skipping duplicates. */
export function interleave(buckets: DiscoveryItem[][], limit: number): DiscoveryItem[] {
  const out: DiscoveryItem[] = [];
  const seen = new Set<string>();
  const queues = buckets.map((b) => [...b]);
  while (out.length < limit && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      while (queue.length > 0) {
        const item = queue.shift()!;
        const key = dedupeKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
        break;
      }
      if (out.length >= limit) break;
    }
  }
  return out;
}

function dedupeKey(item: DiscoveryItem): string {
  const ns = item.mediaType === "SERIES" || item.mediaType === "ANIME" ? "TV" : item.mediaType;
  return `${ns}:${item.externalId}`;
}

function toItems(items: TmdbItem[], type: MediaType): DiscoveryItem[] {
  return items
    .filter((i) => i.poster_path)
    .map((i) => {
      const mapped = tmdbToMediaItem(i, type === "MOVIE" ? "MOVIE" : "SERIES");
      // tmdbToMediaItem only knows MOVIE/SERIES; keep anime labelled as anime for routing
      return type === "ANIME" ? { ...mapped, mediaType: "ANIME" as MediaType } : mapped;
    });
}

/** ISO-ish week number since the Unix epoch; rotates curated shelves weekly. */
export function weekIndex(now = new Date()): number {
  const MONDAY_EPOCH = Date.UTC(1970, 0, 5);
  return Math.floor((now.getTime() - MONDAY_EPOCH) / (7 * 24 * 60 * 60 * 1000));
}

/** `count` consecutive entries of `pool`, starting at a weekly offset. */
function weeklySlice<T>(pool: T[], count: number, week = weekIndex()): T[] {
  const start = (week * count) % pool.length;
  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(start + i) % pool.length]);
}

// ── Books via the existing Google Books integration ──────────────────────────

interface BookSeed {
  title: string;
  author: string;
  year: number;
  /** Accepted Google Books titles (lower-case), e.g. "1984" for Nineteen Eighty-Four. */
  aliases?: string[];
}

const NOT_THE_BOOK = /\b(summary|study guide|analysis|critical|companion|notes|workbook|sparknotes|cliffsnotes)\b/i;

function normalize(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Resolve a known book through the backend search; returns null when nothing credible is found. */
async function resolveBook(seed: BookSeed): Promise<DiscoveryItem | null> {
  try {
    const results = await mediaApi.search(`${seed.title} ${seed.author}`, "BOOK");
    const wanted = [seed.title, ...(seed.aliases ?? [])].map(normalize);
    const match = results.find((r) => {
      if (r.mediaType !== "BOOK" || !r.coverImage || NOT_THE_BOOK.test(r.title)) return false;
      const t = normalize(r.title);
      return wanted.some((w) => t === w || t.startsWith(`${w} `));
    });
    // Show the original publication year rather than the edition's
    return match ? { ...match, releaseYear: seed.year } : null;
  } catch {
    return null;
  }
}

async function resolveBooks(seeds: BookSeed[]): Promise<DiscoveryItem[]> {
  const resolved = await Promise.all(seeds.map(resolveBook));
  return resolved.filter((b): b is DiscoveryItem => b !== null);
}

/** Popular, highly rated recent books (Google Books has no trending endpoint, so this is curated). */
const POPULAR_BOOKS: BookSeed[] = [
  { title: "Fourth Wing", author: "Rebecca Yarros", year: 2023 },
  { title: "The Immortals of Meluha", author: "Amish", year: 2010, aliases: ["immortals of meluha"] },
  { title: "Tomorrow, and Tomorrow, and Tomorrow", author: "Gabrielle Zevin", year: 2022 },
  { title: "The Palace of Illusions", author: "Chitra Banerjee Divakaruni", year: 2008 },
  { title: "Atomic Habits", author: "James Clear", year: 2018 },
  { title: "The White Tiger", author: "Aravind Adiga", year: 2008 },
];

/** "Worth Your Time To Read": acclaimed books across decades, Indian and global alternating. */
const WORTH_READING: BookSeed[] = [
  { title: "The God of Small Things", author: "Arundhati Roy", year: 1997 },
  { title: "Nineteen Eighty-Four", author: "George Orwell", year: 1949, aliases: ["1984"] },
  { title: "Sacred Games", author: "Vikram Chandra", year: 2006 },
  { title: "Dune", author: "Frank Herbert", year: 1965 },
  { title: "Malgudi Days", author: "R. K. Narayan", year: 1943 },
  { title: "Crime and Punishment", author: "Fyodor Dostoevsky", year: 1866 },
  { title: "A Suitable Boy", author: "Vikram Seth", year: 1993 },
  { title: "Project Hail Mary", author: "Andy Weir", year: 2021 },
  { title: "Midnight's Children", author: "Salman Rushdie", year: 1981 },
  { title: "To Kill a Mockingbird", author: "Harper Lee", year: 1960 },
];

export function fetchWorthReadingBooks(): Promise<DiscoveryItem[]> {
  return resolveBooks(weeklySlice(WORTH_READING, SHELF_SIZE));
}

// ── Editor's Pick Of The Week ────────────────────────────────────────────────

interface TitleSeed {
  title: string;
  kind: "movie" | "tv";
  year: number;
  type: MediaType;
}

/** Cult classics and masterpieces, 1950s–2020s; Indian and global/anime alternate. */
const EDITORS_PICKS: TitleSeed[] = [
  { title: "Tumbbad", kind: "movie", year: 2018, type: "MOVIE" },
  { title: "12 Angry Men", kind: "movie", year: 1957, type: "MOVIE" },
  { title: "Gangs of Wasseypur", kind: "movie", year: 2012, type: "MOVIE" },
  { title: "Great Teacher Onizuka", kind: "tv", year: 1999, type: "ANIME" },
  { title: "Satya", kind: "movie", year: 1998, type: "MOVIE" },
  { title: "Witness for the Prosecution", kind: "movie", year: 1957, type: "MOVIE" },
  { title: "Bhoothakaalam", kind: "movie", year: 2022, type: "MOVIE" },
  { title: "The Good Place", kind: "tv", year: 2016, type: "SERIES" },
  { title: "The Substance", kind: "movie", year: 2024, type: "MOVIE" },
  { title: "Pather Panchali", kind: "movie", year: 1955, type: "MOVIE" },
];

export async function fetchEditorsPicks(): Promise<DiscoveryItem[]> {
  const seeds = weeklySlice(EDITORS_PICKS, SHELF_SIZE);
  const found = await Promise.all(seeds.map((s) => searchTmdbTitle(s.kind, s.title, s.year)));
  return found.flatMap((item, i) => (item ? toItems([item], seeds[i].type) : []));
}

// ── Talk Of The Town ─────────────────────────────────────────────────────────

/** 10 titles, round-robin: Indian 3 · Global 3 · Books 2 · Anime 2. */
export async function fetchBalancedFeed(): Promise<DiscoveryItem[]> {
  const [indianMovies, indianTv, trending, anime, books] = await Promise.all([
    fetchIndianTitles("movie"),
    fetchIndianTitles("tv"),
    fetchTrendingAllWeek(),
    fetchTrendingAnime(),
    resolveBooks(weeklySlice(POPULAR_BOOKS, 2)),
  ]);

  const indian = interleave([toItems(indianMovies, "MOVIE"), toItems(indianTv, "SERIES")], 3);
  const indianKeys = new Set(indian.map(dedupeKey));
  const global = trending
    .filter((t) => t.poster_path)
    .map((t) => tmdbToMediaItem(t) as DiscoveryItem)
    .filter((t) => !indianKeys.has(dedupeKey(t)))
    .slice(0, 3);
  const animeItems = toItems(anime, "ANIME").slice(0, 2);

  // Too few books/anime -> top up with extra Indian titles
  const extraIndian = interleave([toItems(indianMovies, "MOVIE"), toItems(indianTv, "SERIES")], 8).slice(3);

  const feed = interleave([indian, global, books, animeItems], FEED_SIZE);
  return feed.length < FEED_SIZE ? interleave([feed, extraIndian, books], FEED_SIZE) : feed;
}

/** Movies or Series: half Indian (origin IN), half global trending, interleaved. */
export async function fetchBlendedCategory(type: "MOVIE" | "SERIES"): Promise<DiscoveryItem[]> {
  const kind = type === "MOVIE" ? "movie" : "tv";
  const [indian, global] = await Promise.all([
    fetchIndianTitles(kind),
    type === "MOVIE" ? fetchTrendingMovies() : fetchTrendingTv(),
  ]);
  const half = Math.ceil(FEED_SIZE / 2);
  return interleave([toItems(indian, type).slice(0, half), toItems(global, type)], FEED_SIZE);
}

// ── Streaming platforms (India) ──────────────────────────────────────────────

export interface Platform {
  id: number;
  name: string;
  heading: string;
}

export const PLATFORMS: Platform[] = [
  { id: 8, name: "Netflix", heading: "Don't Miss These on Netflix" },
  { id: 122, name: "JioHotstar", heading: "Don't Miss These on JioHotstar" },
  { id: 119, name: "Prime Video", heading: "Worth Watching on Prime" },
  { id: 283, name: "Crunchyroll", heading: "Worth Watching on Crunchyroll" },
  { id: 237, name: "Sony LIV", heading: "Don't Miss These on Sony LIV" },
  { id: 350, name: "Apple TV+", heading: "Worth Watching on Apple TV" },
];

/** Popular movies and series on one platform in India, interleaved. */
export async function fetchPlatformShelf(providerId: number, limit = 10): Promise<DiscoveryItem[]> {
  if (providerId === JIOHOTSTAR_ID) return fetchJioHotstarShelf(limit);
  const [movies, tv] = await Promise.all([
    fetchProviderTitles(providerId, "movie"),
    fetchProviderTitles(providerId, "tv"),
  ]);
  return interleave([toItems(movies, "MOVIE"), toItems(tv, "SERIES")], limit);
}

const JIOHOTSTAR_ID = 122;

/** JioHotstar: merged Hotstar + JioCinema providers and flagship networks, deduped, popularity-ranked. */
async function fetchJioHotstarShelf(limit: number): Promise<DiscoveryItem[]> {
  const { movies, tv } = await fetchJioHotstarTitles();
  const seen = new Set<number>();
  const rank = (items: TmdbItem[]) =>
    items
      .filter((i) => {
        if (!i.poster_path || seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      })
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  return interleave([toItems(rank(tv), "SERIES"), toItems(rank(movies), "MOVIE")], limit);
}
