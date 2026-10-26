"use client";

import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/lib/use-is-client";
import { X } from "lucide-react";
import { GlassButton, type GlassVariant } from "@/components/GlassButton";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface GlassConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: GlassVariant;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Centered glass alert dialog in a portal. Focus starts on Cancel and is trapped;
 * Esc, X, Cancel and the overlay all close without side effects (ignored while loading).
 */
export function GlassConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = "danger",
  loading = false,
  onConfirm,
  onClose,
}: GlassConfirmDialogProps) {
  const mounted = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const requestClose = () => {
    if (!loading) onClose();
  };

  useFocusTrap(panelRef, open, requestClose, cancelRef);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="glass-overlay glass-fade-in absolute inset-0 bg-black/50"
        onClick={requestClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="glass-surface glass-pop-in relative w-full max-w-md rounded-3xl bg-zinc-900/60 border border-white/15 p-6 sm:p-7 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_24px_80px_rgba(0,0,0,0.6)]"
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
        <h2 id={titleId} className="text-lg font-bold text-white tracking-tight pr-10">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-zinc-300 leading-relaxed">
          {description}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <GlassButton ref={cancelRef} variant="neutral" block onClick={requestClose} disabled={loading}>
            Cancel
          </GlassButton>
          <GlassButton variant={confirmVariant} block loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </GlassButton>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default GlassConfirmDialog;
