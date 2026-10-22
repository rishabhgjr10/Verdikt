"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar, NavMediaCategory } from "@/components/Navbar";
import { MediaCard } from "@/components/MediaCard";
import { MediaItem, MediaType } from "@/types/media";
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
import { Search, AlertCircle, Loader2, ChevronDown, Sparkles } from "lucide-react";

const CATEGORY_TABS: { label: string; value: NavMediaCategory }[] = [
  { label: "All", value: "ALL" },
  { label: "Movies", value: "MOVIE" },
  { label: "Series", value: "SERIES" },
  { label: "Anime", value: "ANIME" },
  { label: "Games", value: "GAME" },
  { label: "Books", value: "BOOK" },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const query = searchParams.get("q") || "";
  const initialCategory = (searchParams.get("type") || "ALL") as NavMediaCategory;

  const [selectedCategory, setSelectedCategory] = useState<NavMediaCategory>(initialCategory);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state if URL param changes
  useEffect(() => {
    const urlType = searchParams.get("type") as NavMediaCategory;
    if (urlType && urlType !== selectedCategory) {
      setSelectedCategory(urlType);
    }
  }, [searchParams]);

  const getItemKey = (item: MediaItem, index: number) =>
    item.id || (item.externalId ? `${item.mediaType}-${item.externalId}` : `item-${index}`);

  const fetchItems = async (cat: NavMediaCategory, pageToFetch: number): Promise<MediaItem[]> => {
    const searchTerm = query.trim();

    // 1. If explicit search query is provided
    if (searchTerm) {
      const typeParam = cat === "ALL" ? "ALL" : cat;
      const results = await mediaApi.search(searchTerm, typeParam, pageToFetch);
      return deduplicateMedia(results);
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
        const initialResults = await fetchItems(selectedCategory, 1);
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
  }, [query, selectedCategory]);

  const handleCategoryClick = (cat: NavMediaCategory) => {
    setSelectedCategory(cat);
    // Update URL query parameters smoothly without page reload
    const newParams = new URLSearchParams(searchParams.toString());
    if (cat === "ALL") {
      newParams.delete("type");
    } else {
      newParams.set("type", cat);
    }
    const targetUrl = newParams.toString() ? `/search?${newParams.toString()}` : "/search";
    router.replace(targetUrl, { scroll: false });
  };

  const handleLoadMore = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;

    try {
      const newItems = await fetchItems(selectedCategory, nextPage);
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

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100">
      <Navbar
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategoryClick}
        initialQuery={query}
      />

      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {query ? (
                <>
                  Search Results for <span className="text-violet-400">&ldquo;{query}&rdquo;</span>
                </>
              ) : (
                "Browse Media Catalog"
              )}
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              {isLoading ? (
                "Scanning catalog..."
              ) : (
                <span>
                  {items.length} titles found across{" "}
                  <span className="text-zinc-300 font-medium capitalize">
                    {selectedCategory === "ALL" ? "All Categories" : selectedCategory.toLowerCase()}
                  </span>
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Category Filter Pills Directly Underneath Header */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {CATEGORY_TABS.map((tab) => {
            const isActive = selectedCategory === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => handleCategoryClick(tab.value)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-zinc-800 text-white border border-white/10 shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

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
        ) : items.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
              Try searching with different keywords or choosing another category filter.
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
        <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center">
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
