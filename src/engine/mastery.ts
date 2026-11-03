// Mastery per objective = blend of recent quiz accuracy and flashcard recall probability,
// scaled down until there is enough evidence (so one lucky answer is not "66% mastered").
import type { Attempt, SrsRecord } from '../db/types';
import { retrievability, type SrsConfig } from './srs';

export interface ObjectiveStat {
  objective: string;
  attempts: number;
  correct: number;
  recentAcc: number | null;   // smoothed accuracy over the last 20 attempts
  recall: number | null;      // mean retrievability of introduced flashcards
  cardsSeen: number;
  mastery: number;            // 0–1
  avgMs: number | null;
  lastAt: number | null;
}

const RECENT = 20;
const EVIDENCE_FULL = 6;

export function objectiveStats(
  objectiveIds: string[],
  attempts: Attempt[],
  srs: SrsRecord[],
  cfg: SrsConfig,
  now = new Date(),
): Map<string, ObjectiveStat> {
  const byObj = new Map<string, Attempt[]>();
  for (const a of attempts) (byObj.get(a.objective) ?? byObj.set(a.objective, []).get(a.objective)!).push(a);
  const cardsByObj = new Map<string, SrsRecord[]>();
  for (const r of srs) {
    if (r.kind !== 'flashcard' || !r.objective) continue;
    (cardsByObj.get(r.objective) ?? cardsByObj.set(r.objective, []).get(r.objective)!).push(r);
  }
  const out = new Map<string, ObjectiveStat>();
  for (const id of objectiveIds) {
    const list = (byObj.get(id) ?? []).slice().sort((a, b) => a.at - b.at);
    const recent = list.slice(-RECENT);
    const rc = recent.reduce((s, a) => s + (a.score ?? (a.correct ? 1 : 0)), 0);
    const recentAcc = recent.length ? (rc + 1) / (recent.length + 2) : null;
    const cards = cardsByObj.get(id) ?? [];
    const recall = cards.length ? cards.reduce((s, r) => s + retrievability(r.card, cfg, now), 0) / cards.length : null;
    let raw: number;
    if (recentAcc !== null && recall !== null) raw = 0.6 * recentAcc + 0.4 * recall;
    else raw = recentAcc ?? recall ?? 0;
    const evidence = Math.min(1, (recent.length + cards.length) / EVIDENCE_FULL);
    out.set(id, {
      objective: id,
      attempts: list.length,
      correct: list.reduce((s, a) => s + (a.score ?? (a.correct ? 1 : 0)), 0),
      recentAcc,
      recall,
      cardsSeen: cards.length,
      mastery: raw * evidence,
      avgMs: list.length ? list.reduce((s, a) => s + a.ms, 0) / list.length : null,
      lastAt: list.length ? list[list.length - 1].at : null,
    });
  }
  return out;
}

export function domainMastery(domains: { id: number; weight: number; objectives: { id: string }[] }[], stats: Map<string, ObjectiveStat>) {
  const perDomain = domains.map((d) => ({
    id: d.id,
    weight: d.weight,
    mastery: d.objectives.reduce((s, o) => s + (stats.get(o.id)?.mastery ?? 0), 0) / d.objectives.length,
  }));
  const overall = perDomain.reduce((s, d) => s + d.weight * d.mastery, 0);
  return { perDomain, overall };
}

/** Weakest objectives first; never-seen objectives count as weakest. */
export function weakObjectives(stats: Map<string, ObjectiveStat>, available: Set<string>, n = 6): string[] {
  return [...stats.values()]
    .filter((s) => available.has(s.objective))
    .sort((a, b) => a.mastery - b.mastery || a.attempts - b.attempts)
    .slice(0, n)
    .map((s) => s.objective);
}
