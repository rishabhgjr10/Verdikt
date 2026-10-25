"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Bookmark,
  Calendar,
  Clock,
  Compass,
  Search,
  User as UserIcon,
  X,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useNav } from "@/context/NavContext";
import { categories, rankAndFilterSearchResults, type MediaType } from "@/lib/catalog-navigation";
import { mediaApi } from "@/lib/api";
import { MediaItem } from "@/types/media";
import { PosterImage } from "@/components/PosterImage";

export type NavMediaCategory = "ALL" | MediaType;

export interface NavbarProps {
  selectedCategory?: NavMediaCategory;
  onSelectCategory?: (category: NavMediaCategory) => void;
  initialQuery?: string;
  initialType?: string;
}

const RECENT_SEARCHES_KEY = "verdikt_recent_searches";

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .slice(0, 8);
    }
  } catch {
    // Graceful fallback if localStorage is blocked
  }
  return [];
}

function persistRecentSearch(term: string): string[] {
  if (typeof window === "undefined") return [];
  const trimmed = term.trim();
  if (!trimmed) return [];
  try {
    const current = loadRecentSearches();
    const filtered = current.filter(
      (item) => item.toLowerCase() !== trimmed.toLowerCase()
    );
    const updated = [trimmed, ...filtered].slice(0, 8);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

function removeRecentSearchItem(term: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const current = loadRecentSearches();
    const updated = current.filter(
      (item) => item.toLowerCase() !== term.toLowerCase()
    );
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

function clearAllRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore error
  }
}

export function Navbar({
  selectedCategory,
  onSelectCategory,
  initialQuery = "",
  initialType,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [, startTransition] = useTransition();

  const [panel, setPanel] = useState<"account" | "notifications" | "search" | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [urlType, setUrlType] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);

  // Search Modal state
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isSearchClosing, setIsSearchClosing] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const syncUrlType = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        setUrlType(params.get("type"));
      }
    };
    syncUrlType();
    window.addEventListener("popstate", syncUrlType);
    return () => window.removeEventListener("popstate", syncUrlType);
  }, [pathname]);

  const { activeCategory } = useNav();

  // Compute active category (FIX 2: "/" never highlights any category)
  let currentCat: MediaType | null = null;
  if (selectedCategory && selectedCategory !== "ALL") {
    currentCat = selectedCategory;
  } else if (initialType && initialType !== "ALL") {
    currentCat = initialType as MediaType;
  } else if (pathname === "/") {
    currentCat = null;
  } else if (pathname === "/search") {
    currentCat = urlType && urlType !== "ALL" ? (urlType as MediaType) : null;
  } else if (pathname.startsWith("/media/external/")) {
    const rawType = pathname.split("/")[3]?.toUpperCase();
    currentCat =
      (rawType && rawType !== "ALL" ? (rawType as MediaType) : null) ||
      (activeCategory && (activeCategory as string) !== "ALL" ? (activeCategory as MediaType) : null) ||
      null;
  } else if (pathname.startsWith("/media/")) {
    currentCat =
      activeCategory && (activeCategory as string) !== "ALL"
        ? (activeCategory as MediaType)
        : null;
  } else if (urlType && urlType !== "ALL") {
    currentCat = urlType as MediaType;
  }

  // Close panels on route change
  useEffect(() => {
    setPanel(null);
    setIsSearchVisible(false);
    setIsSearchClosing(false);
  }, [pathname]);

  // Handle opening / closing search animation
  const openSearchModal = () => {
    setQuery("");
    setActiveIndex(-1);
    setSuggestions([]);
    setIsLoadingSuggestions(false);
    setRecents(loadRecentSearches());
    setPanel("search");
    setIsSearchClosing(false);
    // Microtask / animation frame to trigger enter transition
    requestAnimationFrame(() => {
      setIsSearchVisible(true);
      setTimeout(() => input.current?.focus(), 50);
    });
  };

  const closeSearchModal = () => {
    setIsSearchClosing(true);
    setTimeout(() => {
      setPanel(null);
      setIsSearchVisible(false);
      setIsSearchClosing(false);
      searchTrigger.current?.focus();
    }, 120);
  };

  // Keyboard shortcut listener (Cmd+K / Ctrl+K and /)
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (panel === "search") {
          closeSearchModal();
        } else if (panel) {
          setPanel(null);
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (panel === "search") {
          closeSearchModal();
        } else {
          openSearchModal();
        }
      }
      if (
        event.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        if (panel !== "search") {
          openSearchModal();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [panel]);

  // Live suggestions with 200ms debounce & AbortController
  useEffect(() => {
    if (panel !== "search") return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsLoadingSuggestions(true);

      mediaApi
        .search(trimmed, "ALL", 1, controller.signal)
        .then((items) => {
          if (controller.signal.aborted) return;
          const ranked = rankAndFilterSearchResults(items, trimmed);
          setSuggestions(ranked.slice(0, 6));
          setIsLoadingSuggestions(false);
        })
        .catch((err) => {
          if (
            controller.signal.aborted ||
            err?.name === "CanceledError" ||
            err?.name === "AbortError"
          ) {
            return;
          }
          setSuggestions([]);
          setIsLoadingSuggestions(false);
        });
    }, 200);

    return () => clearTimeout(timer);
  }, [query, panel]);

  const executeSearch = (searchTerm: string) => {
    const term = searchTerm.trim();
    if (!term) return;
    persistRecentSearch(term);
    closeSearchModal();
    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(term)}`);
    });
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    executeSearch(query);
  };

  const handleRemoveRecent = (term: string) => {
    const updated = removeRecentSearchItem(term);
    setRecents(updated);
  };

  const handleClearAllRecents = () => {
    clearAllRecentSearches();
    setRecents([]);
  };

  const isRecentsMode = !query.trim();
  const totalNavItems = isRecentsMode
    ? recents.length
    : suggestions.length > 0
    ? suggestions.length + 1
    : 0;

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (totalNavItems > 0) {
        setActiveIndex((prev) => (prev + 1 >= totalNavItems ? 0 : prev + 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (totalNavItems > 0) {
        setActiveIndex((prev) => (prev - 1 < 0 ? totalNavItems - 1 : prev - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        if (isRecentsMode && activeIndex < recents.length) {
          executeSearch(recents[activeIndex]);
        } else if (!isRecentsMode && activeIndex < suggestions.length) {
          const item = suggestions[activeIndex];
          persistRecentSearch(item.title);
          closeSearchModal();
          router.push(`/media/${item.id}`);
        } else if (!isRecentsMode && activeIndex === suggestions.length) {
          executeSearch(query);
        }
      } else {
        if (query.trim()) {
          executeSearch(query);
        }
      }
    }
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearchModal();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = event.currentTarget.querySelectorAll<HTMLElement>(
      'input, button, [role="option"]'
    );
    const focusable = Array.from(nodes).filter((n) => !n.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <>
      <header
        className="shared-navbar"
        aria-label="Primary Navigation"
        style={{
          backdropFilter: "blur(28px) saturate(150%)",
          WebkitBackdropFilter: "blur(28px) saturate(150%)",
          backgroundColor: "rgba(24, 24, 27, 0.40)",
        }}
      >
        {/* FIX 2: Entire logo is clickable link to "/" */}
        <Link
          href="/"
          className="shared-brand cursor-pointer outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          aria-label="Verdikt Home"
        >
          Verdikt<span>.</span>
        </Link>

        {/* FIX 2: Categories without Home pill */}
        <nav className="shared-categories" aria-label="Categories">
          {categories.map((category) => (
            <Link
              key={category.type}
              href={`/search?type=${category.type}`}
              className="shared-category cursor-pointer outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              aria-current={currentCat === category.type ? "page" : undefined}
            >
              {category.label}
            </Link>
          ))}
        </nav>

        {/* Utility Actions */}
        <div className="shared-utilities">
          <Button asChild variant="ghost" className="shared-explore">
            <Link href="/search" title="Explore">
              <Compass />
              <span>Explore</span>
            </Link>
          </Button>

          <Button asChild variant="ghost" size="icon" className="shared-icon shared-desktop">
            <Link href="/search?type=MOVIE" aria-label="Release Schedule" title="Release Schedule">
              <Calendar />
            </Link>
          </Button>

          <Button asChild variant="ghost" size="icon" className="shared-icon shared-desktop">
            <Link
              href={user ? "/profile" : "/login"}
              aria-label="Watchlist"
              title="Watchlist"
            >
              <Bookmark />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="shared-icon cursor-pointer"
            aria-label="Notifications"
            title="Notifications"
            aria-expanded={panel === "notifications"}
            onClick={() => setPanel(panel === "notifications" ? null : "notifications")}
          >
            <Bell />
            <span className="shared-notification-dot" />
          </Button>

          <Button
            ref={searchTrigger}
            variant="ghost"
            size="icon"
            className="shared-icon cursor-pointer"
            aria-label="Search"
            title="Search (⌘K)"
            aria-expanded={panel === "search"}
            onClick={() => {
              if (panel === "search") {
                closeSearchModal();
              } else {
                openSearchModal();
              }
            }}
          >
            <Search />
          </Button>

          <span className="shared-divider" />

          {/* User Avatar */}
          <Button
            variant="ghost"
            size="icon"
            className="shared-avatar cursor-pointer"
            aria-label="User account menu"
            title="Account"
            aria-expanded={panel === "account"}
            onClick={() => setPanel(panel === "account" ? null : "account")}
          >
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.username || "User"}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <UserIcon />
            )}
          </Button>
        </div>

        {/* Account Menu Popover */}
        {panel === "account" && (
          <div className="shared-menu" role="menu">
            {user ? (
              <>
                <div className="px-2.5 py-1.5 text-xs text-zinc-400 border-b border-white/10 mb-1">
                  Signed in as <span className="font-semibold text-white">{user.username || user.email}</span>
                </div>
                <Link href="/profile" onClick={() => setPanel(null)}>
                  Profile &amp; Watchlist
                </Link>
                <button
                  type="button"
                  className="w-full text-left px-2.5 py-2 text-xs rounded hover:bg-white/10 text-red-400 flex items-center gap-2 cursor-pointer mt-1"
                  onClick={() => {
                    logout();
                    setPanel(null);
                  }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setPanel(null)}>
                  Sign In
                </Link>
                <Link href="/register" onClick={() => setPanel(null)}>
                  Create Account
                </Link>
              </>
            )}
          </div>
        )}

        {/* Notifications Popover */}
        {panel === "notifications" && (
          <div className="shared-menu text-xs text-zinc-400 p-3" role="status">
            No new notifications yet
          </div>
        )}
      </header>

      {/* Dismiss backdrop for menus */}
      {panel && panel !== "search" && (
        <div className="shared-dismiss" onClick={() => setPanel(null)} />
      )}

      {/* FIX 3: Search Modal Overlay with 150ms fade and 180ms ease-out scale/translate */}
      {panel === "search" && (
        <div
          className={`fixed inset-0 z-70 bg-black/60 backdrop-blur-md transition-opacity duration-150 ease-out ${
            isSearchVisible && !isSearchClosing ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeSearchModal}
        >
          <div
            className={`fixed left-1/2 -translate-x-1/2 top-[14vh] w-[min(640px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#121214] shadow-2xl overflow-hidden z-80 transition-[opacity,transform] duration-[180ms] ease-out motion-reduce:transition-opacity motion-reduce:transform-none ${
              isSearchVisible && !isSearchClosing
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 -translate-y-2 scale-[0.98]"
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Search entertainment"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleDialogKeyDown}
          >
            {/* Input Header */}
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10"
            >
              <Search className="w-5 h-5 text-violet-400 shrink-0" />
              <input
                ref={input}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={true}
                aria-controls="search-listbox"
                aria-activedescendant={
                  activeIndex >= 0 ? `search-option-${activeIndex}` : undefined
                }
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Search entertainment..."
                aria-label="Search entertainment"
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActiveIndex(-1);
                    input.current?.focus();
                  }}
                  className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  aria-label="Clear query"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="Close search"
                className="h-8 w-8 text-zinc-400 hover:text-white"
                onClick={closeSearchModal}
              >
                <X className="w-4 h-4" />
              </Button>
            </form>

            {/* Listbox Body */}
            <div
              id="search-listbox"
              role="listbox"
              className="max-h-[60vh] overflow-y-auto no-scrollbar"
            >
              {/* Empty Input State: Recent searches & Quick browse */}
              {isRecentsMode && (
                <div>
                  {recents.length > 0 && (
                    <div className="py-2">
                      <div className="flex items-center justify-between px-4 py-1.5 text-xs text-zinc-400">
                        <span className="font-semibold text-zinc-400">Recent searches</span>
                        <button
                          type="button"
                          onClick={handleClearAllRecents}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="mt-1">
                        {recents.map((item, idx) => (
                          <div
                            key={item + idx}
                            id={`search-option-${idx}`}
                            role="option"
                            aria-selected={activeIndex === idx}
                            onClick={() => executeSearch(item)}
                            className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                              activeIndex === idx
                                ? "bg-white/10 text-white"
                                : "text-zinc-300 hover:bg-white/[0.05]"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                              <span className="truncate">{item}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveRecent(item);
                              }}
                              aria-label={`Remove ${item}`}
                              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Browse Chips */}
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-white/5 bg-black/20 text-xs text-zinc-400">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mr-1">
                      Quick Browse:
                    </span>
                    {categories.map((category) => (
                      <button
                        key={category.type}
                        type="button"
                        className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer text-xs"
                        onClick={() => {
                          closeSearchModal();
                          router.push(`/search?type=${category.type}`);
                        }}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live suggestions while typing */}
              {!isRecentsMode && (
                <div>
                  {/* Loading skeleton for 3 rows */}
                  {isLoadingSuggestions && (
                    <div className="p-3 space-y-2">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/40 animate-pulse"
                        >
                          <div className="w-8 h-12 rounded bg-zinc-800 shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3.5 w-1/2 bg-zinc-800 rounded" />
                            <div className="h-3 w-1/4 bg-zinc-800/60 rounded" />
                          </div>
                          <div className="w-12 h-5 rounded bg-zinc-800/60" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No matches state */}
                  {!isLoadingSuggestions && query.trim().length >= 2 && suggestions.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm text-zinc-400">
                      No matches for &ldquo;<span className="text-white">{query}</span>&rdquo;
                    </div>
                  )}

                  {/* Suggestions list */}
                  {!isLoadingSuggestions && suggestions.length > 0 && (
                    <div className="py-2">
                      {suggestions.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          id={`search-option-${idx}`}
                          role="option"
                          aria-selected={activeIndex === idx}
                          onClick={() => {
                            persistRecentSearch(item.title);
                            closeSearchModal();
                            router.push(`/media/${item.id}`);
                          }}
                          className={`flex items-center gap-3 px-4 py-2 text-sm cursor-pointer transition-colors ${
                            activeIndex === idx
                              ? "bg-white/10 text-white"
                              : "text-zinc-300 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="w-8 h-12 shrink-0 rounded overflow-hidden shadow">
                            <PosterImage
                              url={item.coverImage}
                              title={item.title}
                              mediaType={item.mediaType}
                              releaseYear={item.releaseYear}
                              className="w-full h-full text-[8px]"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate text-sm">
                              {item.title}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {item.releaseYear || "—"}
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-medium px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-white/5">
                            {item.mediaType}
                          </span>
                        </div>
                      ))}

                      {/* Final row: See all results */}
                      <div
                        id={`search-option-${suggestions.length}`}
                        role="option"
                        aria-selected={activeIndex === suggestions.length}
                        onClick={() => executeSearch(query)}
                        className={`flex items-center gap-2 px-4 py-3 text-xs text-violet-400 border-t border-white/5 cursor-pointer font-medium transition-colors ${
                          activeIndex === suggestions.length
                            ? "bg-white/10 text-violet-300"
                            : "hover:bg-white/[0.05]"
                        }`}
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>See all results for &ldquo;{query}&rdquo;</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
