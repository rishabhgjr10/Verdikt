"use client";

import React, { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, FolderOpen, History, Library as LibraryIcon, Lock, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { buildAuthHref } from "@/lib/auth-redirect";
import { collectionsApi, userMediaApi } from "@/lib/api";
import { CollectionSummary, MediaItem } from "@/types/media";
import { MediaCard } from "@/components/MediaCard";
import { SlidingPill } from "@/components/ui/SlidingPill";
import { GlassButton } from "@/components/GlassButton";
import { GlassConfirmDialog } from "@/components/GlassConfirmDialog";

type Tab = "history" | "later" | "collections";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "history", label: "Watch History", icon: History },
  { key: "later", label: "Watch Later", icon: Clock },
  { key: "collections", label: "Collections", icon: FolderOpen },
];

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-[2/3] rounded-xl bg-zinc-800/70 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-zinc-800/60 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
      <Icon className="w-8 h-8 text-zinc-600 mx-auto mb-3" aria-hidden="true" />
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="text-sm text-zinc-400 mt-1">{body}</p>
      <GlassButton href="/search" variant="neutral" className="mt-5">
        Browse titles
      </GlassButton>
    </div>
  );
}

function MediaGrid({ items, onRemove }: { items: MediaItem[]; onRemove?: (item: MediaItem) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((item) => (
        <div key={item.id} className="space-y-2">
          <MediaCard item={item} />
          {onRemove && (
            <GlassButton
              variant="danger"
              block
              className="h-9 text-xs"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => onRemove(item)}
              aria-label={`Remove ${item.title} from Watch History`}
            >
              Remove
            </GlassButton>
          )}
        </div>
      ))}
    </div>
  );
}

/** Collections (creates Watch History on first visit), Watch Later and Watch History items. */
async function fetchLibrary() {
  const [collections, watchLater] = await Promise.all([collectionsApi.list(), userMediaApi.getWatchLater()]);
  const watchHistory = collections.find((c) => c.systemType === "WATCH_HISTORY");
  const history = watchHistory ? (await collectionsApi.get(watchHistory.id)).items : [];
  return { collections, watchLater, history };
}

export default function LibraryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const tabsId = useId();
  const [tab, setTab] = useState<Tab>("history");
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null);
  const [history, setHistory] = useState<MediaItem[] | null>(null);
  const [later, setLater] = useState<MediaItem[] | null>(null);
  const [openCollection, setOpenCollection] = useState<{ summary: CollectionSummary; items: MediaItem[] | null } | null>(null);
  const [error, setError] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<MediaItem | null>(null);
  const [removing, setRemoving] = useState(false);

  // Library requires login
  useEffect(() => {
    if (!authLoading && !user) router.replace(buildAuthHref("/login", "/library"));
  }, [authLoading, user, router]);

  const applyLibrary = useCallback((data: Awaited<ReturnType<typeof fetchLibrary>>) => {
    setCollections(data.collections);
    setLater(data.watchLater);
    setHistory(data.history);
  }, []);

  const load = useCallback(() => {
    fetchLibrary()
      .then(applyLibrary)
      .catch(() => setError(true));
  }, [applyLibrary]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchLibrary()
      .then((data) => {
        if (!cancelled) applyLibrary(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, applyLibrary]);

  const openUserCollection = async (summary: CollectionSummary) => {
    setOpenCollection({ summary, items: null });
    try {
      const detail = await collectionsApi.get(summary.id);
      setOpenCollection({ summary: detail.collection, items: detail.items });
    } catch {
      setOpenCollection(null);
      showToast("Couldn't open collection", { tone: "error" });
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const result = await userMediaApi.setWatched(removeTarget.id, false);
      setHistory((h) => h?.filter((item) => item.id !== removeTarget.id) ?? h);
      setCollections((cs) =>
        cs?.map((c) =>
          c.systemType === "WATCH_HISTORY"
            ? {
                ...c,
                itemCount: Math.max(0, c.itemCount - 1),
                previewPosters: c.previewPosters.filter((p) => p !== removeTarget.coverImage),
              }
            : c
        ) ?? cs
      );
      showToast("Removed from Watch History", result.deletedReview ? { detail: "Your review was deleted" } : undefined);
      setRemoveTarget(null);
    } catch {
      showToast("Couldn't remove this title", { tone: "error", detail: "Nothing was changed. Please try again." });
      setRemoveTarget(null);
    } finally {
      setRemoving(false);
    }
  };

  if (authLoading || !user) {
    return <main className="w-[calc(100%-48px)] max-w-[1400px] mx-auto pb-16" aria-busy="true" />;
  }

  const userCollections = collections?.filter((c) => !c.isSystem) ?? null;

  return (
    <main className="w-[calc(100%-48px)] max-w-[1400px] mx-auto pb-16 space-y-6">
      <header className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <LibraryIcon className="w-5 h-5 text-violet-300" aria-hidden="true" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Library</h1>
      </header>

      <SlidingPill
        ariaLabel="Library sections"
        className="no-scrollbar"
        tabIdPrefix={tabsId}
        items={TABS.map(({ key, label, icon }) => ({ value: key, label, icon }))}
        activeValue={tab}
        onChange={(key) => {
          setTab(key as Tab);
          setOpenCollection(null);
        }}
      />

      <section id={`${tabsId}-${tab}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`}>
        {error ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center" role="alert">
            <p className="text-sm text-zinc-300">Couldn&apos;t load your library.</p>
            <GlassButton
              variant="neutral"
              className="mt-4"
              onClick={() => {
                setError(false);
                load();
              }}
            >
              Retry
            </GlassButton>
          </div>
        ) : tab === "history" ? (
          history === null ? (
            <GridSkeleton />
          ) : history.length === 0 ? (
            <EmptyState icon={History} title="No watch history yet" body="Mark titles as watched and they'll appear here automatically." />
          ) : (
            <MediaGrid items={history} onRemove={setRemoveTarget} />
          )
        ) : tab === "later" ? (
          later === null ? (
            <GridSkeleton />
          ) : later.length === 0 ? (
            <EmptyState icon={Clock} title="Nothing in Watch Later" body="Save titles you want to get to next." />
          ) : (
            <MediaGrid items={later} />
          )
        ) : openCollection ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <GlassButton
                variant="neutral"
                className="h-9 px-3"
                icon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => setOpenCollection(null)}
                aria-label="Back to collections"
              />
              <h2 className="text-lg font-bold text-white truncate">{openCollection.summary.name}</h2>
              <span className="text-xs text-zinc-500">
                {openCollection.summary.itemCount} {openCollection.summary.itemCount === 1 ? "item" : "items"}
              </span>
            </div>
            {openCollection.items === null ? (
              <GridSkeleton />
            ) : openCollection.items.length === 0 ? (
              <EmptyState icon={FolderOpen} title="This collection is empty" body="Add titles from any media page." />
            ) : (
              <MediaGrid items={openCollection.items} />
            )}
          </div>
        ) : userCollections === null ? (
          <GridSkeleton />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections
              ?.filter((c) => c.isSystem)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTab("history")}
                  className="text-left rounded-3xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
                >
                  <CollectionPreview collection={c} />
                </button>
              ))}
            {userCollections.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openUserCollection(c)}
                className="text-left rounded-3xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
              >
                <CollectionPreview collection={c} />
              </button>
            ))}
            {userCollections.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-2 rounded-3xl border border-dashed border-white/15 px-6 py-10 text-center">
                <FolderOpen className="w-7 h-7 text-zinc-600 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-white">Create your first collection</p>
                <p className="text-xs text-zinc-400 mt-1">Use “Add to Collections” on any media page.</p>
              </div>
            )}
          </div>
        )}
      </section>

      <GlassConfirmDialog
        open={!!removeTarget}
        title="Unwatch Content?"
        description="This action will also delete your submitted review if you have one."
        confirmLabel="Unwatch"
        loading={removing}
        onConfirm={confirmRemove}
        onClose={() => setRemoveTarget(null)}
      />
    </main>
  );
}

function CollectionPreview({ collection }: { collection: CollectionSummary }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex -space-x-6 shrink-0">
        {[0, 1, 2].map((i) => {
          const poster = collection.previewPosters[i];
          return (
            <div
              key={i}
              className="w-14 h-20 rounded-lg border border-white/10 bg-zinc-800/80 overflow-hidden shadow-lg"
              style={{ zIndex: 3 - i }}
            >
              {poster && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
            </div>
          );
        })}
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-bold text-white truncate">
          {collection.name}
          {collection.isSystem && <Lock className="w-3.5 h-3.5 text-zinc-500" aria-label="Managed automatically" />}
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {collection.itemCount} {collection.itemCount === 1 ? "item" : "items"}
        </p>
      </div>
    </div>
  );
}
