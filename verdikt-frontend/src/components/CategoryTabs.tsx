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
    <div className="flex items-center gap-2 mb-8 overflow-x-auto no-scrollbar py-1">
      {TABS.map((tab) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer select-none ${
              isActive
                ? "bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.25)] font-semibold"
                : "bg-transparent text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
