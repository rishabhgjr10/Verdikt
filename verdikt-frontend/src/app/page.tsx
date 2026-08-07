"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { MediaCard } from "@/components/MediaCard";
import { MediaItem, MediaType } from "@/types/media";
import { mediaApi } from "@/lib/api";
import { Search, Sparkles, Film, TrendingUp, ShieldCheck, Flame, Loader2, ChevronDown } from "lucide-react";
import { StatusUpdates } from "@/components/StatusUpdates";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<MediaType | "ALL">("ALL");
  const [featuredItems, setFeaturedItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const getItemKey = (item: MediaItem, index: number) =>
    item.id || (item.externalId ? `${item.mediaType}-${item.externalId}` : `item-${index}`);

  const fetchItemsForPage = async (pageToFetch: number): Promise<MediaItem[]> => {
    if (selectedType === "ALL") {
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
      const seedQuery = seedQueries[selectedType] || "popular";
      return await mediaApi.search(seedQuery, selectedType, pageToFetch);
    }
  };

  useEffect(() => {
    async function loadFeatured() {
      setIsLoading(true);
      setPage(1);
      setHasMore(true);
      try {
        const results = await fetchItemsForPage(1);
        setFeaturedItems(results);
        if (results.length === 0) {
          setHasMore(false);
        }
      } catch (e) {
        console.error("Failed to load featured media", e);
        setFeaturedItems([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadFeatured();
  }, [selectedType]);

  const handleLoadMore = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;

    try {
      const newItems = await fetchItemsForPage(nextPage);
      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setFeaturedItems((prevItems) => {
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
    } catch (e) {
      console.error("Failed to load more home items", e);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}&type=${selectedType}`);
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
      <Navbar />

      {/* System Status / Announcement Banner */}
      <StatusUpdates variant="announcement" />

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-32 overflow-hidden border-b border-slate-900">
        {/* Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-violet-600/20 to-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-950/80 border border-violet-500/30 text-violet-300 text-xs font-semibold shadow-lg shadow-violet-900/20 mb-6 backdrop-blur-md">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>The Unified Social Verdict Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100 leading-[1.15]">
            One Place for Your Verdicts on{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-pink-400 to-amber-300">
              Movies, Games, Anime & Books.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Stop switching between IMDb, IGDB, and Goodreads. Search millions of titles, give instant 4-tier verdicts, and share reviews with spoiler protection.
          </p>

          {/* Hero Search Bar */}
          <form onSubmit={handleHeroSearch} className="mt-10 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row p-2 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search any movie, anime, game, or book..."
                  className="w-full pl-11 pr-4 py-3.5 bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none"
                />
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as MediaType | "ALL")}
                  className="px-3.5 py-3.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-slate-200 text-xs font-semibold focus:outline-none"
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value} className="bg-slate-900 text-slate-200">
                      {label}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-600/30 transition-all shrink-0"
                >
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Featured / Trending Section */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">
                {selectedType === "ALL" ? "Trending Across All Media" : `Trending ${categoryLabels[selectedType] || "Media"}`}
              </h2>
              <p className="text-xs text-slate-400">
                {selectedType === "ALL"
                  ? "Discover popular titles across movies, series, and books"
                  : `Showing popular ${categoryLabels[selectedType]?.toLowerCase() || "items"}`}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-slate-900 animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : featuredItems.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {featuredItems.map((item, index) => (
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
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800">
            <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">Use the search bar above to explore any movie, anime, game, or book.</p>
          </div>
        )}
      </section>

      {/* Feature Callouts */}
      <section className="py-16 bg-slate-900/50 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">4-Tier Verdict System</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Rate content effortlessly with Perfection, Go For It, Timepass, or Skip It without complicated 10-point scale confusion.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mb-4">
              <Film className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Unified Search API</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Seamlessly query TMDB, IGDB, and Google Books simultaneously with on-demand local database caching.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Spoiler Protection</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Read community verdicts safely. Spoilers are automatically blurred until you explicitly choose to reveal them.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>© 2026 Verdikt. Built with Spring Boot 3.4 & Next.js App Router.</p>
      </footer>
    </div>
  );
}
