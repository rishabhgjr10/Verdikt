import { InterestPeriod, MostInterestedItem } from "@/types/media";

export const PERIOD_OPTIONS: { value: InterestPeriod; label: string }[] = [
  { value: "WEEK", label: "This Week" },
  { value: "MONTH", label: "This Month" },
  { value: "QUARTER", label: "This Quarter" },
  { value: "YEAR", label: "This Year" },
  { value: "ALL", label: "All Time" },
];

export function parsePeriod(raw: string | null | undefined): InterestPeriod {
  const upper = (raw ?? "").toUpperCase();
  return PERIOD_OPTIONS.some((o) => o.value === upper) ? (upper as InterestPeriod) : "WEEK";
}

export function periodLabel(period: InterestPeriod): string {
  return PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "This Week";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-30" -> "30 Oct, 2026" (parsed as a calendar date, no timezone shift); falls back to the year. */
export function formatReleaseDate(releaseDate: string | null, releaseYear: number | null): string | null {
  const match = releaseDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const month = MONTHS[Number(match[2]) - 1];
    if (month) return `${Number(match[3])} ${month}, ${match[1]}`;
  }
  return releaseYear ? String(releaseYear) : null;
}

/** Imported items open their page; others go through the existing external import route. */
export function mostInterestedHref(item: MostInterestedItem): string {
  return item.id
    ? `/media/${item.id}`
    : `/media/external/${item.mediaType}/${encodeURIComponent(item.externalId)}`;
}

export function formatCount(count: number): string {
  return new Intl.NumberFormat("en", { notation: count >= 10000 ? "compact" : "standard" }).format(count);
}
