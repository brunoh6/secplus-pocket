import { addDays, dayKey } from './dates';

/** Consecutive active days ending today (or yesterday, if today has no activity yet). */
export function currentStreak(activeDays: Iterable<string>, today = dayKey()): number {
  const set = new Set(activeDays);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function longestStreak(activeDays: Iterable<string>): number {
  const days = [...new Set(activeDays)].sort();
  let best = 0, run = 0, prev = '';
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
