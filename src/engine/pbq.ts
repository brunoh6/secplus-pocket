import type { Pbq } from '../content/schema';
import { shuffle, type Rng } from './rng';

/** Learner's answer. Indices refer to the ORIGINAL arrays in the content. */
export interface PbqAnswer {
  order?: number[];                       // order: item indices in the learner's order
  match?: (number | null)[];              // match: per left item, index into rightOptions() (null = unassigned)
  cat?: Record<string, string>[];         // categorize: per item, dimension id → chosen option
}

export const isPbqId = (id: string) => id.startsWith('pbq-');

/** Right-hand options for a match PBQ: the real answers (index i ↔ pair i) followed by distractors. */
export const rightOptions = (p: Extract<Pbq, { type: 'match' }>) => [...p.pairs.map((x) => x.right), ...p.distractors];

/** Shuffled presentation order (never already solved for `order` PBQs). */
export function pbqLayout(p: Pbq, rng: Rng = Math.random): number[] {
  const n = p.type === 'order' ? p.items.length : p.type === 'match' ? rightOptions(p).length : p.items.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  let s = shuffle(idx, rng);
  if (p.type === 'order') for (let k = 0; k < 10 && s.every((v, i) => v === i); k++) s = shuffle(idx, rng);
  return s;
}

export function emptyAnswer(p: Pbq, layout: number[]): PbqAnswer {
  if (p.type === 'order') return { order: layout.slice() };
  if (p.type === 'match') return { match: p.pairs.map(() => null) };
  return { cat: p.items.map(() => ({})) };
}

export function isComplete(p: Pbq, a: PbqAnswer | undefined): boolean {
  if (!a) return false;
  if (p.type === 'order') return !!a.order && a.order.length === p.items.length;
  if (p.type === 'match') return !!a.match && a.match.every((x) => x !== null);
  return !!a.cat && a.cat.every((c) => p.dimensions.every((d) => !!c[d.id]));
}

export interface PbqGrade { score: number; correct: boolean; perElement: boolean[] }

/** Partial credit: order → share of item pairs in the right relative order; match/categorize → share of correct cells. */
export function gradePbq(p: Pbq, a: PbqAnswer | undefined): PbqGrade {
  if (p.type === 'order') {
    const o = a?.order ?? [];
    if (o.length !== p.items.length) return { score: 0, correct: false, perElement: p.items.map(() => false) };
    let good = 0, total = 0;
    for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) { total++; if (o[i] < o[j]) good++; }
    const perElement = o.map((orig, pos) => orig === pos);   // by displayed position
    return { score: total ? good / total : 0, correct: perElement.every(Boolean), perElement };
  }
  if (p.type === 'match') {
    const perElement = p.pairs.map((_, i) => a?.match?.[i] === i);
    const score = perElement.filter(Boolean).length / perElement.length;
    return { score, correct: score === 1, perElement };
  }
  const perElement = p.items.map((it, i) => p.dimensions.every((d) => a?.cat?.[i]?.[d.id] === it.answers[d.id]));
  let cells = 0, good = 0;
  p.items.forEach((it, i) => p.dimensions.forEach((d) => { cells++; if (a?.cat?.[i]?.[d.id] === it.answers[d.id]) good++; }));
  const score = cells ? good / cells : 0;
  return { score, correct: score === 1, perElement };
}

export const PBQ_TYPE_LABEL: Record<Pbq['type'], string> = { order: 'Ordenar', match: 'Emparejar', categorize: 'Clasificar' };
