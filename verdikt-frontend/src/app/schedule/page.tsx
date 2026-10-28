"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalendarCheck, Calendar, CalendarClock, Megaphone } from "lucide-react";
import { SlidingPill } from "@/components/ui/SlidingPill";
import { PosterImage } from "@/components/PosterImage";
import { mediaApi } from "@/lib/api";
import { todayInIndia } from "@/lib/schedule-dates";
import {
  ScheduleEntry,
  ScheduleMediaFilter,
  ScheduleTimeline,
  fetchEntertainmentSchedule,
} from "@/lib/tmdb";

const TIMELINES: { key: ScheduleTimeline; label: string; icon: React.ElementType }[] = [
  { key: "released", label: "Released", icon: CalendarCheck },
  { key: "today", label: "Today", icon: Calendar },
  { key: "upcoming", label: "Upcoming", icon: CalendarClock },
  { key: "announced", label: "Announced", icon: Megaphone },
];

const MEDIA_FILTERS: { key: ScheduleMediaFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "MOVIE", label: "Movies" },
  { key: "SERIES", label: "Shows" },
  { key: "ANIME", label: "Anime" },
  { key: "BOOK", label: "Books" },
];

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const subtitle = (e: ScheduleEntry) =>
  `${e.type === "MOVIE" ? "In Theatre" : e.type === "BOOK" ? "Book Release" : "New Show"} • ${e.date.slice(0, 4)}`;

/** Books only carry a publication year, so each year is a single group; `date` is that year. */
async function loadBooks(timeline: ScheduleTimeline): Promise<ScheduleEntry[]> {
  const year = new Date().getFullYear();
  const years = { released: [year], today: [year], upcoming: [year, year + 1], announced: [year + 1, year + 2] }[timeline];
  const results = await Promise.all(years.map((y) => mediaApi.search(`new releases ${y}`, "BOOK").catch(() => [])));
  return results.flat().flatMap((b) =>
    b.mediaType === "BOOK" && b.coverImage && b.releaseYear && years.includes(b.releaseYear)
      ? [{ id: b.externalId, type: "BOOK" as const, title: b.title, date: String(b.releaseYear), poster: b.coverImage, popularity: 0 }]
      : []
  );
}

async function loadSchedule(timeline: ScheduleTimeline, filter: ScheduleMediaFilter): Promise<ScheduleEntry[]> {
  const [screen, books] = await Promise.all([
    filter === "BOOK"
      ? []
      : fetchEntertainmentSchedule({ timeline, mediaType: filter }).catch(() => [] as ScheduleEntry[]),
    filter === "ALL" || filter === "BOOK"
      ? loadBooks(timeline).then((b) => (filter === "ALL" ? b.slice(0, 6) : b)).catch(() => [] as ScheduleEntry[])
      : [],
  ]);
  return [...screen, ...books];
}

function groupByDate(entries: ScheduleEntry[]) {
  const groups = new Map<string, ScheduleEntry[]>();
  for (const e of entries) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
  // Year-only (book) groups go after dated ones
  return [...groups.entries()]
    .sort(([a], [b]) => (a.length !== b.length ? b.length - a.length : a.localeCompare(b)))
    .map(([date, items]) => ({ date, items: items.sort((x, y) => y.popularity - x.popularity) }));
}

function DateBadge({ date, isToday }: { date: string; isToday: boolean }) {
  if (date.length === 4) {
    return (
      <div className="w-14 flex-shrink-0 pt-1 text-center sticky top-28 self-start">
        <div className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">Book</div>
        <div className="text-lg font-extrabold text-white leading-none my-0.5 tabular-nums">{date}</div>
      </div>
    );
  }
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return (
    <div className="w-14 flex-shrink-0 pt-1 text-center sticky top-28 self-start">
      <div className={`text-[11px] font-semibold tracking-wider uppercase ${isToday ? "text-violet-300" : "text-zinc-400"}`}>
        {isToday ? "Today" : weekday}
      </div>
      <div className={`text-2xl font-extrabold leading-none my-0.5 tabular-nums ${isToday ? "text-violet-200" : "text-white"}`}>
        {d}
      </div>
      <div className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">{MONTHS[m - 1]}</div>
    </div>
  );
}

function ScheduleView() {
  const params = useSearchParams();
  const timeline = TIMELINES.find((t) => t.key === params.get("tab"))?.key ?? "today";
  const filter = MEDIA_FILTERS.find((f) => f.key === (params.get("type") ?? "").toUpperCase())?.key ?? "ALL";

  const [cache, setCache] = useState<Record<string, ScheduleEntry[]>>({});
  const cacheKey = `${timeline}:${filter}`;
  const entries = cache[cacheKey];

  useEffect(() => {
    if (cache[cacheKey]) return;
    let cancelled = false;
    loadSchedule(timeline, filter).then((result) => {
      if (!cancelled) setCache((c) => ({ ...c, [cacheKey]: result }));
    });
    return () => {
      cancelled = true;
    };
  }, [timeline, filter, cacheKey, cache]);

  // Keep the URL shareable without a navigation
  const setParam = (key: "tab" | "type", value: string) => {
    const next = new URLSearchParams(window.location.search);
    next.set(key, value);
    window.history.replaceState(null, "", `?${next}`);
  };

  const groups = useMemo(() => (entries ? groupByDate(entries) : []), [entries]);
  const today = todayInIndia();

  return (
    <div className="max-w-7xl mx-auto w-full px-6 pt-6 pb-16">
      <div className="flex flex-col md:flex-row gap-6 md:gap-10">
        {/* Timeline sidebar */}
        <aside className="md:w-52 md:flex-shrink-0">
          <SlidingPill
            ariaLabel="Timeline"
            className="md:flex-col md:overflow-visible md:sticky md:top-28"
            items={TIMELINES.map(({ key, label, icon }) => ({ value: key, label, icon }))}
            activeValue={timeline}
            onChange={(key) => setParam("tab", key)}
          />
        </aside>

        {/* Main column */}
        <main className="flex-1 min-w-0">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-white">Schedule</h1>
            <SlidingPill
              variant="filter"
              ariaLabel="Media type"
              items={MEDIA_FILTERS.map(({ key, label }) => ({ value: key, label }))}
              activeValue={filter}
              onChange={(key) => setParam("type", key)}
            />
          </div>

          {!entries ? (
            <div className="space-y-8" aria-busy="true">
              {[0, 1].map((g) => (
                <div key={g} className="flex gap-4">
                  <div className="w-14 flex-shrink-0 h-16 rounded-lg bg-zinc-900/60 animate-pulse" />
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <div className="aspect-[2/3] rounded-xl bg-zinc-900/60 border border-white/5 animate-pulse" />
                        <div className="h-3.5 w-4/5 rounded bg-zinc-800/70 animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-white/5 bg-zinc-900/20">
              <p className="text-sm text-zinc-400">Nothing scheduled here right now.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {groups.map(({ date, items }) => (
                <section key={date} className="flex gap-4" aria-label={date}>
                  <DateBadge date={date} isToday={date === today} />
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {items.map((item) => (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={`/media/external/${item.type}/${encodeURIComponent(item.id)}`}
                        className="group block cursor-pointer"
                      >
                        <PosterImage
                          url={item.poster}
                          title={item.title}
                          mediaType={item.type}
                          releaseYear={item.date.slice(0, 4)}
                          className="poster-lift"
                        >
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
                        </PosterImage>
                        <p className="mt-2 text-sm font-semibold text-white truncate group-hover:text-violet-400 transition-colors">
                          {item.title}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">{subtitle(item)}</p>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={null}>
      <ScheduleView />
    </Suspense>
  );
}
