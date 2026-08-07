"use client";

import { useState } from "react";
import { X, Zap, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusVariant = "announcement" | "operational" | "warning" | "error";

interface StatusConfig {
  variant: StatusVariant;
  badge: string;
  title: string;
  message: string;
}

// ─── Preset configs ───────────────────────────────────────────────────────────

const presets: Record<StatusVariant, Omit<StatusConfig, "variant">> = {
  announcement: {
    badge: "Upcoming Feature",
    title: "🎮 Video Games Integration Coming Soon!",
    message:
      "Movies, TV Shows, Anime, and Books are live! Games (IGDB) integration is currently in development and rolling out shortly.",
  },
  operational: {
    badge: "System Status",
    title: "✅ All Systems Operational",
    message: "All services are running normally. Enjoy Verdikt!",
  },
  warning: {
    badge: "Cold Start Warning",
    title: "⚡ Backend May Be Waking Up",
    message:
      "Our free-tier server may take 30–60 seconds to cold-start. If search is slow, please wait a moment and try again.",
  },
  error: {
    badge: "Service Disruption",
    title: "🔴 Some Services Unavailable",
    message:
      "We're experiencing issues with one or more integrations. The team is on it — please check back soon.",
  },
};

// ─── Variant style maps ───────────────────────────────────────────────────────

const variantStyles: Record<
  StatusVariant,
  {
    wrapper: string;
    dot: string;
    ping: string;
    badge: string;
    icon: React.ReactNode;
  }
> = {
  announcement: {
    wrapper:
      "bg-gradient-to-r from-violet-950/80 via-indigo-950/80 to-violet-950/80 border-violet-500/30",
    dot: "bg-violet-400",
    ping: "bg-violet-400",
    badge:
      "bg-violet-500/20 text-violet-300 border border-violet-500/40",
    icon: <Zap className="w-3.5 h-3.5 text-violet-300" />,
  },
  operational: {
    wrapper:
      "bg-gradient-to-r from-emerald-950/80 via-green-950/80 to-emerald-950/80 border-emerald-500/30",
    dot: "bg-emerald-400",
    ping: "bg-emerald-400",
    badge:
      "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />,
  },
  warning: {
    wrapper:
      "bg-gradient-to-r from-amber-950/80 via-yellow-950/80 to-amber-950/80 border-amber-500/30",
    dot: "bg-amber-400",
    ping: "bg-amber-400",
    badge:
      "bg-amber-500/20 text-amber-300 border border-amber-500/40",
    icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />,
  },
  error: {
    wrapper:
      "bg-gradient-to-r from-red-950/80 via-rose-950/80 to-red-950/80 border-red-500/30",
    dot: "bg-red-400",
    ping: "bg-red-400",
    badge: "bg-red-500/20 text-red-300 border border-red-500/40",
    icon: <XCircle className="w-3.5 h-3.5 text-red-300" />,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface StatusUpdatesProps {
  variant?: StatusVariant;
  /** Override any preset field individually */
  badge?: string;
  title?: string;
  message?: string;
}

export function StatusUpdates({
  variant = "announcement",
  badge,
  title,
  message,
}: StatusUpdatesProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const preset = presets[variant];
  const styles = variantStyles[variant];

  const resolvedBadge = badge ?? preset.badge;
  const resolvedTitle = title ?? preset.title;
  const resolvedMessage = message ?? preset.message;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        relative w-full border backdrop-blur-md
        px-4 py-3 flex items-start sm:items-center gap-3
        transition-all duration-300 ease-in-out
        ${styles.wrapper}
      `}
    >
      {/* Pulsating live dot */}
      <span className="relative flex-shrink-0 flex items-center justify-center w-5 h-5 mt-0.5 sm:mt-0">
        <span
          className={`animate-ping absolute inline-flex h-3 w-3 rounded-full opacity-60 ${styles.ping}`}
        />
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${styles.dot}`}
        />
      </span>

      {/* Content */}
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 min-w-0">
        {/* Badge */}
        <span
          className={`
            inline-flex items-center gap-1.5 self-start sm:self-auto
            px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide
            whitespace-nowrap flex-shrink-0
            ${styles.badge}
          `}
        >
          {styles.icon}
          {resolvedBadge}
        </span>

        {/* Text */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
          <span className="text-xs sm:text-sm font-semibold text-slate-100 whitespace-nowrap">
            {resolvedTitle}
          </span>
          <span className="hidden sm:inline text-slate-600 text-xs">·</span>
          <span className="text-[11px] sm:text-xs text-slate-400 leading-relaxed truncate">
            {resolvedMessage}
          </span>
        </div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
        className="
          flex-shrink-0 p-1.5 rounded-lg text-slate-400
          hover:text-slate-200 hover:bg-white/10
          transition-all duration-150 mt-0.5 sm:mt-0
        "
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
