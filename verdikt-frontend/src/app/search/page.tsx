"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { MediaCard } from "@/components/MediaCard";
import { MediaItem, MediaType } from "@/types/media";
import { mediaApi } from "@/lib/api";
import { Search, AlertCircle, Loader2, ChevronDown } from "lucide-react";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const query = searchParams.get("q") || "";
  const mediaTypeParam = (searchParams.get("type") || "ALL") as MediaType | "ALL";

  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getItemKey = (item: MediaItem, index: number) =>
    item.id || (item.externalId ? `${item.mediaType}-${item.externalId}` : `item-${index}`);

  const fetchItemsForPage = async (pageToFetch: number): Promise<MediaItem[]> => {
    const searchTerm = query.trim();
    if (searchTerm) {
      return await mediaApi.search(searchTerm, mediaTypeParam, pageToFetch);
    } else if (mediaTypeParam === "ALL") {
      const [movies, series, books] = await Promise.all([
        mediaApi.search("Dune", "MOVIE", pageToFetch).catch(() => [] as MediaItem[]),
        mediaApi.search("Breaking Bad", "SERIES", pageToFetch).catch(() => [] as MediaItem[]),
        mediaApi.search("Harry Potter", "BOOK", pageToFetch).catch(() => [] as MediaItem[]),
      ]);
      const merged: MediaItem[] = [];
      const maxPer = 8;
      merged.push(...movies.slice(0, maxPer));
      merged.push(...series.slice(0, maxPer));
      merged.push(...books.slice(0, maxPer));
      return merged;
    } else {
      const seedQueries: Record<string, string> = {
        MOVIE: "Avengers",
        SERIES: "Breaking Bad",
        ANIME: "Naruto",
        GAME: "Zelda",
        BOOK: "Harry Potter",
      };
      const seed = seedQueries[mediaTypeParam] || "popular";
      return await mediaApi.search(seed, mediaTypeParam, pageToFetch);
    }
  };

  useEffect(() => {
    async function performInitialSearch() {
      setIsLoading(true);
      setError(null);
      setPage(1);
      setHasMore(true);

      try {
        const initialResults = await fetchItemsForPage(1);
        setItems(initialResults);
        if (initialResults.length === 0) {
          setHasMore(false);
        }
      } catch (err: any) {
        console.error("Search error", err);
        setError("Failed to fetch search results. Please check your backend connection.");
      } finally {
        setIsLoading(false);
      }
    }

    performInitialSearch();
  }, [query, mediaTypeParam]);

  const handleLoadMore = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;

    try {
      const newItems = await fetchItemsForPage(nextPage);
      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setItems((prevItems) => {
          const existingKeys = new Set(
            prevItems.map((item, idx) => getItemKey(item, idx))
          );
          const filteredNew = newItems.filter(
            (item, idx) => !existingKeys.has(getItemKey(item, idx))
          );
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

  const categoryLabels: Record<string, string> = {
    ALL: "All Media",
    MOVIE: "Movies",
    SERIES: "Series",
    ANIME: "Anime",
    GAME: "Games",
    BOOK: "Books",
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar initialQuery={query} initialType={mediaTypeParam} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
        {/* Header Summary */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-900">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
              {query ? (
                <>
                  Search Results for <span className="text-violet-400">&ldquo;{query}&rdquo;</span>
                </>
              ) : mediaTypeParam !== "ALL" ? (
                <>
                  Browse <span className="text-violet-400">{categoryLabels[mediaTypeParam] || mediaTypeParam}</span>
                </>
              ) : (
                "Trending Across All Media"
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Showing results filtered by <span className="font-semibold text-slate-300">{categoryLabels[mediaTypeParam] || mediaTypeParam}</span>
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 mb-8 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Results Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-slate-900 animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {items.map((item, index) => (
                <MediaCard key={getItemKey(item, index)} item={item} />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="mt-12 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isFetchingMore}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-sm font-bold shadow-lg transition-all disabled:opacity-50"
                >
                  {isFetchingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                      <span>Loading More...</span>
                    </>
                  ) : (
                    <>
                      <span>Load More Results</span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 bg-slate-900/40 rounded-2xl border border-slate-800 max-w-lg mx-auto">
            <Search className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-200">No media items found</h3>
            <p className="mt-1 text-xs text-slate-400">
              Try searching with different keywords or switching media categories.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
