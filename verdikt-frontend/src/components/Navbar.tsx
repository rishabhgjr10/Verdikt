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
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { GlidePill, useGlider } from "@/components/ui/SlidingPill";

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

/**
 * Where item `index` sits once every label has finished expanding/collapsing. The active pill
 * animates straight there on the same duration and curve as the labels, so pill and buttons
 * move in lockstep instead of the pill chasing a layout that is still changing.
 */
function settledRect(track: HTMLElement, index: number) {
  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
  let x = 0;
  for (const el of track.querySelectorAll<HTMLElement>("[data-nav-index]")) {
    if (!el.offsetParent) continue; // hidden at this breakpoint
    const icon = el.querySelector<HTMLElement>(".nav-icon")?.offsetWidth ?? 0;
    const isTarget = Number(el.dataset.navIndex) === index;
    const w = icon + (isTarget ? (el.querySelector<HTMLElement>(".nav-label-text")?.offsetWidth ?? 0) : 0);
    if (isTarget) return { x, y: 0, w, h: 0 };
    x += w + gap;
  }
  return undefined;
}

const navItemClass = (active: boolean) =>
  `nav-item relative z-10 inline-flex h-9 items-center overflow-hidden rounded-full text-sm select-none cursor-pointer transition-colors duration-200 ${
    active ? "text-white font-medium" : "text-zinc-400 hover:text-white font-medium"
  }`;

function NavItemBody({
  icon: Icon,
  label,
  active,
  dot,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  dot?: boolean;
}) {
  return (
    <>
      <span data-active={active} className="nav-icon relative flex h-9 w-9 shrink-0 items-center justify-center">
        <Icon className="h-[18px] w-[18px]" />
        {dot && <span className="shared-notification-dot" />}
      </span>
      <span data-active={active} className="nav-label">
        <span>
          <span className="nav-label-text inline-block pr-3.5">{label}</span>
        </span>
      </span>
    </>
  );
}

export function Navbar({
  selectedCategory,
  onSelectCategory,
  initialQuery = "",
  initialType,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const authState: "loading" | "in" | "out" = isAuthLoading ? "loading" : user ? "in" : "out";
  const [, startTransition] = useTransition();

  const [panel, setPanel] = useState<"account" | "notifications" | "search" | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [urlType, setUrlType] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const avatarTrigger = useRef<HTMLButtonElement>(null);

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
  const { track: utilTrack, item: utilItem, ...utilGlide } = useGlider<HTMLDivElement>();
  const { track: catTrack, item: catItem, ...catGlide } = useGlider<HTMLElement>();

  // Compute active category (FIX 2: "/" never highlights any category)
  let currentCat: MediaType | null = null;
  if (selectedCategory && selectedCategory !== "ALL") {
    currentCat = selectedCategory;
  } else if (initialType && initialType !== "ALL") {
    currentCat = initialType as MediaType;
  } else if (pathname === "/" || pathname.startsWith("/schedule")) {
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
  const currentCatIndex = categories.findIndex((c) => c.type === currentCat);

  // Right-cluster item that is open or matches the route: 0 Explore, 1 Schedule, 2 Library, 3 Alerts, 4 Search
  const activeNavIndex =
    panel === "notifications" ? 3
    : panel === "search" ? 4
    : pathname === "/" ? 0
    : pathname.startsWith("/schedule") ? 1
    : pathname.startsWith("/library") ? 2
    : pathname.startsWith("/search") ? 4
    : null;
  const [activeNavRect, setActiveNavRect] = useState<ReturnType<typeof settledRect>>();
  useEffect(() => {
    const el = utilTrack.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const next = activeNavIndex === null ? undefined : settledRect(el, activeNavIndex);
      setActiveNavRect((prev) => (prev?.x === next?.x && prev?.w === next?.w ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeNavIndex, authState, utilTrack]);

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
        {/* Frosted glass pills glide behind the hovered and active category (vertical inset lives in navbar.css) */}
        <nav
          ref={catTrack}
          aria-label="Categories"
          className="shared-categories"
          onMouseLeave={() => catGlide.setHover(null)}
        >
          <GlidePill
            glide={catGlide}
            index={catGlide.hover}
            className="shared-category-pill bg-white/[0.06] backdrop-blur-md border border-white/[0.10]"
          />
          <GlidePill
            glide={catGlide}
            index={currentCatIndex >= 0 ? currentCatIndex : null}
            className="shared-category-pill bg-white/[0.10] backdrop-blur-md border border-white/[0.15] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.3)]"
          />
          {categories.map((c, i) => (
            <Link
              key={c.type}
              ref={catItem(i)}
              href={`/search?type=${c.type}`}
              onMouseEnter={() => catGlide.setHover(i)}
              // Same-path navigations (/search?type=A -> B) don't re-run the URL sync effect
              onClick={() => setUrlType(c.type)}
              className="shared-category cursor-pointer outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              aria-current={c.type === currentCat ? "page" : undefined}
            >
              {c.label}
            </Link>
          ))}
        </nav>

        {/* Utility Actions */}
        <div className="shared-utilities">
          <div
            ref={utilTrack}
            className="relative flex items-center gap-1.5"
            onMouseLeave={() => utilGlide.setHover(null)}
          >
            <GlidePill
              glide={utilGlide}
              index={utilGlide.hover}
              className="inset-y-0 bg-white/[0.08] border border-white/[0.12]"
            />
            <GlidePill
              glide={{ rects: [activeNavRect], ready: utilGlide.ready }}
              index={activeNavRect ? 0 : null}
              className="glide-sync inset-y-0 bg-gradient-to-r from-violet-600/90 to-purple-600/90 border border-purple-400/40 shadow-[0_0_20px_rgba(139,92,246,0.4)]"
            />
            <Link
              ref={utilItem(0)}
              data-nav-index={0}
              href="/"
              title="Explore"
              aria-label="Explore"
              aria-current={activeNavIndex === 0 ? "page" : undefined}
              onMouseEnter={() => utilGlide.setHover(0)}
              className={`${navItemClass(activeNavIndex === 0)} shared-desktop`}
            >
              <NavItemBody icon={Compass} label="Explore" active={activeNavIndex === 0} />
            </Link>

            <Link
              ref={utilItem(1)}
              data-nav-index={1}
              href="/schedule"
              title="Schedule"
              aria-label="Schedule"
              aria-current={activeNavIndex === 1 ? "page" : undefined}
              onMouseEnter={() => utilGlide.setHover(1)}
              className={`${navItemClass(activeNavIndex === 1)} shared-desktop`}
            >
              <NavItemBody icon={Calendar} label="Schedule" active={activeNavIndex === 1} />
            </Link>

            {authState === "in" && (
              <>
                <Link
                  ref={utilItem(2)}
                  data-nav-index={2}
                  href="/library"
                  title="Library"
                  aria-label="Library"
                  aria-current={activeNavIndex === 2 ? "page" : undefined}
                  onMouseEnter={() => utilGlide.setHover(2)}
                  className={`${navItemClass(activeNavIndex === 2)} shared-desktop shared-auth-fade`}
                >
                  <NavItemBody icon={Bookmark} label="Library" active={activeNavIndex === 2} />
                </Link>

                <button
                  type="button"
                  ref={utilItem(3)}
                  data-nav-index={3}
                  onMouseEnter={() => utilGlide.setHover(3)}
                  className={`${navItemClass(activeNavIndex === 3)} shared-auth-fade`}
                  aria-label="Notifications"
                  title="Notifications"
                  aria-expanded={panel === "notifications"}
                  onClick={() => setPanel(panel === "notifications" ? null : "notifications")}
                >
                  <NavItemBody icon={Bell} label="Alerts" active={activeNavIndex === 3} dot />
                </button>
              </>
            )}

            <button
              type="button"
              ref={(n) => {
                searchTrigger.current = n;
                utilItem(4)(n);
              }}
              data-nav-index={4}
              onMouseEnter={() => utilGlide.setHover(4)}
              className={navItemClass(activeNavIndex === 4)}
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
              <NavItemBody icon={Search} label="Search" active={activeNavIndex === 4} />
            </button>
          </div>

          {authState === "in" ? (
            <>
              <span className="shared-divider shared-auth-fade" />

              {/* User Avatar */}
              <Button
                ref={avatarTrigger}
                variant="ghost"
                size="icon"
                className={`shared-avatar shared-auth-fade cursor-pointer active:scale-95 transition-all duration-150 ${
                  panel === "account"
                    ? "ring-2 ring-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.85)] brightness-110"
                    : ""
                }`}
                aria-label="User account menu"
                title="Account"
                aria-haspopup="menu"
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
            </>
          ) : (
            // While auth resolves, the logged-out buttons render invisibly so they
            // reserve their exact width; nothing flashes and the capsule never shifts.
            <div
              className={`shared-auth-actions ${authState === "loading" ? "invisible" : "shared-auth-fade"}`}
              aria-hidden={authState === "loading" ? true : undefined}
              inert={authState === "loading" ? true : undefined}
            >
              <Link
                href="/login"
                className="shared-auth-btn shared-signin inline-flex items-center h-10 px-4 rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/15 text-[13px] font-medium whitespace-nowrap transition-colors duration-150"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="shared-auth-btn shared-signup inline-flex items-center h-10 px-4 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[13px] font-semibold whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_18px_rgba(139,92,246,0.4)] transition-colors duration-150"
              >
                Sign up
              </Link>
              <Link
                href="/login"
                className="shared-auth-btn shared-signin-compact relative items-center h-9 px-3 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_14px_rgba(139,92,246,0.35)]"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>

        {/* Account Menu Portal */}
        <ProfileDropdown
          isOpen={panel === "account"}
          onClose={() => setPanel(null)}
          anchorRef={avatarTrigger}
        />

        {/* Notifications Popover */}
        {panel === "notifications" && (
          <div className="shared-menu text-xs text-zinc-400 p-3" role="status">
            No new notifications yet
          </div>
        )}
      </header>

      {/* Dismiss backdrop for menus */}
      {panel === "notifications" && (
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
