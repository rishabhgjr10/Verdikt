"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { MediaType } from "@/types/media";
import {
  Search, Sparkles, LogOut, User as UserIcon,
  Film, Tv, Gamepad2, BookOpen, Menu, X,
} from "lucide-react";

interface NavbarProps {
  initialQuery?: string;
  initialType?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  initialQuery = "",
  initialType = "ALL",
}) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState<string>(initialType);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}&type=${selectedType}`);
  };

  const categories: {
    label: string;
    value: MediaType | "ALL";
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { label: "All",    value: "ALL",    icon: Sparkles  },
    { label: "Movies", value: "MOVIE",  icon: Film      },
    { label: "Series", value: "SERIES", icon: Tv        },
    { label: "Anime",  value: "ANIME",  icon: Sparkles  },
    { label: "Games",  value: "GAME",   icon: Gamepad2  },
    { label: "Books",  value: "BOOK",   icon: BookOpen  },
  ];

  const handleCategoryClick = (value: MediaType | "ALL") => {
    setSelectedType(value);
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    params.set("type", value);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Main navbar row ── */}
        <div className="flex items-center justify-between h-16 gap-4">

          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
              Verdikt<span className="text-violet-500">.</span>
            </span>
          </Link>

          {/* ── CENTER SLOT ──
              Homepage  → Category filter tabs (centered)
              Elsewhere → Search bar (flex-1)
          */}
          {isHomePage ? (
            /* Category tabs — centered in the navbar row */
            <nav className="hidden md:flex flex-1 items-center justify-center gap-1">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = selectedType === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => handleCategoryClick(cat.value)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-violet-600/20 text-violet-300 border border-violet-500/40 shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cat.label}
                  </button>
                );
              })}
            </nav>
          ) : (
            /* Search bar — takes center flex space */
            <form
              onSubmit={handleSearchSubmit}
              className="hidden md:flex flex-1 max-w-xl items-center relative"
            >
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search movies, anime, games, books..."
                  className="w-full pl-10 pr-24 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                >
                  Search
                </button>
              </div>
            </form>
          )}

          {/* User Auth Navigation */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt={user.username} className="w-6 h-6 rounded-full bg-slate-800" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-violet-400" />
                  )}
                  <span className="text-sm font-semibold text-slate-200">{user.username}</span>
                </div>
                <button
                  onClick={logout}
                  title="Logout"
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-600/20 transition-all"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* ── Mobile Dropdown ── */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800 space-y-4 animate-fade-in">

            {/* Search — only on non-homepage */}
            {!isHomePage && (
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search media..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-violet-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </form>
            )}

            {/* Category tabs — always visible on mobile */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => {
                    handleCategoryClick(cat.value);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium ${
                    selectedType === cat.value
                      ? "bg-violet-600 text-white"
                      : "bg-slate-900 text-slate-400 border border-slate-800"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-900">
              {user ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">
                    Signed in as {user.username}
                  </span>
                  <button onClick={logout} className="text-xs text-rose-400 font-semibold">
                    Logout
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    className="text-center py-2 rounded-xl bg-slate-900 text-slate-300 text-sm font-medium border border-slate-800"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="text-center py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
