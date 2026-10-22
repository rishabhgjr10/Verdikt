"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { MediaType } from "@/types/media";
import {
  Compass,
  ChevronDown,
  Calendar,
  Bookmark,
  LayoutGrid,
  Bell,
  Search,
  User as UserIcon,
  Sparkles,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  LogOut,
  X,
  Check,
} from "lucide-react";

export type NavMediaCategory = "ALL" | MediaType;

interface NavbarProps {
  selectedCategory?: NavMediaCategory;
  onSelectCategory?: (category: NavMediaCategory) => void;
  initialQuery?: string;
  initialType?: string;
}

const CATEGORIES: {
  label: string;
  value: NavMediaCategory;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { label: "All", value: "ALL", icon: Sparkles },
  { label: "Movies", value: "MOVIE", icon: Film },
  { label: "Series", value: "SERIES", icon: Tv },
  { label: "Anime", value: "ANIME", icon: Sparkles },
  { label: "Games", value: "GAME", icon: Gamepad2 },
  { label: "Books", value: "BOOK", icon: BookOpen },
];

export const Navbar: React.FC<NavbarProps> = ({
  selectedCategory: explicitCategory,
  onSelectCategory,
  initialQuery = "",
  initialType,
}) => {
  const selectedCategory = explicitCategory || (initialType as NavMediaCategory) || "ALL";

  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  // Dropdown & Modal states
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchModalOpen(false);
        setDropdownOpen(false);
        setUserMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when search modal opens
  useEffect(() => {
    if (searchModalOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchModalOpen]);

  const handleCategorySelect = (cat: NavMediaCategory) => {
    setDropdownOpen(false);
    if (onSelectCategory) {
      onSelectCategory(cat);
    } else {
      if (cat === "ALL") {
        router.push("/search");
      } else {
        router.push(`/search?type=${cat}`);
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchModalOpen(false);
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const currentCategoryLabel =
    CATEGORIES.find((c) => c.value === selectedCategory)?.label || "All";

  return (
    <>
      <header className="sticky top-0 z-50 w-full h-16 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* ── Left: Brand Typography ── */}
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-zinc-200 transition-colors">
              Verdikt<span className="text-violet-500">.</span>
            </span>
          </Link>

          {/* ── Right Group ── */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 1. Primary Action ("Explore") with organic gradient indicator */}
            <Link
              href="/"
              className={`h-9 px-3.5 flex items-center gap-2 text-xs font-medium rounded-lg border transition-all relative ${
                isHomePage
                  ? "bg-white/5 border-white/10 text-white"
                  : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Compass className="w-4 h-4 text-violet-400" />
              <span>Explore</span>
              {isHomePage && (
                <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 h-[2px] w-3/4 rounded-full bg-gradient-to-r from-transparent via-purple-500 to-transparent shadow-[0_4px_12px_rgba(168,85,247,0.4)]" />
              )}
            </Link>

            {/* 2. Media Type Dropdown / Quick Filter */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="h-9 px-3.5 flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-all cursor-pointer"
                aria-expanded={dropdownOpen}
                aria-haspopup="listbox"
              >
                <span className="text-zinc-500 text-[11px] hidden sm:inline">Media:</span>
                <span className="text-white font-semibold">{currentCategoryLabel}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                    dropdownOpen ? "rotate-180 text-violet-400" : ""
                  }`}
                />
              </button>

              {/* Popover Menu */}
              {dropdownOpen && (
                <div className="absolute top-full mt-2.5 right-0 sm:left-0 w-44 rounded-xl bg-[#121215] border border-white/10 shadow-2xl p-1.5 z-50 backdrop-blur-xl space-y-0.5 animate-fade-in">
                  <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 border-b border-white/[0.06] mb-1">
                    Filter Media
                  </div>
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategory === cat.value;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => handleCategorySelect(cat.value)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                          isSelected
                            ? "bg-purple-500/15 text-purple-200 border border-purple-500/30"
                            : "text-zinc-400 hover:text-white hover:bg-white/[0.05] border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 opacity-80" />
                          <span>{cat.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-violet-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Secondary Action Icons (w-5 h-5, stroke 1.75px, p-2 rounded-lg) */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {/* Calendar (Upcoming releases) */}
              <Link
                href="/search?type=MOVIE"
                title="Release Schedule"
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-colors hidden sm:flex items-center justify-center"
              >
                <Calendar className="w-5 h-5" strokeWidth={1.75} />
              </Link>

              {/* Bookmark (Saved / Watchlist) */}
              <Link
                href={user ? "/profile" : "/login"}
                title="Watchlist"
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-colors hidden sm:flex items-center justify-center"
              >
                <Bookmark className="w-5 h-5" strokeWidth={1.75} />
              </Link>

              {/* LayoutGrid (Browse Genres / Categories) */}
              <Link
                href="/search"
                title="Browse Genres"
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-colors hidden md:flex items-center justify-center"
              >
                <LayoutGrid className="w-5 h-5" strokeWidth={1.75} />
              </Link>

              {/* Bell (Alerts / Notifications) */}
              <button
                type="button"
                title="Notifications"
                onClick={() => alert("No new notifications at this time.")}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-colors relative flex items-center justify-center"
              >
                <Bell className="w-5 h-5" strokeWidth={1.75} />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-violet-500 rounded-full ring-2 ring-[#09090b]" />
              </button>

              {/* Search (Command Palette ⌘K) */}
              <button
                type="button"
                onClick={() => setSearchModalOpen(true)}
                title="Search (⌘K)"
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-colors flex items-center justify-center group"
              >
                <Search className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            {/* 4. Profile Avatar (h-8 w-8 rounded-full border border-white/15) */}
            <div className="relative ml-1 sm:ml-2" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="h-8 w-8 rounded-full border border-white/15 overflow-hidden bg-zinc-800 flex items-center justify-center hover:border-white/30 transition-all cursor-pointer shadow-sm"
                aria-label="User account menu"
              >
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-4 h-4 text-zinc-400" />
                )}
              </button>

              {/* User Menu Popover */}
              {userMenuOpen && (
                <div className="absolute top-full mt-2.5 right-0 w-48 rounded-xl bg-[#121215] border border-white/10 shadow-2xl p-1.5 z-50 backdrop-blur-xl animate-fade-in space-y-1">
                  {user ? (
                    <>
                      <div className="px-3 py-2 border-b border-white/[0.06]">
                        <p className="text-xs font-semibold text-white truncate">
                          {user.username}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate">
                          {user.email || "Member"}
                        </p>
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors"
                      >
                        <UserIcon className="w-3.5 h-3.5" />
                        <span>Profile & Reviews</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white bg-violet-600/80 hover:bg-violet-600 font-semibold transition-colors justify-center"
                      >
                        <span>Sign In</span>
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors justify-center"
                      >
                        <span>Create Account</span>
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Command Palette (⌘K) Search Modal ── */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-[#121215] border border-white/10 shadow-2xl overflow-hidden">
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08]"
            >
              <Search className="w-5 h-5 text-violet-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, series, anime, books, games... (Press Enter)"
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
              />
              <span className="text-[10px] text-zinc-500 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded shrink-0">
                ESC
              </span>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </form>

            <div className="p-3 text-xs text-zinc-400 space-y-1">
              <p className="px-2 py-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                Quick Actions
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchModalOpen(false);
                  router.push("/search?type=MOVIE");
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-white/[0.05] text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-violet-400" />
                  <span>Explore Trending Movies</span>
                </div>
                <span className="text-[11px] text-zinc-500">Movies</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSearchModalOpen(false);
                  router.push("/search?type=SERIES");
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-white/[0.05] text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-violet-400" />
                  <span>Explore Top Series</span>
                </div>
                <span className="text-[11px] text-zinc-500">Series</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
