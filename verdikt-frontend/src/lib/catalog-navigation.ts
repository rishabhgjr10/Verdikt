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

export function getRelevanceScore(title: string, q: string): number {
  const normTitle = title.toLowerCase().trim();
  const normQ = q.toLowerCase().trim();

  // Exact match: 100
  if (normTitle === normQ) return 100;
  // Prefix with separator: e.g. "Dune: Part Two" -> 95
  if (
    normTitle.startsWith(normQ + ":") ||
    normTitle.startsWith(normQ + " -") ||
    normTitle.startsWith(normQ + " –")
  ) {
    return 95;
  }
  // Starts with query and space: 90
  if (normTitle.startsWith(normQ + " ")) return 90;
  if (normTitle.startsWith(normQ)) return 85;
  // Word boundary match: e.g. "The Sand Dune" -> 70
  const wordBoundaryRegex = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normQ)}([^a-z0-9]|$)`, "i");
  if (wordBoundaryRegex.test(normTitle)) return 70;
  // Substring match: 40
  if (normTitle.includes(normQ)) return 40;
  return 10;
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

export function rankAndFilterSearchResults<T extends { title?: string; releaseYear?: number | string | null }>(
  items: T[],
  query: string
): T[] {
  if (!query || !query.trim()) return items;
  const q = resolveSearchAlias(query).trim().toLowerCase();
  const qWords = q.split(/\s+/).filter(Boolean);

  const filtered = items.filter((item) => {
    const title = (item.title || "").toLowerCase();
    return qWords.some((word) => {
      const regex = new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}`, "i");
      return regex.test(title);
    });
  });

  return filtered.sort((a, b) => {
    const scoreA = getRelevanceScore(a.title || "", q);
    const scoreB = getRelevanceScore(b.title || "", q);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    const yearA = parseInt(String(a.releaseYear || 0), 10) || 0;
    const yearB = parseInt(String(b.releaseYear || 0), 10) || 0;
    return yearB - yearA;
  });
}
export function filterCatalog<T extends { type: MediaType; title: string }>(entries: T[], type?: MediaType, query = '') {
  const words = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return entries.filter(entry => (!type || entry.type === type) && words.every(word => entry.title.toLowerCase().includes(word)));
}
