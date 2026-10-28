"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Library, LogIn, LogOut, User as UserIcon, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface ProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export function ProfileDropdown({ isOpen, onClose, anchorRef }: ProfileDropdownProps) {
  const { user, logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([]);

  // Mount flag for SSR safety
  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute position synchronously before paint using getBoundingClientRect
  const updatePosition = () => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const right = Math.max(16, window.innerWidth - rect.right);
    const top = rect.bottom + 12;
    setPosition({ top, right });
  };

  useIsomorphicLayoutEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      updatePosition();
      setFocusedIndex(0);
    }
  }, [isOpen]);

  // Focus the first item on open
  useEffect(() => {
    if (isOpen && !isClosing && position) {
      const timer = setTimeout(() => {
        itemRefs.current[0]?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isClosing, position]);

  // Recompute position on resize and scroll
  useEffect(() => {
    if (!isOpen || !mounted) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, mounted]);

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setPosition(null);
    }, 120);
  };

  // Outside click listener
  useEffect(() => {
    if (!isOpen || isClosing) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        requestClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen, isClosing]);

  // Focusable items count: signed in = Profile, Library, Sign out; signed out = Sign in, Create account
  const itemsCount = user ? 3 : 2;

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      requestClose();
      anchorRef.current?.focus();
      return;
    }

    if (e.key === "Tab") {
      requestClose();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (focusedIndex + 1) % itemsCount;
      setFocusedIndex(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (focusedIndex - 1 + itemsCount) % itemsCount;
      setFocusedIndex(prev);
      itemRefs.current[prev]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedIndex(0);
      itemRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusedIndex(itemsCount - 1);
      itemRefs.current[itemsCount - 1]?.focus();
    }
  };

  // Do not render until mounted, open, and position is strictly known (no flash at bottom)
  if (!mounted || !isOpen || !position) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="User account menu"
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        top: `${position.top}px`,
        right: `${position.right}px`,
        width: "220px",
        minWidth: "200px",
        maxWidth: "calc(100vw - 32px)",
        zIndex: 60,
        backdropFilter: "blur(64px) saturate(150%)",
        WebkitBackdropFilter: "blur(64px) saturate(150%)",
        backgroundColor: "rgba(24, 24, 27, 0.40)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        boxShadow:
          "inset 0 1px 1px rgba(255, 255, 255, 0.25), 0 16px 48px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.15)",
        borderRadius: "24px",
        padding: "8px",
        transformOrigin: "top right",
      }}
      className={`overflow-hidden outline-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent transition-[opacity,transform] motion-reduce:transition-none motion-reduce:transform-none ${
        isClosing
          ? "duration-120 ease-in opacity-0 scale-95 -translate-y-1.5"
          : "duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] opacity-100 scale-100 translate-y-0"
      }`}
    >
      {user ? (
        <>
          {/* User Header Row */}
          <div className="px-3 py-2 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0 border border-white/10 flex items-center justify-center">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.username || "User"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-4 h-4 text-zinc-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">
                {user.username || "User"}
              </div>
              <div className="text-[11px] text-zinc-400 truncate">
                {user.email}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10 my-1 mx-1" role="separator" />

          {/* Profile: reviews, collections and settings */}
          <Link
            href="/profile"
            role="menuitem"
            tabIndex={focusedIndex === 0 ? 0 : -1}
            ref={(el) => {
              itemRefs.current[0] = el;
            }}
            onClick={requestClose}
            className="w-full rounded-2xl px-3 py-2.5 text-zinc-200 hover:bg-white/10 hover:text-white flex items-center gap-2.5 text-xs font-medium cursor-pointer transition-all duration-200 outline-none focus-visible:bg-white/10 focus-visible:text-white"
          >
            <UserIcon className="w-4 h-4 text-zinc-400" />
            <span>Profile</span>
          </Link>

          {/* Library: Watch History, Watch Later, Collections */}
          <Link
            href="/library"
            role="menuitem"
            tabIndex={focusedIndex === 1 ? 0 : -1}
            ref={(el) => {
              itemRefs.current[1] = el;
            }}
            onClick={requestClose}
            className="w-full rounded-2xl px-3 py-2.5 text-zinc-200 hover:bg-white/10 hover:text-white flex items-center gap-2.5 text-xs font-medium cursor-pointer transition-all duration-200 outline-none focus-visible:bg-white/10 focus-visible:text-white"
          >
            <Library className="w-4 h-4 text-zinc-400" />
            <span>Library</span>
          </Link>

          {/* Sign Out Action */}
          <button
            type="button"
            role="menuitem"
            tabIndex={focusedIndex === 2 ? 0 : -1}
            ref={(el) => {
              itemRefs.current[2] = el;
            }}
            onClick={() => {
              logout();
              requestClose();
            }}
            className="w-full rounded-2xl px-3 py-2.5 text-zinc-300 hover:bg-red-500/15 hover:text-red-300 flex items-center gap-2.5 text-xs font-medium cursor-pointer transition-all duration-200 outline-none focus-visible:bg-red-500/15 focus-visible:text-red-300"
          >
            <LogOut className="w-4 h-4 text-zinc-400" />
            <span>Sign out</span>
          </button>
        </>
      ) : (
        <>
          {/* Sign In Item (Primary with subtle violet tint) */}
          <Link
            href="/login"
            role="menuitem"
            tabIndex={focusedIndex === 0 ? 0 : -1}
            ref={(el) => {
              itemRefs.current[0] = el;
            }}
            onClick={requestClose}
            className="rounded-2xl px-3 py-2.5 text-violet-200 bg-violet-600/15 border border-violet-500/20 hover:bg-violet-600/25 hover:text-white flex items-center gap-2.5 text-xs font-medium cursor-pointer transition-all duration-200 outline-none focus-visible:bg-violet-600/25 focus-visible:text-white"
          >
            <LogIn className="w-4 h-4 text-violet-300" />
            <span>Sign in</span>
          </Link>

          {/* Create Account Item */}
          <Link
            href="/register"
            role="menuitem"
            tabIndex={focusedIndex === 1 ? 0 : -1}
            ref={(el) => {
              itemRefs.current[1] = el;
            }}
            onClick={requestClose}
            className="rounded-2xl px-3 py-2.5 text-zinc-200 hover:bg-white/10 hover:text-white flex items-center gap-2.5 text-xs font-medium cursor-pointer transition-all duration-200 outline-none focus-visible:bg-white/10 focus-visible:text-white mt-1"
          >
            <UserPlus className="w-4 h-4 text-zinc-400" />
            <span>Create account</span>
          </Link>
        </>
      )}
    </div>,
    document.body
  );
}

export default ProfileDropdown;
