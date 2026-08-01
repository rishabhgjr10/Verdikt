import React from "react";
import { Verdict } from "@/types/media";
import { Sparkles, CheckCircle2, ThumbsUp, XCircle } from "lucide-react";

interface VerdictBadgeProps {
  verdict: Verdict;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({
  verdict,
  size = "md",
  showIcon = true,
}) => {
  const config = {
    PERFECTION: {
      label: "Perfection",
      icon: Sparkles,
      color: "bg-purple-950/80 text-purple-300 border-purple-500/40 shadow-purple-900/30",
    },
    GO_FOR_IT: {
      label: "Go For It",
      icon: CheckCircle2,
      color: "bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-emerald-900/30",
    },
    TIMEPASS: {
      label: "Timepass",
      icon: ThumbsUp,
      color: "bg-amber-950/80 text-amber-300 border-amber-500/40 shadow-amber-900/30",
    },
    SKIP_IT: {
      label: "Skip It",
      icon: XCircle,
      color: "bg-rose-950/80 text-rose-300 border-rose-500/40 shadow-rose-900/30",
    },
  }[verdict] || {
    label: verdict,
    icon: Sparkles,
    color: "bg-slate-800 text-slate-300 border-slate-700",
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-xs sm:text-sm gap-1.5",
    lg: "px-4 py-1.5 text-sm sm:text-base gap-2 font-semibold",
  }[size];

  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium shadow-sm backdrop-blur-md transition-all ${config.color} ${sizeClasses}`}
    >
      {showIcon && <IconComponent className={size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-5 h-5" : "w-4 h-4"} />}
      {config.label}
    </span>
  );
};
