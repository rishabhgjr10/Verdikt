"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/lib/use-is-client";
import { Check, FolderPlus, Loader2, Lock, X } from "lucide-react";
import { collectionsApi } from "@/lib/api";
import { CollectionSummary } from "@/types/media";
import { GlassButton } from "@/components/GlassButton";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useToast } from "@/context/ToastContext";

export interface CollectionsSheetProps {
  open: boolean;
  onClose: () => void;
  mediaId: string;
  mediaTitle: string;
  watched: boolean;
  /** Ids of the user's collections that already contain the item (from GET /media/{id}/me). */
  collectionIds: string[];
  /** Called with the user's collection ids that now contain the item. */
  onCollectionsChange?: (collectionIds: string[]) => void;
  /** Stacking layer; raise it when the sheet opens over another modal */
  layerClassName?: string;
}

const MAX_NAME = 60;

function errorMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.length < 160 ? message : fallback;
}

/**
 * Glass modal (centered on desktop, bottom sheet on mobile) to toggle the item in
 * the user's collections or create a new one. Watch History is shown locked.
 */
export function CollectionsSheet({ open, onClose, mediaId, mediaTitle, watched, collectionIds, onCollectionsChange, layerClassName = "z-[80]" }: CollectionsSheetProps) {
  const { showToast } = useToast();
  const mounted = useIsClient();
  // The parent mounts the sheet fresh on every open, so initial state is the snapshot at open time.
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null);
  const [memberOf, setMemberOf] = useState<Set<string>>(() => new Set(collectionIds));
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const inputId = useId();
  const lockHintId = useId();
  useFocusTrap(panelRef, open, onClose);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    collectionsApi
      .list()
      .then((list) => {
        if (!cancelled) setCollections(list);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mediaId]);

  const publish = (next: Set<string>) => {
    setMemberOf(next);
    onCollectionsChange?.(Array.from(next));
  };

  const toggle = async (collection: CollectionSummary) => {
    if (collection.isSystem || pending.has(collection.id)) return;
    const wasMember = memberOf.has(collection.id);
    const previous = new Set(memberOf);
    const next = new Set(memberOf);
    if (wasMember) next.delete(collection.id);
    else next.add(collection.id);
    publish(next);
    setCollections((cs) => cs?.map((c) => (c.id === collection.id ? { ...c, itemCount: c.itemCount + (wasMember ? -1 : 1) } : c)) ?? cs);
    setPending((p) => new Set(p).add(collection.id));
    try {
      if (wasMember) await collectionsApi.removeItem(collection.id, mediaId);
      else await collectionsApi.addItem(collection.id, mediaId);
    } catch (err) {
      publish(previous);
      setCollections((cs) => cs?.map((c) => (c.id === collection.id ? { ...c, itemCount: collection.itemCount } : c)) ?? cs);
      showToast("Couldn't update collection", { tone: "error", detail: errorMessage(err, "Please try again.") });
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(collection.id);
        return n;
      });
    }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || name.length > MAX_NAME) {
      setNameError(`Name must be 1-${MAX_NAME} characters.`);
      return;
    }
    if (collections?.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setNameError("You already have a collection with that name.");
      return;
    }
    setCreating(true);
    setNameError(null);
    try {
      const created = await collectionsApi.create({ name, mediaId });
      setCollections((cs) => [...(cs ?? []), created]);
      publish(new Set(memberOf).add(created.id));
      setNewName("");
      showToast(`Added to “${created.name}”`);
    } catch (err) {
      setNameError(errorMessage(err, "Couldn't create the collection."));
    } finally {
      setCreating(false);
    }
  };

  if (!mounted || !open) return null;

  const userCollections = collections?.filter((c) => !c.isSystem) ?? [];
  const systemCollections = collections?.filter((c) => c.isSystem) ?? [];

  return createPortal(
    <div className={`fixed inset-0 ${layerClassName} flex items-end sm:items-center justify-center sm:p-4`}>
      <div className="glass-overlay glass-fade-in absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass-surface glass-sheet-up relative w-full sm:max-w-md max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-zinc-900/60 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_24px_80px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-white tracking-tight">
              Add to Collections
            </h2>
            <p className="text-xs text-zinc-400 truncate mt-0.5">{mediaTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-[120px]">
          {loadError ? (
            <p className="px-3 py-8 text-center text-sm text-zinc-400">Couldn&apos;t load your collections.</p>
          ) : !collections ? (
            <div className="space-y-2 px-3 py-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 rounded-2xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : (
            <ul className="space-y-1">
              {systemCollections.map((c) => (
                <li key={c.id}>
                  <div
                    className="flex items-center gap-3 px-3 py-3 rounded-2xl text-zinc-400 cursor-not-allowed"
                    title="Managed automatically"
                    aria-describedby={lockHintId}
                  >
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        watched ? "bg-emerald-500/70 border-emerald-300/40 text-white" : "border-white/20"
                      }`}
                      role="checkbox"
                      aria-checked={watched}
                      aria-disabled="true"
                      aria-label={`${c.name} (managed automatically)`}
                    >
                      {watched && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span className="flex-1 text-sm font-medium text-zinc-300">{c.name}</span>
                    <Lock className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
                    <span id={lockHintId} className="sr-only">
                      Managed automatically
                    </span>
                  </div>
                </li>
              ))}
              {userCollections.map((c) => {
                const checked = memberOf.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(c)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left hover:bg-white/[0.06] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
                    >
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          checked ? "bg-violet-500/80 border-violet-300/40 text-white" : "border-white/25"
                        }`}
                        aria-hidden="true"
                      >
                        {checked && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="flex-1 min-w-0 text-sm font-medium text-white truncate">{c.name}</span>
                      {pending.has(c.id) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" aria-hidden="true" />
                      ) : (
                        <span className="text-xs text-zinc-500 tabular-nums">{c.itemCount}</span>
                      )}
                    </button>
                  </li>
                );
              })}
              {userCollections.length === 0 && (
                <li className="px-3 py-5 text-center">
                  <FolderPlus className="w-6 h-6 text-zinc-500 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm text-zinc-300 font-medium">Create your first collection</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Group titles any way you like.</p>
                </li>
              )}
            </ul>
          )}
        </div>

        <form onSubmit={create} className="px-6 pt-3 pb-6 border-t border-white/10" noValidate>
          <label htmlFor={inputId} className="block text-xs font-medium text-zinc-400 mb-1.5">
            New collection
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (nameError) setNameError(null);
              }}
              maxLength={MAX_NAME + 10}
              placeholder="e.g. Comfort rewatches"
              aria-invalid={!!nameError}
              aria-describedby={nameError ? `${inputId}-error` : undefined}
              className="flex-1 min-w-0 h-11 px-4 rounded-2xl bg-white/[0.06] border border-white/15 text-sm text-white placeholder:text-zinc-500 outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
            />
            <GlassButton type="submit" variant="primary" loading={creating} disabled={!newName.trim()}>
              Create
            </GlassButton>
          </div>
          {nameError && (
            <p id={`${inputId}-error`} role="alert" className="mt-2 text-xs text-red-300">
              {nameError}
            </p>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}

export default CollectionsSheet;
