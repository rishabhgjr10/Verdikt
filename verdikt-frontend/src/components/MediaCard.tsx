"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MediaItem } from "@/types/media";
import { Film, Tv, Sparkles, Gamepad2, BookOpen, Calendar } from "lucide-react";

interface MediaCardProps {
  item: MediaItem;
}

export const MediaCard: React.FC<MediaCardProps> = ({ item }) => {
  const [imgError, setImgError] = useState(false);

  const mediaTypeConfig = {
    MOVIE: { label: "Movie", icon: Film, color: "bg-blue-600/80 text-blue-100" },
    SERIES: { label: "Series", icon: Tv, color: "bg-purple-600/80 text-purple-100" },
    ANIME: { label: "Anime", icon: Sparkles, color: "bg-pink-600/80 text-pink-100" },
    GAME: { label: "Game", icon: Gamepad2, color: "bg-emerald-600/80 text-emerald-100" },
    BOOK: { label: "Book", icon: BookOpen, color: "bg-amber-600/80 text-amber-100" },
  }[item.mediaType] || { label: item.mediaType, icon: Film, color: "bg-slate-600 text-slate-100" };

  const TypeIcon = mediaTypeConfig.icon;

  // Navigation target: use local DB id if present, or route to search/external link
  const cardHref = item.id
    ? `/media/${item.id}`
    : `/media/external/${item.mediaType}/${encodeURIComponent(item.externalId)}`;

  return (
    <Link href={cardHref} className="group block">
      <div className="relative flex flex-col h-full bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:border-violet-500/50 hover:shadow-violet-500/10">
        {/* Cover Image Container */}
        <div className="relative aspect-[2/3] w-full bg-slate-800 overflow-hidden">
          {item.coverImage && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverImage}
              alt={item.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-500">
              <TypeIcon className="w-12 h-12 mb-2 opacity-40" />
              <span className="text-xs text-center font-medium opacity-60">No Cover Available</span>
            </div>
          )}

          {/* Media Type Badge */}
          <div className="absolute top-2.5 left-2.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold backdrop-blur-md shadow-md ${mediaTypeConfig.color}`}
            >
              <TypeIcon className="w-3.5 h-3.5" />
              {mediaTypeConfig.label}
            </span>
          </div>

          {/* Year Badge */}
          {item.releaseYear && (
            <div className="absolute top-2.5 right-2.5">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-slate-950/80 text-slate-300 backdrop-blur-md border border-slate-700/50">
                <Calendar className="w-3 h-3 text-slate-400" />
                {item.releaseYear}
              </span>
            </div>
          )}
        </div>

        {/* Card Content */}
        <div className="flex flex-col flex-1 p-4">
          <h3 className="text-base font-bold text-slate-100 line-clamp-1 group-hover:text-violet-400 transition-colors">
            {item.title}
          </h3>

          {item.description && (
            <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Genres Tags */}
          {item.genresJson && item.genresJson.length > 0 && (
            <div className="mt-auto pt-3 flex flex-wrap gap-1">
              {item.genresJson.slice(0, 2).map((genre, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/50"
                >
                  {genre}
                </span>
              ))}
              {item.genresJson.length > 2 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800/50 text-slate-500">
                  +{item.genresJson.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};
