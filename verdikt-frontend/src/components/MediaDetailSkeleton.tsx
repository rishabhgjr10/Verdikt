"use client";

import React from "react";
import { Navbar } from "./Navbar";

export function MediaDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col relative overflow-hidden">
      {/* Top Route Progress Bar (nprogress style violet-to-emerald shimmer) */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[2px] w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 animate-pulse shadow-[0_0_12px_rgba(168,85,247,0.8)]" />

      {/* Header */}
      <Navbar />

      {/* Cinematic Skeleton Layout */}
      <div className="max-w-7xl mx-auto px-6 py-10 w-full flex-1 space-y-10">
        {/* Top Hero Banner Skeleton */}
        <div className="relative w-full rounded-2xl border border-white/[0.04] bg-zinc-900/60 p-6 md:p-10 overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Left Poster Aspect Skeleton (aspect-[2/3] w-48) */}
            <div className="aspect-[2/3] w-48 sm:w-56 md:w-64 bg-zinc-800/60 rounded-xl shrink-0 animate-pulse border border-white/5 mx-auto md:mx-0 shadow-lg" />

            {/* Right Side Text Line Skeletons */}
            <div className="flex-1 w-full space-y-4 pt-2">
              {/* Badges Skeleton */}
              <div className="flex gap-2 justify-center md:justify-start">
                <div className="h-6 w-20 bg-zinc-800/80 rounded-full animate-pulse" />
                <div className="h-6 w-16 bg-zinc-800/50 rounded-full animate-pulse" />
              </div>

              {/* Title Skeleton */}
              <div className="h-8 md:h-11 w-3/4 max-w-md bg-zinc-800 rounded-lg animate-pulse mx-auto md:mx-0" />

              {/* Subtitle Line Skeleton (h-6 w-1/3) */}
              <div className="h-4 w-1/3 bg-zinc-800/60 rounded animate-pulse mx-auto md:mx-0" />

              {/* Synopsis Line Skeletons (h-4 w-2/3) */}
              <div className="space-y-2 pt-2 max-w-2xl">
                <div className="h-4 w-full bg-zinc-900 rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-zinc-900 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-zinc-900/70 rounded animate-pulse" />
              </div>

              {/* Platforms Skeleton */}
              <div className="pt-2 flex gap-2 justify-center md:justify-start">
                <div className="h-8 w-24 bg-zinc-900 rounded-lg animate-pulse border border-white/[0.04]" />
                <div className="h-8 w-28 bg-zinc-900 rounded-lg animate-pulse border border-white/[0.04]" />
                <div className="h-8 w-24 bg-zinc-900 rounded-lg animate-pulse border border-white/[0.04]" />
              </div>

              {/* Action Buttons Skeleton */}
              <div className="flex gap-3 pt-4 justify-center md:justify-start">
                <div className="h-11 w-36 bg-zinc-800/80 rounded-xl animate-pulse" />
                <div className="h-11 w-40 bg-purple-900/30 border border-purple-500/20 rounded-xl animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Lower Shelf Skeletons */}
        <div className="space-y-4 pt-2">
          <div className="h-6 w-48 bg-zinc-800/70 rounded animate-pulse" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] w-36 sm:w-44 rounded-xl bg-zinc-900/60 border border-white/[0.04] shrink-0 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
