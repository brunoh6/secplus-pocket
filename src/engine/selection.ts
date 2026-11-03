import type { Question } from '../content/schema';
import { apportion, shuffle, type Rng } from './rng';

export interface DomainWeight { id: number; weight: number }

const domainOf = (q: Question) => Number(q.objective.split('.')[0]);

/**
 * Stratified sample by exam domain weight. Within each domain, questions the learner has not
 * seen come first. If a domain runs short, the remainder is filled from other domains.
 */
export function pickWeighted(
  pool: Question[],
  count: number,
  domains: DomainWeight[],
  rng: Rng,
  seen: Set<string> = new Set(),
): Question[] {
  const byDomain = new Map<number, Question[]>();
  for (const d of domains) byDomain.set(d.id, []);
  for (const q of pool) byDomain.get(domainOf(q))?.push(q);
  const ordered = new Map(
    [...byDomain].map(([d, qs]) => {
      const sh = shuffle(qs, rng);
      return [d, [...sh.filter((q) => !seen.has(q.id)), ...sh.filter((q) => seen.has(q.id))]];
    }),
  );
  const target = apportion(Math.min(count, pool.length), domains.map((d) => d.weight));
  const picked: Question[] = [];
  domains.forEach((d, i) => picked.push(...ordered.get(d.id)!.splice(0, target[i])));
  // Fill shortfall, preferring unseen across all domains.
  if (picked.length < Math.min(count, pool.length)) {
    const rest = shuffle([...ordered.values()].flat(), rng).sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)));
    picked.push(...rest.slice(0, Math.min(count, pool.length) - picked.length));
  }
  return shuffle(picked, rng);
}

/** Random sample, unseen first. */
export function pickUniform(pool: Question[], count: number, rng: Rng, seen: Set<string> = new Set()): Question[] {
  const sh = shuffle(pool, rng);
  return [...sh.filter((q) => !seen.has(q.id)), ...sh.filter((q) => seen.has(q.id))].slice(0, count);
}

/** Sample biased toward low-mastery objectives: weight ∝ (1 − mastery)² + 0.05. */
export function pickWeak(pool: Question[], count: number, mastery: (objective: string) => number, rng: Rng): Question[] {
  const items = pool.map((q) => ({ q, w: (1 - mastery(q.objective)) ** 2 + 0.05 }));
  const out: Question[] = [];
  while (out.length < count && items.length) {
    const total = items.reduce((s, x) => s + x.w, 0);
    let r = rng() * total, i = 0;
    while (i < items.length - 1 && (r -= items[i].w) > 0) i++;
    out.push(items.splice(i, 1)[0].q);
  }
  return out;
}

/** Exam question mix for a full simulation (90 → 11/20/16/25/18 with the official weights). */
export const examBlueprint = (count: number, domains: DomainWeight[]) => apportion(count, domains.map((d) => d.weight));
