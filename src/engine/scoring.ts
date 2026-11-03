// Approximate CompTIA scaled score. CompTIA does not publish its conversion, and real exams weight
// PBQs differently, so this is a rough heuristic: 0% → 100, ~81% → 750 (passing), 100% → 900.
export const PASSING_SCALED = 750;
const PASS_PCT = 0.81;

export function estimateScaled(pct: number): number {
  const p = Math.min(1, Math.max(0, pct));
  const s = p <= PASS_PCT ? 100 + (650 * p) / PASS_PCT : 750 + (150 * (p - PASS_PCT)) / (1 - PASS_PCT);
  return Math.round(s);
}

export interface ExamResultLike { endedAt?: number; result?: { pct: number } }

/** Learner's own readiness criterion: two consecutive full simulations at or above 85%. */
export function readiness(fullExams: ExamResultLike[], threshold = 0.85) {
  const done = fullExams.filter((e) => e.result && e.endedAt).sort((a, b) => a.endedAt! - b.endedAt!);
  const lastTwo = done.slice(-2).map((e) => e.result!.pct);
  return { lastTwo, ready: lastTwo.length === 2 && lastTwo.every((p) => p >= threshold), threshold };
}
