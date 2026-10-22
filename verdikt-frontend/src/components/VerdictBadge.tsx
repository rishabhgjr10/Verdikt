import React from "react";
import { Verdict } from "@/types/media";
import { Sparkles, CheckCircle2, ThumbsUp, XCircle } from "lucide-react";

interface VerdictBadgeProps {
  verdict: Verdict;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  /** "pill" = colored pill (default), "bars" = label + 4 segmented score bars */
  variant?: "pill" | "bars";
}

const VERDICT_CONFIG = {
  PERFECTION: {
    label: "Perfection",
    icon: Sparkles,
    color: "#a855f7",
    pillColor:
      "bg-purple-950/80 text-purple-300 border-purple-500/40 shadow-purple-900/30",
    textClass: "text-[#a855f7]",
    score: 4,
  },
  GO_FOR_IT: {
    label: "Go For It",
    icon: CheckCircle2,
    color: "#10b981",
    pillColor:
      "bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-emerald-900/30",
    textClass: "text-[#10b981]",
    score: 3,
  },
  TIMEPASS: {
    label: "Timepass",
    icon: ThumbsUp,
    color: "#f59e0b",
    pillColor:
      "bg-amber-950/80 text-amber-300 border-amber-500/40 shadow-amber-900/30",
    textClass: "text-[#f59e0b]",
    score: 2,
  },
  SKIP_IT: {
    label: "Skip",
    icon: XCircle,
    color: "#ef4444",
    pillColor:
      "bg-rose-950/80 text-rose-300 border-rose-500/40 shadow-rose-900/30",
    textClass: "text-[#ef4444]",
    score: 1,
  },
} as const;

const FALLBACK = {
  label: "Unknown",
  icon: Sparkles,
  color: "#71717a",
  pillColor: "bg-zinc-800 text-zinc-300 border-zinc-700",
  textClass: "text-zinc-400",
  score: 0,
};

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({
  verdict,
  size = "md",
  showIcon = true,
  variant = "pill",
}) => {
  const cfg =
    VERDICT_CONFIG[verdict as keyof typeof VERDICT_CONFIG] ?? FALLBACK;

  // ── Bars variant ─────────────────────────────────────────────
  if (variant === "bars") {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className={`text-xs font-semibold leading-none ${cfg.textClass}`}
        >
          {cfg.label}
        </span>
        <div className="flex items-center gap-[3px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className="inline-block h-2 w-[11px] rounded-[2px]"
              style={{
                backgroundColor: i < cfg.score ? cfg.color : "#27272a",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Pill variant (default) ───────────────────────────────────
  const sizeClass = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-xs sm:text-sm gap-1.5",
    lg: "px-4 py-1.5 text-sm sm:text-base gap-2 font-semibold",
  }[size];

  const IconComponent = cfg.icon;

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium shadow-sm backdrop-blur-md transition-all ${cfg.pillColor} ${sizeClass}`}
    >
      {showIcon && (
        <IconComponent
          className={
            size === "sm"
              ? "w-3.5 h-3.5"
              : size === "lg"
                ? "w-5 h-5"
                : "w-4 h-4"
          }
        />
      )}
      {cfg.label}
    </span>
  );
};