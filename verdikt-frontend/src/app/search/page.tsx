"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { NavMediaCategory } from "@/components/Navbar";
import { MediaCard } from "@/components/MediaCard";
import { SlidingPill } from "@/components/ui/SlidingPill";
import { MediaItem } from "@/types/media";
import { mediaApi } from "@/lib/api";
import {
  fetchTrendingMovies,
  fetchTrendingTv,
  fetchTrendingAll,
  fetchTrendingAnime,
  tmdbToMediaItem,
  deduplicateFranchises,
  deduplicateMedia,
} from "@/lib/tmdb";
import { rankAndFilterSearchResults } from "@/lib/catalog-navigation";
import { Search, AlertCircle, Loader2, ChevronDown, Sparkles } from "lucide-react";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const query = searchParams.get("q") || "";
  const urlType = searchParams.get("type") as NavMediaCategory | null;

  // For browse catalog mode
  const browseCategory: NavMediaCategory = urlType || "ALL";

  // For search results filtering
  const [activeFilter, setActiveFilter] = useState<NavMediaCategory>(urlType || "ALL");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync activeFilter when urlType changes
  useEffect(() => {
    setActiveFilter(urlType || "ALL");
  }, [urlType]);

  const getItemKey = (item: MediaItem, index: number) =>
    item.id || (item.externalId ? `${item.mediaType}-${item.externalId}` : `item-${index}`);

  const fetchItems = async (cat: NavMediaCategory, pageToFetch: number): Promise<MediaItem[]> => {
    const searchTerm = query.trim();

    // 1. If explicit search query is provided
    if (searchTerm) {
      // In text search mode, fetch across ALL categories so client-side filter chips have full counts
      const results = await mediaApi.search(searchTerm, "ALL", pageToFetch);
      const deduped = deduplicateMedia(results);
      return rankAndFilterSearchResults(deduped, searchTerm);
    }

    // 2. Browsing trending catalog when search input is blank
    if (pageToFetch === 1) {
      if (cat === "ALL") {
        const trending = await fetchTrendingAll();
        return deduplicateFranchises(trending.map((t) => tmdbToMediaItem(t)));
      } else if (cat === "MOVIE") {
        const movies = await fetchTrendingMovies();
        return deduplicateFranchises(movies.map((m) => tmdbToMediaItem(m, "MOVIE")));
      } else if (cat === "SERIES") {
        const series = await fetchTrendingTv();
        return deduplicateFranchises(series.map((s) => tmdbToMediaItem(s, "SERIES")));
      } else if (cat === "ANIME") {
        const anime = await fetchTrendingAnime();
        const mapped = anime.map((a) => tmdbToMediaItem(a, "SERIES"));
        if (mapped.length < 5) {
          const backendAnime = await mediaApi.search("anime", "ANIME", 1).catch(() => [] as MediaItem[]);
          return deduplicateMedia([...mapped, ...backendAnime]);
        }
        return deduplicateFranchises(mapped);
      } else if (cat === "GAME") {
        const games = await mediaApi.search("popular", "GAME", 1).catch(() => [] as MediaItem[]);
        return deduplicateMedia(games);
      } else if (cat === "BOOK") {
        const books = await mediaApi.search("popular", "BOOK", 1).catch(() => [] as MediaItem[]);
        return deduplicateMedia(books);
      }
    }

    // Secondary pages fallback to backend search
    const fallbackSeed = cat === "ALL" ? "popular" : cat.toLowerCase();
    const results = await mediaApi.search(fallbackSeed, cat === "ALL" ? "ALL" : cat, pageToFetch);
    return deduplicateMedia(results);
  };

  useEffect(() => {
    async function loadResults() {
      setIsLoading(true);
      setError(null);
      setPage(1);
      setHasMore(true);

      try {
        const initialResults = await fetchItems(query.trim() ? "ALL" : browseCategory, 1);
        setItems(initialResults);
        if (initialResults.length === 0) {
          setHasMore(false);
        }
      } catch (err: any) {
        console.error("Search error", err);
        setError("Failed to fetch search results. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    }

    loadResults();
  }, [query, browseCategory]);

  const handleFilterChipClick = (type: NavMediaCategory) => {
    setActiveFilter(type);
    const newParams = new URLSearchParams(window.location.search);
    if (type === "ALL") {
      newParams.delete("type");
    } else {
      newParams.set("type", type);
    }
    const newUrl = newParams.toString() ? `/search?${newParams.toString()}` : "/search";
    window.history.replaceState(null, "", newUrl);
  };

  const handleLoadMore = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;

    try {
      const newItems = await fetchItems(query.trim() ? "ALL" : browseCategory, nextPage);
      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setItems((prevItems) => {
          const existingKeys = new Set(prevItems.map((item, idx) => getItemKey(item, idx)));
          const filteredNew = newItems.filter((item, idx) => !existingKeys.has(getItemKey(item, idx)));
          if (filteredNew.length === 0) {
            setHasMore(false);
          }
          return [...prevItems, ...filteredNew];
        });
        setPage(nextPage);
      }
    } catch (err: any) {
      console.error("Failed to load more media items", err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  // Compute category counts for search mode
  const { totalCount, filterChips, displayedItems } = useMemo(() => {
    if (!query.trim()) {
      return {
        totalCount: items.length,
        filterChips: [],
        displayedItems: items,
      };
    }

    const total = items.length;
    const movieCount = items.filter((i) => i.mediaType === "MOVIE").length;
    const seriesCount = items.filter((i) => i.mediaType === "SERIES").length;
    const animeCount = items.filter((i) => i.mediaType === "ANIME").length;
    const gameCount = items.filter((i) => i.mediaType === "GAME").length;
    const bookCount = items.filter((i) => i.mediaType === "BOOK").length;

    const chips: { key: NavMediaCategory; label: string }[] = [
      { key: "ALL", label: `All ${total}` },
      ...(movieCount > 0 ? [{ key: "MOVIE" as NavMediaCategory, label: `Movies ${movieCount}` }] : []),
      ...(seriesCount > 0 ? [{ key: "SERIES" as NavMediaCategory, label: `Series ${seriesCount}` }] : []),
      ...(animeCount > 0 ? [{ key: "ANIME" as NavMediaCategory, label: `Anime ${animeCount}` }] : []),
      ...(gameCount > 0 ? [{ key: "GAME" as NavMediaCategory, label: `Games ${gameCount}` }] : []),
      ...(bookCount > 0 ? [{ key: "BOOK" as NavMediaCategory, label: `Books ${bookCount}` }] : []),
    ];

    const filtered =
      activeFilter === "ALL"
        ? items
        : items.filter((i) => i.mediaType === activeFilter);

    return {
      totalCount: total,
      filterChips: chips,
      displayedItems: filtered,
    };
  }, [items, query, activeFilter]);

  const getBrowseHeading = (type: string | null) => {
    switch (type) {
      case "MOVIE":
        return "Movies";
      case "SERIES":
        return "Series";
      case "ANIME":
        return "Anime";
      case "GAME":
        return "Games";
      case "BOOK":
        return "Books";
      default:
        return "All Media";
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-zinc-100">
      <main className="w-[calc(100%-48px)] max-w-[1400px] mx-auto px-6 pb-16 flex-1 space-y-6">
        {/* FIX 4: Header & Filter Controls */}
        {query ? (
          /* Text search results: Heading with muted count beside it, plus slim filter chips row */
          <div className="flex flex-col gap-3 pb-3 border-b border-white/[0.06]">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Search results for &ldquo;{query}&rdquo;
              </h1>
              {!isLoading && (
                <span className="text-sm font-normal text-zinc-400">
                  {totalCount} results
                </span>
              )}
            </div>

            {/* ONE slim row of filter chips with counts, hiding types with zero results */}
            {!isLoading && filterChips.length > 0 && (
              <SlidingPill
                variant="filter"
                ariaLabel="Filter results by type"
                className="no-scrollbar pt-1"
                items={filterChips.map((chip) => ({ value: chip.key, label: chip.label }))}
                activeValue={activeFilter}
                onChange={(key) => handleFilterChipClick(key as NavMediaCategory)}
              />
            )}
          </div>
        ) : (
          /* Browse catalog pages: Single heading ("Movies", "Series", etc.) with no subtext and no category row */
          <div className="pb-4 border-b border-white/[0.06]">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {getBrowseHeading(urlType)}
            </h1>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 2:3 Responsive Grid (grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4) */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-[2/3] rounded-xl bg-zinc-900 animate-pulse border border-white/[0.04]" />
                <div className="h-3.5 w-3/4 bg-zinc-800 animate-pulse rounded" />
                <div className="h-3 w-1/2 bg-zinc-800/60 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : displayedItems.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {displayedItems.map((item, index) => (
                <MediaCard key={getItemKey(item, index)} item={item} />
              ))}
            </div>

            {/* Load More Button (only in browse mode) */}
            {!query && hasMore && (
              <div className="mt-12 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isFetchingMore}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-lg hover:border-violet-500/40"
                >
                  {isFetchingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                      <span>Loading More...</span>
                    </>
                  ) : (
                    <>
                      <span>Load More Results</span>
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 bg-zinc-900/30 rounded-2xl border border-white/[0.06] max-w-lg mx-auto">
            <Search className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No media items found</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Try searching with different keywords or selecting another category filter.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen text-zinc-100 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Sparkles className="w-4 h-4 text-violet-400 animate-spin" />
            <span>Loading search catalog...</span>
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
