import { describe, expect, it } from 'vitest';
import { apportion, seeded, shuffle } from '../src/engine/rng';
import { estimateScaled, readiness } from '../src/engine/scoring';
import { currentStreak, longestStreak } from '../src/engine/streak';
import { newCard, preview, Rating, review, retrievability, State } from '../src/engine/srs';
import { buildQueue } from '../src/engine/queue';
import { pickWeighted, examBlueprint } from '../src/engine/selection';
import { objectiveStats } from '../src/engine/mastery';
import { DEFAULT_SETTINGS, type Attempt, type SrsRecord } from '../src/db/types';
import type { Question } from '../src/content/schema';

const W = [
  { id: 1, weight: 0.12 }, { id: 2, weight: 0.22 }, { id: 3, weight: 0.18 }, { id: 4, weight: 0.28 }, { id: 5, weight: 0.2 },
];
const cfg = { retention: 0.9, maxIntervalDays: 60 };
const DAY = 86_400_000;

describe('apportion / blueprint', () => {
  it('splits a 90-question exam 11/20/16/25/18', () => {
    expect(examBlueprint(90, W)).toEqual([11, 20, 16, 25, 18]);
  });
  it('always sums to the total', () => {
    for (const n of [1, 7, 10, 20, 30, 89]) expect(apportion(n, W.map((w) => w.weight)).reduce((a, b) => a + b)).toBe(n);
  });
});

describe('scaled score estimate', () => {
  it('maps the anchors', () => {
    expect(estimateScaled(0)).toBe(100);
    expect(estimateScaled(0.81)).toBe(750);
    expect(estimateScaled(1)).toBe(900);
    expect(estimateScaled(0.85)).toBeGreaterThan(750);
  });
  it('readiness needs the last two exams ≥ 85%', () => {
    expect(readiness([{ endedAt: 1, result: { pct: 0.9 } }, { endedAt: 2, result: { pct: 0.86 } }]).ready).toBe(true);
    expect(readiness([{ endedAt: 1, result: { pct: 0.9 } }, { endedAt: 2, result: { pct: 0.8 } }]).ready).toBe(false);
    // sorted by end time: the 70% exam is older, so the last two are [0.7, 0.9]
    expect(readiness([{ endedAt: 2, result: { pct: 0.9 } }, { endedAt: 1, result: { pct: 0.7 } }]).ready).toBe(false);
  });
});

describe('streak', () => {
  it('counts back from today or yesterday', () => {
    expect(currentStreak(['2026-11-01', '2026-11-02', '2026-11-03'], '2026-11-03')).toBe(3);
    expect(currentStreak(['2026-11-01', '2026-11-02'], '2026-11-03')).toBe(2);
    expect(currentStreak(['2026-11-01'], '2026-11-03')).toBe(0);
    expect(currentStreak(['2026-10-31', '2026-11-01'], '2026-11-01')).toBe(2); // across month boundary
    expect(longestStreak(['2026-11-01', '2026-11-02', '2026-11-05'])).toBe(2);
  });
});

describe('FSRS scheduling', () => {
  const t0 = new Date('2026-11-03T08:00:00');
  it('Again < Hard ≤ Good < Easy for a new card', () => {
    const p = preview(newCard(t0), cfg, t0);
    expect(p[Rating.Again]).toBeLessThan(p[Rating.Good]);
    expect(p[Rating.Hard]).toBeLessThanOrEqual(p[Rating.Good]);
    expect(p[Rating.Good]).toBeLessThan(p[Rating.Easy]);
  });
  it('intervals grow with successive Good ratings and respect the max interval', () => {
    let c = newCard(t0), now = t0, last = 0;
    for (let i = 0; i < 12; i++) {
      c = review(c, Rating.Good, cfg, now);
      const interval = c.due - +now;
      if (c.state === State.Review) expect(interval).toBeGreaterThanOrEqual(last * 0.9); // fuzz tolerance
      if (c.state === State.Review) last = interval;
      now = new Date(c.due);
    }
    expect(c.state).toBe(State.Review);
    expect(c.scheduled_days).toBeLessThanOrEqual(61); // max interval + rounding
    expect(last).toBeGreaterThan(20 * DAY);
  });
  it('a lapse sends the card back to relearning with a short interval', () => {
    let c = newCard(t0), now = t0;
    for (let i = 0; i < 5; i++) { c = review(c, Rating.Good, cfg, now); now = new Date(c.due); }
    const lapsed = review(c, Rating.Again, cfg, now);
    expect(lapsed.state).toBe(State.Relearning);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.due - +now).toBeLessThan(DAY);
  });
  it('retrievability is ~retention on the due date', () => {
    let c = newCard(t0), now = t0;
    for (let i = 0; i < 4; i++) { c = review(c, Rating.Good, cfg, now); now = new Date(c.due); }
    expect(retrievability(c, cfg, new Date(c.due))).toBeGreaterThan(0.85);
    expect(retrievability(c, cfg, new Date(c.due))).toBeLessThan(0.95);
  });
});

describe('review queue', () => {
  const now = new Date('2026-11-03T12:00:00').getTime();
  const rec = (id: string, kind: SrsRecord['kind'], due: number, introducedAt = now - 10 * DAY, objective = '1.1'): SrsRecord =>
    ({ id, kind, refId: id, objective, card: { ...newCard(new Date(introducedAt)), due }, introducedAt });
  const flashcards = Array.from({ length: 30 }, (_, i) => ({ id: `fc-1.1-${String(i).padStart(3, '0')}`, objective: i < 15 ? '1.1' : '5.2' }));
  it('puts mistakes first and caps new cards by the daily limit', () => {
    const srs = [rec('fc-1.1-000', 'flashcard', now - DAY), rec('mistake:q-1', 'mistake', now - 1000), rec('fc-1.1-001', 'flashcard', now + DAY)];
    const q = buildQueue({ deck: 'all', srs, flashcards, acronyms: [], settings: { ...DEFAULT_SETTINGS, newPerDay: 5 }, now });
    expect(q.due.map((d) => d.id)).toEqual(['mistake:q-1', 'fc-1.1-000']);
    expect(q.fresh).toHaveLength(5);
    expect(q.fresh.every((f) => !['fc-1.1-000', 'fc-1.1-001'].includes(f.id))).toBe(true);
  });
  it('counts cards introduced today against the limit', () => {
    const srs = [0, 1, 2].map((i) => rec(`fc-1.1-00${i}`, 'flashcard', now + DAY, now - 1000));
    const q = buildQueue({ deck: 'all', srs, flashcards, acronyms: [], settings: { ...DEFAULT_SETTINGS, newPerDay: 5 }, now });
    expect(q.fresh).toHaveLength(2);
  });
  it('orders new flashcards weakest objective first', () => {
    const q = buildQueue({ deck: 'all', srs: [], flashcards, acronyms: [], settings: DEFAULT_SETTINGS, now, mastery: (o) => (o === '5.2' ? 0 : 0.8) });
    expect(q.fresh[0].objective).toBe('5.2');
  });
});

describe('question selection', () => {
  const pool: Question[] = [];
  for (let d = 1; d <= 5; d++) for (let i = 0; i < 40; i++)
    pool.push({ id: `q-${d}.1-${String(i).padStart(3, '0')}`, objective: `${d}.1` } as Question);
  it('follows the blueprint and prefers unseen questions', () => {
    const seen = new Set(pool.filter((q) => q.objective === '4.1').slice(0, 30).map((q) => q.id));
    const picked = pickWeighted(pool, 90, W, seeded(1), seen);
    const count = (d: number) => picked.filter((q) => q.objective.startsWith(`${d}.`)).length;
    expect([1, 2, 3, 4, 5].map(count)).toEqual([11, 20, 16, 25, 18]);
    expect(picked.filter((q) => q.objective === '4.1' && seen.has(q.id))).toHaveLength(15); // only 10 unseen exist
    expect(new Set(picked.map((q) => q.id)).size).toBe(90);
  });
  it('fills from other domains when one runs short', () => {
    const small = pool.filter((q) => !q.objective.startsWith('4.') || q.id.endsWith('000'));
    expect(pickWeighted(small, 90, W, seeded(2))).toHaveLength(90);
  });
  it('seeded shuffle is deterministic', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(7))).toEqual(shuffle([1, 2, 3, 4, 5], seeded(7)));
  });
});

describe('mastery', () => {
  it('needs evidence before reporting high mastery', () => {
    const a = (correct: boolean, at: number): Attempt => ({ sessionId: 's', questionId: `q${at}`, objective: '1.4', domain: 1, mode: 'quiz', selected: [0], correct, ms: 1000, at, seenBefore: false });
    const one = objectiveStats(['1.4'], [a(true, 1)], [], cfg).get('1.4')!;
    const many = objectiveStats(['1.4'], Array.from({ length: 10 }, (_, i) => a(true, i)), [], cfg).get('1.4')!;
    expect(one.mastery).toBeLessThan(0.2);
    expect(many.mastery).toBeGreaterThan(0.85);
  });
});

import { gradePbq, pbqLayout, isComplete, emptyAnswer } from '../src/engine/pbq';
import type { Pbq } from '../src/content/schema';

describe('PBQ grading', () => {
  const order = { id: 'pbq-4.8-001', objective: '4.8', type: 'order', title: 't', prompt: 'p', explanation: 'e', firstLabel: 'a', lastLabel: 'b',
    items: [0, 1, 2, 3].map((i) => ({ text: `i${i}`, why: 'w' })), difficulty: 2, tags: [], status: 'reviewed' } as Pbq;
  it('order: full credit only when exact; partial by relative pairs', () => {
    expect(gradePbq(order, { order: [0, 1, 2, 3] })).toMatchObject({ score: 1, correct: true });
    const swapped = gradePbq(order, { order: [1, 0, 2, 3] });
    expect(swapped.correct).toBe(false);
    expect(swapped.score).toBeCloseTo(5 / 6);
    expect(gradePbq(order, { order: [3, 2, 1, 0] }).score).toBe(0);
  });
  it('order layout is never pre-solved', () => {
    for (let s = 0; s < 50; s++) expect(pbqLayout(order, seeded(s))).not.toEqual([0, 1, 2, 3]);
  });
  const match = { id: 'pbq-3.2-101', objective: '3.2', type: 'match', title: 't', prompt: 'p', explanation: 'e', leftLabel: 'L', rightLabel: 'R',
    pairs: [{ left: 'SSH', right: '22', why: 'w' }, { left: 'HTTPS', right: '443', why: 'w' }, { left: 'LDAPS', right: '636', why: 'w' }],
    distractors: ['389'], difficulty: 2, tags: [], status: 'reviewed' } as Pbq;
  it('match: share of correct pairs; incomplete until all assigned', () => {
    expect(isComplete(match, emptyAnswer(match, pbqLayout(match)))).toBe(false);
    expect(gradePbq(match, { match: [0, 1, 3] })).toMatchObject({ correct: false, perElement: [true, true, false] });
    expect(gradePbq(match, { match: [0, 1, 2] }).correct).toBe(true);
  });
  const cat = { id: 'pbq-1.1-201', objective: '1.1', type: 'categorize', title: 't', prompt: 'p', explanation: 'e',
    dimensions: [{ id: 'category', label: 'C', options: ['Technical', 'Physical'] }, { id: 'type', label: 'T', options: ['Preventive', 'Detective'] }],
    items: [{ text: 'Firewall', answers: { category: 'Technical', type: 'Preventive' }, why: 'w' }, { text: 'Bollard', answers: { category: 'Physical', type: 'Preventive' }, why: 'w' }],
    difficulty: 2, tags: [], status: 'reviewed' } as Pbq;
  it('categorize: per-cell partial credit', () => {
    const g = gradePbq(cat, { cat: [{ category: 'Technical', type: 'Preventive' }, { category: 'Physical', type: 'Detective' }] });
    expect(g.score).toBe(0.75);
    expect(g.perElement).toEqual([true, false]);
  });
});
