export const categories = [
  { label: 'Movies', type: 'MOVIE' },
  { label: 'Series', type: 'SERIES' },
  { label: 'Anime', type: 'ANIME' },
  { label: 'Games', type: 'GAME' },
  { label: 'Books', type: 'BOOK' },
] as const;
export type MediaType = typeof categories[number]['type'];
export function parseCatalogSearch(search: Record<string, unknown>): { type?: MediaType | undefined; q?: string | undefined } {
  const type = categories.find(category => category.type === search['type'])?.type;
  return { type, q: typeof search['q'] === 'string' ? search['q'] : undefined };
}
export function activeCategory(pathname: string, type?: string) {
  if (pathname === '/') return undefined;
  const currentType = pathname.startsWith('/media/external/') ? pathname.split('/')[3] : type;
  return categories.find(category => category.type === currentType)?.label;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strips punctuation, hyphens and spaces so "Spider-Man", "spider man" and "spiderman" compare equal, and collapses
 * repeated letters so transliteration variants match ("Taarak Mehta Ka Ooltah" ~ "tarak mehta ka oltah").
 * shortcut: only doubled letters are folded, not ee/i or oo/u swaps; add a phonetic map if those show up.
 */
const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(.)\1+/g, "$1");

/** Collapses spaces around hyphens: "spider - man" -> "spider-man". */
export const normalizeSearchQuery = (rawQuery: string) => rawQuery.trim().replace(/\s*-\s*/g, "-");

// TMDB only finds hyphenated titles ("Spider-Man", "X-Men") when the hyphen is typed, so also search that form
export function expandSearchQueries(rawQuery: string): string[] {
  const q = normalizeSearchQuery(rawQuery);
  const m = q.match(/^(x|he|[a-z]{3,}?)\s*(man|men|woman|verse)$/i);
  return m ? [...new Set([q, `${m[1]}-${m[2]}`])] : [q];
}

/**
 * TMDB needs every query word to match a title word, so one misspelt word ("tarak" for "Taarak") hides the title.
 * TMDB does prefix-match single words ("oolta" finds "Ooltah"), so retry with the longest words on their own.
 */
export function fallbackSearchQueries(rawQuery: string): string[] {
  const words = normalizeSearchQuery(rawQuery).toLowerCase().split(/\s+/);
  if (words.length < 2) return [];
  return [...new Set(words.filter((w) => w.length >= 4))].sort((a, b) => b.length - a.length).slice(0, 3);
}

/** True when a rated movie/show matches the whole query; books and games carry no voteCount, so they never count. */
export function hasRatedTitleMatch(items: Searchable[], rawQuery: string): boolean {
  const qNorm = alnum(normalizeSearchQuery(resolveSearchAlias(rawQuery)));
  return items.some((item) => (item.voteCount || 0) > 0 && alnum(item.title || "").includes(qNorm));
}

type Searchable = {
  id?: string | null;
  externalId?: string | null;
  mediaType?: string;
  title?: string;
  releaseYear?: number | string | null;
  coverImage?: string | null;
  voteCount?: number | null;
  popularity?: number | null;
};

function searchScore(item: Searchable, qNorm: string, qWordNorms: string[]): number {
  const tNorm = alnum(item.title || "");
  let score = 0;
  if (tNorm === qNorm) score += 1000;
  else if (tNorm.startsWith(qNorm)) score += 500;
  else if (tNorm.includes(qNorm)) score += 200;
  // Partial credit when a misspelt word breaks the full match: "tarak mehta ka oolta chashma" still hits 4 words
  else score += 100 * qWordNorms.filter((w) => tNorm.includes(w)).length;

  // TMDB vote_count/popularity from the backend; books and games have neither, so they rank on title match alone
  const votes = item.voteCount || 0;
  score += Math.min(votes / 50, 600);
  score += Math.min((item.popularity || 0) * 2, 300);

  score += item.coverImage ? 150 : -300;
  const year = parseInt(String(item.releaseYear || 0), 10) || 0;
  if ((!year || year > new Date().getFullYear()) && votes < 10) score -= 250;
  return score;
}

// TMDB has no fuzzy matching, so common Indian acronyms are expanded to the full title before searching
const SEARCH_ALIASES: Record<string, string> = {
  tmkoc: "Taarak Mehta Ka Ooltah Chashmah",
  bb: "Bigg Boss",
  kgf: "K.G.F",
  ddlj: "Dilwale Dulhania Le Jayenge",
  k3g: "Kabhi Khushi Kabhie Gham",
  kkhh: "Kuch Kuch Hota Hai",
  znmd: "Zindagi Na Milegi Dobara",
  yjhd: "Yeh Jawaani Hai Deewani",
  gow: "Gangs of Wasseypur",
  bmcm: "Bade Miyan Chote Miyan",
};

/** Expands a known acronym ("tmkoc") to the full title; any other query is returned unchanged. */
export const resolveSearchAlias = (query: string) => SEARCH_ALIASES[query.toLowerCase().trim()] || query;

export function rankAndFilterSearchResults<T extends Searchable>(items: T[], query: string): T[] {
  if (!query || !query.trim()) return items;
  const q = normalizeSearchQuery(resolveSearchAlias(query)).toLowerCase();
  const qNorm = alnum(q);
  const qWords = q.split(/\s+/).filter(Boolean);

  const seen = new Set<string>();
  const filtered = items.filter((item) => {
    const key = `${item.mediaType}-${item.externalId ?? item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const title = (item.title || "").toLowerCase();
    if (qNorm && alnum(title).includes(qNorm)) return true;
    return qWords.some((word) => {
      const regex = new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}`, "i");
      return regex.test(title);
    });
  });

  // Stable sort: equal scores keep the API's own popularity order
  const qWordNorms = qWords.map(alnum).filter((w) => w.length >= 3);
  const scores = new Map(filtered.map((item) => [item, searchScore(item, qNorm, qWordNorms)]));
  return filtered.sort((a, b) => scores.get(b)! - scores.get(a)!);
}
export function filterCatalog<T extends { type: MediaType; title: string }>(entries: T[], type?: MediaType, query = '') {
  const words = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return entries.filter(entry => (!type || entry.type === type) && words.every(word => entry.title.toLowerCase().includes(word)));
}
