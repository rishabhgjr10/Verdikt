"use client";

import React, { useEffect, useRef } from "react";

export function DeleteReviewDialog({
  open,
  deleting,
  onConfirm,
  onClose,
}: {
  open: boolean;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Safe default focus on the non-destructive action
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !deleting && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, deleting, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !deleting && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-review-title"
        aria-describedby="delete-review-body"
        className="bg-[#121212] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm"
      >
        <h2 id="delete-review-title" className="text-lg font-bold text-white">
          Delete Review?
        </h2>
        <p id="delete-review-body" className="text-zinc-400 text-sm mt-2 mb-6">
          Are you sure you want to delete your review? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
