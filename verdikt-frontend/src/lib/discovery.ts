/**
 * Homepage discovery: the balanced "Talk Of The Town" mix, plus the weekly shelves (Editor's Pick, Worth Your Time
 * To Read, the platform shelves), which the backend selects once per week (Monday 00:00 IST) and serves to everyone.
 * Every source degrades to an empty list on failure.
 */

import { discoveryApi, mediaApi, WeeklyPickItem } from "@/lib/api";
import { MediaItem, MediaType } from "@/types/media";
import {
  TmdbItem,
  fetchIndianTitles,
  fetchTrendingAllWeek,
  fetchTrendingAnime,
  fetchTrendingMovies,
  fetchTrendingTv,
  tmdbToMediaItem,
} from "@/lib/tmdb";

export type DiscoveryItem = MediaItem & {
  voteAverage?: number | null;
  popularity?: number;
  /** Overrides the card's link, for fallback books that have no Google volume id */
  href?: string;
};

const FEED_SIZE = 10;

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

/** A weekly pick as a homepage card item */
function fromWeeklyPick(p: WeeklyPickItem): DiscoveryItem {
  return {
    id: `${p.mediaType.toLowerCase()}-${p.externalId}`,
    externalId: p.externalId,
    mediaType: p.mediaType,
    title: p.title,
    releaseYear: p.releaseYear,
    releaseDate: p.releaseDate,
    coverImage: p.coverImage,
    backdropImage: null,
    description: null,
    trailerUrl: null,
    creatorsJson: null,
    genresJson: null,
    platformsJson: null,
    voteAverage: p.voteAverage,
    voteCount: p.voteCount,
    ...(p.href ? { href: p.href } : {}),
  };
}

/** This week's picks first, then the section's other eligible titles (which only Shuffle shows) */
async function weeklyShelf(section: string): Promise<DiscoveryItem[]> {
  const week = await discoveryApi.weekly(section);
  return [...week.picks, ...week.pool].map(fromWeeklyPick);
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

const fallbackBook = (externalId: string, title: string, author: string, year: number, genre: string): DiscoveryItem => ({
  id: `book-${externalId}`,
  externalId,
  mediaType: "BOOK",
  title,
  releaseYear: year,
  // Google's cover image server is separate from the Books API, so these load even when its quota is spent
  coverImage: `https://books.google.com/books/content?id=${externalId}&printsec=frontcover&img=1&zoom=1`,
  backdropImage: null,
  description: null,
  trailerUrl: null,
  creatorsJson: [author],
  genresJson: [genre],
  platformsJson: null,
});

/** Fallback book with no known Google volume id: Open Library cover by ISBN, card links to a book search. */
const fallbackIsbnBook = (isbn: string, title: string, author: string, year: number, genre: string): DiscoveryItem => ({
  id: `isbn-${isbn}`,
  externalId: `isbn-${isbn}`,
  mediaType: "BOOK",
  title,
  releaseYear: year,
  coverImage: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
  backdropImage: null,
  description: null,
  trailerUrl: null,
  creatorsJson: [author],
  genresJson: [genre],
  platformsJson: null,
  href: `/search?q=${encodeURIComponent(title)}&type=BOOK`,
});

/** Popular, highly rated recent books (instant local catalog for fast page loading). */
export const CURATED_POPULAR_BOOKS: DiscoveryItem[] = [
  fallbackBook("EP-gEAAAQBAJ", "Fourth Wing", "Rebecca Yarros", 2023, "Fantasy"),
  fallbackIsbnBook("9789380658742", "The Immortals of Meluha", "Amish", 2010, "Mythological Fiction"),
  fallbackIsbnBook("9780593321201", "Tomorrow, and Tomorrow, and Tomorrow", "Gabrielle Zevin", 2022, "Fiction"),
  fallbackIsbnBook("9781400096206", "The Palace of Illusions", "Chitra Banerjee Divakaruni", 2008, "Mythological Fiction"),
  fallbackIsbnBook("9780735211292", "Atomic Habits", "James Clear", 2018, "Self-Help"),
  fallbackIsbnBook("9781416562603", "The White Tiger", "Aravind Adiga", 2008, "Literary Fiction"),
];

/** "Worth Your Time To Read": acclaimed books across decades, Indian and global alternating. */
export const CURATED_WORTH_READING: DiscoveryItem[] = [
  fallbackIsbnBook("9780812979657", "The God of Small Things", "Arundhati Roy", 1997, "Literary Fiction"),
  fallbackBook("kotPYEqx7kMC", "1984", "George Orwell", 1949, "Classics"),
  fallbackBook("agMWBAAAQBAJ", "Sacred Games", "Vikram Chandra", 2006, "Crime"),
  fallbackBook("B1hSG45JCX4C", "Dune", "Frank Herbert", 1965, "Science Fiction"),
  fallbackIsbnBook("9788185986173", "Malgudi Days", "R. K. Narayan", 1943, "Classics"),
  fallbackIsbnBook("9780140449136", "Crime and Punishment", "Fyodor Dostoevsky", 1866, "Classics"),
  fallbackIsbnBook("9780143419983", "A Suitable Boy", "Vikram Seth", 1993, "Literary Fiction"),
  fallbackIsbnBook("9780593135204", "Project Hail Mary", "Andy Weir", 2021, "Science Fiction"),
  fallbackIsbnBook("9780812976533", "Midnight's Children", "Salman Rushdie", 1981, "Literary Fiction"),
  fallbackIsbnBook("9780061120084", "To Kill a Mockingbird", "Harper Lee", 1960, "Classics"),
  fallbackIsbnBook("9780062315007", "The Alchemist", "Paulo Coelho", 1988, "Fiction"),
  fallbackIsbnBook("9781416562603", "The White Tiger", "Aravind Adiga", 2008, "Literary Fiction"),
  fallbackIsbnBook("9780062316097", "Sapiens", "Yuval Noah Harari", 2011, "History"),
  fallbackIsbnBook("9789380658742", "The Immortals of Meluha", "Amish", 2010, "Mythological Fiction"),
  fallbackIsbnBook("9780735211292", "Atomic Habits", "James Clear", 2018, "Self-Help"),
  fallbackIsbnBook("9780143065883", "Train to Pakistan", "Khushwant Singh", 1956, "Historical Fiction"),
  fallbackIsbnBook("9780593321201", "Tomorrow, and Tomorrow, and Tomorrow", "Gabrielle Zevin", 2022, "Fiction"),
  fallbackIsbnBook("9781400096206", "The Palace of Illusions", "Chitra Banerjee Divakaruni", 2008, "Mythological Fiction"),
];

/** This week's six books first; the rest of the reading list feeds Shuffle. */
export async function fetchWorthReadingBooks(): Promise<DiscoveryItem[]> {
  return weeklyShelf("reading");
}

// ── Editor's Pick Of The Week ────────────────────────────────────────────────

/** This week's six picks from the editors' list; the same for everyone until Monday 00:00 IST. */
export async function fetchEditorsPicks(): Promise<DiscoveryItem[]> {
  return (await discoveryApi.weekly("editors")).picks.map(fromWeeklyPick);
}

// ── Talk Of The Town ─────────────────────────────────────────────────────────

/** 10 titles, round-robin: Indian 3 · Global 3 · Books 2 · Anime 2. */
export async function fetchBalancedFeed(): Promise<DiscoveryItem[]> {
  const [indianMovies, indianTv, trending, anime] = await Promise.all([
    fetchIndianTitles("movie"),
    fetchIndianTitles("tv"),
    fetchTrendingAllWeek(),
    fetchTrendingAnime(),
  ]);

  const books = weeklySlice(CURATED_POPULAR_BOOKS, 2);
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

/**
 * This week's titles streaming on one platform in India (TMDB watch-provider data), the same for everyone until
 * Monday 00:00 IST; the platform's other eligible titles follow and feed Shuffle.
 */
export async function fetchPlatformShelf(providerId: number): Promise<DiscoveryItem[]> {
  return weeklyShelf(`platform-${providerId}`);
}
