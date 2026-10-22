"use client";

import { MediaType } from "@/types/media";

export type HomeCategory = "ALL" | MediaType;

interface CategoryTabsProps {
  active: HomeCategory;
  onChange: (cat: HomeCategory) => void;
}

const TABS: { label: string; value: HomeCategory }[] = [
  { label: "All", value: "ALL" },
  { label: "Movies", value: "MOVIE" },
  { label: "Series", value: "SERIES" },
  { label: "Anime", value: "ANIME" },
  { label: "Games", value: "GAME" },
  { label: "Books", value: "BOOK" },
];

export function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-4 pb-6">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={
            active === tab.value
              ? "whitespace-nowrap bg-zinc-800 text-white font-medium px-4 py-1.5 rounded-full text-xs border border-white/10 transition-all cursor-pointer shadow-sm"
              : "whitespace-nowrap text-zinc-400 hover:text-white px-4 py-1.5 rounded-full text-xs transition-colors cursor-pointer"
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
