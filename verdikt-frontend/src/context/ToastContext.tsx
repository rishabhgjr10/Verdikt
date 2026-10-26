"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/lib/use-is-client";
import { AlertCircle, CheckCircle2 } from "lucide-react";

type ToastTone = "success" | "error";

interface Toast {
  id: number;
  message: string;
  detail?: string;
  tone: ToastTone;
}

interface ToastContextType {
  showToast: (message: string, options?: { tone?: ToastTone; detail?: string }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);
const TOAST_MS = 3200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const mounted = useIsClient();
  const nextId = useRef(1);

  const showToast = useCallback<ToastContextType["showToast"]>((message, options) => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, message, detail: options?.detail, tone: options?.tone ?? "success" }]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center gap-2 w-[min(420px,calc(100vw-2rem))] pointer-events-none"
            aria-live="polite"
            role="status"
          >
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className="glass-surface glass-pop-in pointer-events-auto w-full flex items-start gap-3 px-4 py-3 rounded-2xl bg-zinc-900/60 border border-white/15 text-sm text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_12px_40px_rgba(0,0,0,0.5)]"
              >
                {toast.tone === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-px" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-px" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold">{toast.message}</p>
                  {toast.detail && <p className="text-xs text-zinc-400 mt-0.5">{toast.detail}</p>}
                </div>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
