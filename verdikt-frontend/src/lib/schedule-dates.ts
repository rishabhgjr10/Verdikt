/** Schedule date math. Pure and zone-safe: "today" is the calendar date in India, compared as YYYY-MM-DD strings. */

export type ScheduleTimeline = "released" | "today" | "upcoming" | "announced";

export const RELEASED_DAYS = 5;
export const UPCOMING_DAYS = 180;

/** Today's date (YYYY-MM-DD) in Asia/Calcutta, identical on server and client. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Calcutta" }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** TMDB date window per timeline as [from, to] (to = null: open ended). */
export function scheduleWindow(timeline: ScheduleTimeline, now: Date = new Date()): [string, string | null] {
  const today = todayInIndia(now);
  switch (timeline) {
    case "released":
      return [addDays(today, -RELEASED_DAYS), addDays(today, -1)];
    case "today":
      return [today, today];
    case "upcoming":
      return [addDays(today, 1), addDays(today, UPCOMING_DAYS)];
    case "announced":
      return [addDays(today, UPCOMING_DAYS + 1), null];
  }
}

/** Section a release date (YYYY-MM-DD) belongs to, or null when older than the Released window. */
export function bucketForDate(date: string, now: Date = new Date()): ScheduleTimeline | null {
  const today = todayInIndia(now);
  if (date === today) return "today";
  if (date > today) return date <= addDays(today, UPCOMING_DAYS) ? "upcoming" : "announced";
  return date >= addDays(today, -RELEASED_DAYS) ? "released" : null;
}
