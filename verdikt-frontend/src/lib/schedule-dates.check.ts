// Run: node src/lib/schedule-dates.check.ts
import assert from "node:assert/strict";
// @ts-expect-error node needs the .ts extension; tsc does not allow it
import { bucketForDate, scheduleWindow, todayInIndia } from "./schedule-dates.ts";

// Mon 26 Oct 2026, 00:30 IST (= 25 Oct 19:00 UTC): UTC date would be a day behind
const now = new Date("2026-10-25T19:00:00Z");
assert.equal(todayInIndia(now), "2026-10-26");
assert.equal(bucketForDate("2026-10-26", now), "today");
assert.equal(bucketForDate("2026-10-25", now), "released");
assert.equal(bucketForDate("2026-10-21", now), "released"); // today-5
assert.equal(bucketForDate("2026-10-20", now), null); // 6 days old: excluded
assert.equal(bucketForDate("2026-11-13", now), "upcoming");
assert.equal(bucketForDate("2027-04-24", now), "upcoming"); // today+180
assert.equal(bucketForDate("2027-04-25", now), "announced");
assert.equal(bucketForDate("2027-09-01", now), "announced");
assert.deepEqual(scheduleWindow("released", now), ["2026-10-21", "2026-10-25"]);
assert.deepEqual(scheduleWindow("today", now), ["2026-10-26", "2026-10-26"]);
console.log("schedule-dates: ok");
