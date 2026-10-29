"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";

const STAGE = 280;
const MAX_ZOOM = 4;
const OUTPUT = 512;
/** Longest side kept for editing; plenty for a 512px result and bounded memory for 50 MP phone photos */
const WORK_MAX = 2048;

/**
 * Decodes the file into a canvas. createImageBitmap first (some browsers stall or refuse blob: images), then an <img>
 * fed a data: URL (e.g. HEIC in Safari).
 */
async function decodeToCanvas(file: File): Promise<HTMLCanvasElement> {
  let source: ImageBitmap | HTMLImageElement | null = null;
  if (typeof createImageBitmap === "function") {
    try {
      source = await createImageBitmap(file);
    } catch {
      source = null;
    }
  }
  if (!source) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("unreadable"));
      reader.readAsDataURL(file);
    });
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("unreadable"));
      img.src = dataUrl;
    });
  }
  const w = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (!w || !h) throw new Error("unreadable");
  const k = Math.min(1, WORK_MAX / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("unreadable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  return canvas;
}

type Offset = { x: number; y: number };

/**
 * Lets the user place their photo inside the round frame before upload: drag (or arrow keys) to move, slider,
 * buttons or the wheel to zoom. Hands back a square JPEG of exactly what the frame shows.
 */
export function PhotoCropDialog({
  file,
  busy,
  onCancel,
  onConfirm,
}: {
  file: File;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (photo: Blob) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; start: Offset } | null>(null);
  const titleId = useId();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    decodeToCanvas(file)
      .then((canvas) => {
        if (cancelled) return;
        sourceRef.current = canvas;
        setSize({ w: canvas.width, h: canvas.height });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Paint the decoded photo into the on-screen canvas once it has its size
  useEffect(() => {
    const view = viewRef.current;
    const source = sourceRef.current;
    if (!view || !source || !size) return;
    view.getContext("2d")?.drawImage(source, 0, 0);
  }, [size]);
  useFocusTrap(panelRef, true, () => !busy && onCancel());

  // "Cover" scale fills the frame at zoom 1; zoom multiplies it
  const scale = size ? (STAGE / Math.min(size.w, size.h)) * zoom : 1;
  const clamp = (o: Offset, s = scale): Offset => {
    if (!size) return o;
    const maxX = Math.max(0, (size.w * s - STAGE) / 2);
    const maxY = Math.max(0, (size.h * s - STAGE) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
  };

  const setZoomKeepingFrame = (next: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    if (!size) return setZoom(z);
    const s = (STAGE / Math.min(size.w, size.h)) * z;
    // Scale the offset with the image so the point under the frame's centre stays put
    setOffset((o) => clamp({ x: (o.x * z) / zoom, y: (o.y * z) / zoom }, s));
    setZoom(z);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!size) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: offset };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setOffset(clamp({ x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, Offset> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      setOffset((o) => clamp({ x: o.x + m.x, y: o.y + m.y }));
    } else if (e.key === "+" || e.key === "=") setZoomKeepingFrame(zoom + 0.2);
    else if (e.key === "-") setZoomKeepingFrame(zoom - 0.2);
  };

  // Native listener: React's onWheel is passive, so it can't stop the page from scrolling
  const stageRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(setZoomKeepingFrame);
  const zoomNow = useRef(zoom);
  // Latest handler and zoom for the wheel listener, without re-adding it on every change
  useEffect(() => {
    zoomRef.current = setZoomKeepingFrame;
    zoomNow.current = zoom;
  });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current(zoomNow.current * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const confirm = async () => {
    const img = sourceRef.current;
    if (!img || !size) return;
    // Frame top-left, in source pixels; the image centre sits at the frame centre plus the offset
    const side = STAGE / scale;
    const sx = size.w / 2 - (STAGE / 2 + offset.x) / scale;
    const sy = size.h / 2 - (STAGE / 2 + offset.y) / scale;
    const out = Math.min(OUTPUT, Math.round(side));
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, out, out);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (blob) onConfirm(blob);
  };

  const ready = !!size && !failed;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="glass-overlay glass-fade-in absolute inset-0 bg-black/60" onClick={() => !busy && onCancel()} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm rounded-3xl border border-white/[0.1] bg-[#0f0f11]/95 backdrop-blur-xl p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id={titleId} className="text-lg font-semibold text-white">
            Adjust your photo
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cancel"
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div
          ref={stageRef}
          tabIndex={0}
          role="application"
          aria-label="Photo position. Drag or use the arrow keys to move, plus and minus to zoom."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className="relative mx-auto overflow-hidden rounded-2xl bg-zinc-900 touch-none select-none cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
          style={{ width: STAGE, height: STAGE }}
        >
          {size && (
            <canvas
              ref={viewRef}
              width={size.w}
              height={size.h}
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
              style={{ transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
            />
          )}
          {/* Dims everything outside the round frame, which is how the avatar will be shown */}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] ring-2 ring-white/70" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400 p-6 text-center">
              {failed ? "That file isn't a photo we can read. Use a JPG or PNG." : <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setZoomKeepingFrame(zoom - 0.2)}
            disabled={!ready || zoom <= 1}
            aria-label="Zoom out"
            className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Minus className="w-4 h-4" aria-hidden="true" />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!ready}
            onChange={(e) => setZoomKeepingFrame(Number(e.target.value))}
            aria-label="Zoom"
            className="flex-1 accent-purple-500 cursor-pointer"
          />
          <button
            type="button"
            onClick={() => setZoomKeepingFrame(zoom + 0.2)}
            disabled={!ready || zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-zinc-500">Drag to reposition</p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-5 py-2.5 rounded-full text-sm font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!ready || busy}
            className="inline-flex items-center gap-2 bg-white text-black font-semibold px-5 py-2.5 rounded-full text-sm hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {busy ? "Saving…" : "Save Photo"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
