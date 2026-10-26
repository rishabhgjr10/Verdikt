"use client";

import React, { useCallback, useSyncExternalStore } from "react";
import { Flame } from "lucide-react";
import { InterestPeriod } from "@/types/media";
import { PeriodDropdown } from "@/components/PeriodDropdown";
import { MostInterestedList } from "@/components/MostInterested";
import { parsePeriod } from "@/lib/most-interested";

const URL_CHANGE_EVENT = "verdikt:period-change";

const subscribeToHistory = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_CHANGE_EVENT, onChange);
  };
};

/** ?period= from the URL; "WEEK" on the server and during hydration. */
function usePeriodParam(): InterestPeriod {
  return useSyncExternalStore(
    subscribeToHistory,
    () => parsePeriod(new URLSearchParams(window.location.search).get("period")),
    () => "WEEK" as InterestPeriod
  );
}

export default function MostInterestedPage() {
  const period = usePeriodParam();

  // Native replaceState (synced by Next) keeps ?period= shareable without a navigation or refetch of the page
  const changePeriod = useCallback((next: InterestPeriod) => {
    window.history.replaceState(window.history.state, "", `/most-interested?period=${next}`);
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
  }, []);

  return (
    <main className="w-[calc(100%-48px)] max-w-[760px] mx-auto pb-16 space-y-6">
      <header className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 text-orange-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Most Interested</h1>
            <p className="text-xs text-zinc-400 mt-0.5">Titles the community saved to Watch Later most</p>
          </div>
        </div>
        <PeriodDropdown value={period} onChange={changePeriod} />
      </header>

      <MostInterestedList period={period} limit={50} />
    </main>
  );
}
