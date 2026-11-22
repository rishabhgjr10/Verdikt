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

/** Label, colour and 1–4 strength bars for a verdict chip; the one copy every card and page uses */
export const VERDICT_STYLE: Record<Verdict, { label: string; color: string; textClass: string; score: number }> = {
  PERFECTION: { label: "Perfection", color: "#a855f7", textClass: "text-[#a855f7]", score: 4 },
  GO_FOR_IT: { label: "Go For It", color: "#10b981", textClass: "text-[#10b981]", score: 3 },
  TIMEPASS: { label: "Timepass", color: "#f59e0b", textClass: "text-[#f59e0b]", score: 2 },
  SKIP_IT: { label: "Skip", color: "#ef4444", textClass: "text-[#ef4444]", score: 1 },
};

/** Most cautious first: a tie between member verdicts goes to the earlier one */
const CAUTION_ORDER: Verdict[] = ["SKIP_IT", "TIMEPASS", "GO_FOR_IT", "PERFECTION"];

/**
 * The members' verdict from a list of reviews: the most common one, a tie going to the more cautious verdict.
 * Same rule as ConsensusService on the backend, which sends it as `consensus` on media items.
 */
export function topVerdict(verdicts: Verdict[]): Verdict | null {
  const counts = new Map<Verdict, number>();
  for (const v of verdicts) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: Verdict | null = null;
  for (const v of CAUTION_ORDER) if ((counts.get(v) ?? 0) > (best ? counts.get(best)! : 0)) best = v;
  return best;
}
