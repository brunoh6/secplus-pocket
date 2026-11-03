import { domains, pbqs, questions, type Pbq, type Question } from '../../content';
import { seeded, hashString, shuffle } from '../../engine/rng';
import { pickUniform, pickWeak, pickWeighted } from '../../engine/selection';

export const reviewedPool = () => questions.filter((q) => q.status === 'reviewed');

export type QuizScope =
  | { kind: 'mixed' }
  | { kind: 'domain'; domain: number }
  | { kind: 'objective'; objective: string }
  | { kind: 'weak' }
  | { kind: 'unseen' };

export function quizQuestions(scope: QuizScope, count: number, mastery: (o: string) => number, seen: Set<string>): Question[] {
  const rng = Math.random;
  switch (scope.kind) {
    case 'mixed': return pickWeighted(questions, count, domains, rng, seen);
    case 'domain': return pickUniform(questions.filter((q) => q.objective.startsWith(`${scope.domain}.`)), count, rng, seen);
    case 'objective': return pickUniform(questions.filter((q) => q.objective === scope.objective), count, rng, seen);
    case 'weak': return pickWeak(questions, count, mastery, rng);
    case 'unseen': return pickUniform(questions.filter((q) => !seen.has(q.id)), count, rng);
  }
}

export function scopeLabel(s: QuizScope) {
  switch (s.kind) {
    case 'mixed': return 'Mixto ponderado';
    case 'domain': return `Dominio ${s.domain}`;
    case 'objective': return `Objetivo ${s.objective}`;
    case 'weak': return 'Mis débiles';
    case 'unseen': return 'Nunca vistas';
  }
}

/** Same 10 questions for everyone-on-this-device all day, weighted by exam domains. */
export const dailyQuestions = (day: string) => pickWeighted(reviewedPool(), 10, domains, seeded(hashString(`daily:${day}`)));

/** Full simulation: like the real exam, a few PBQs come first, then multiple choice. */
export const EXAM_PBQS = 3;
export function examQuestions(count: number, seen: Set<string>, withPbqs = false): (Question | Pbq)[] {
  const pb = withPbqs ? pickPbqs({ count: EXAM_PBQS, type: 'all', onlyReviewed: true }, seen, () => 0) : [];
  return [...pb, ...pickWeighted(reviewedPool(), count - pb.length, domains, Math.random, seen)];
}

export type PbqFilter = { count: number; type: 'all' | Pbq['type']; onlyReviewed?: boolean; onlyMissed?: Set<string> };

/** PBQs: unseen first, then weakest objectives; never two of the same objective in a row when avoidable. */
export function pickPbqs(f: PbqFilter, seen: Set<string>, mastery: (o: string) => number): Pbq[] {
  let pool = pbqs.filter((p) => (f.type === 'all' || p.type === f.type) && (!f.onlyReviewed || p.status === 'reviewed'));
  if (f.onlyMissed) pool = pool.filter((p) => f.onlyMissed!.has(p.id));
  const ranked = shuffle(pool).sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)) || mastery(a.objective) - mastery(b.objective));
  const out: Pbq[] = [];
  const domainsUsed = new Set<string>();
  for (const p of ranked) if (out.length < f.count && !domainsUsed.has(p.objective[0])) { out.push(p); domainsUsed.add(p.objective[0]); }
  for (const p of ranked) if (out.length < f.count && !out.includes(p)) out.push(p);
  return out;
}
