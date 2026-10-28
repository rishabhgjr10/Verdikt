import { Verdict } from "@/types/media";

/** Low to high, the order the inline selector shows them in. Solid fills with dark text for contrast. */
export const VERDICT_OPTIONS: { value: Verdict; label: string; solid: string; hex: string }[] = [
  { value: "SKIP_IT", label: "Skip", solid: "bg-rose-500 text-black", hex: "#f43f5e" },
  { value: "TIMEPASS", label: "Timepass", solid: "bg-amber-500 text-black", hex: "#f59e0b" },
  { value: "GO_FOR_IT", label: "Go For It", solid: "bg-emerald-500 text-black", hex: "#10b981" },
  { value: "PERFECTION", label: "Perfection", solid: "bg-purple-500 text-black", hex: "#a855f7" },
];

export const verdictOption = (v: Verdict) => VERDICT_OPTIONS.find((o) => o.value === v) ?? VERDICT_OPTIONS[1];

export const MAX_REVIEW_LENGTH = 1000;
