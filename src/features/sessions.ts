import { domainOf, pbqById, questionById, type Pbq, type Question } from '../content';
import { putSession, getSession, recordAttempt, newId } from '../db/repo';
import { emitDbChange } from '../db/idb';
import type { ExamState, Session, SessionMode, SessionResult } from '../db/types';
import { shuffle } from '../engine/rng';
import { estimateScaled } from '../engine/scoring';
import { gradePbq, isPbqId, pbqLayout } from '../engine/pbq';
import { isCorrect } from '../ui/question';

export const EXAM_MODES: SessionMode[] = ['exam', 'mini', 'diagnostic'];

type Item = Question | Pbq;
const isPbq = (x: Item): x is Pbq => isPbqId(x.id);

export const itemById = (id: string): Item | undefined => (isPbqId(id) ? pbqById.get(id) : questionById.get(id));

export async function createSession(opts: {
  mode: SessionMode; questions: Item[]; label?: string; limitMs?: number; strict?: boolean; seen: Set<string>; id?: string; dayKey?: string;
}): Promise<string> {
  const exam: ExamState = {
    questionIds: opts.questions.map((q) => q.id),
    order: Object.fromEntries(opts.questions.map((q) => [q.id, isPbq(q) ? pbqLayout(q) : shuffle(q.options.map((_, i) => i))])),
    answers: {},
    pbqAnswers: {},
    flags: [],
    index: 0,
    elapsedMs: 0,
    limitMs: opts.limitMs ?? 0,
    strict: !!opts.strict,
    resumedAt: Date.now(),
    questionMs: {},
    seenBefore: opts.questions.filter((q) => opts.seen.has(q.id)).map((q) => q.id),
  };
  const s: Session = { id: opts.id ?? newId(), mode: opts.mode, startedAt: Date.now(), label: opts.label, dayKey: opts.dayKey, exam };
  await putSession(s);
  return s.id;
}

/** 0–1 credit for one item of a session (PBQs get partial credit). */
export function itemScore(ex: ExamState, qid: string): number {
  if (isPbqId(qid)) {
    const p = pbqById.get(qid);
    return p ? gradePbq(p, ex.pbqAnswers?.[qid]).score : 0;
  }
  const q = questionById.get(qid);
  return q && isCorrect(q, ex.answers[qid] ?? []) ? 1 : 0;
}

export function summarize(s: Session): SessionResult {
  const ex = s.exam!;
  const byDomain: SessionResult['byDomain'] = {};
  let correct = 0, unseenTotal = 0, unseenCorrect = 0, totalMs = 0, total = 0;
  const seen = new Set(ex.seenBefore);
  for (const qid of ex.questionIds) {
    const it = itemById(qid);
    if (!it) continue;
    total++;
    const d = domainOf(it.objective);
    const sc = itemScore(ex, qid);
    byDomain[d] ??= { correct: 0, total: 0 };
    byDomain[d].total++;
    byDomain[d].correct += sc;
    correct += sc;
    if (!seen.has(qid)) { unseenTotal++; unseenCorrect += sc; }
    totalMs += ex.questionMs[qid] ?? 0;
  }
  const pct = total ? correct / total : 0;
  return { total, correct, pct, scaled: estimateScaled(pct), byDomain, unseenTotal, unseenCorrect, avgMs: total ? totalMs / total : 0 };
}

/** Grades an exam-style session, records every answer (unanswered = wrong) and stores the result. */
export async function finishExam(id: string) {
  const s = await getSession(id);
  if (!s?.exam || s.endedAt) return s;
  const ex = s.exam;
  const now = Date.now();
  for (const qid of ex.questionIds) {
    const it = itemById(qid);
    if (!it) continue;
    const base = { sessionId: s.id, questionId: qid, objective: it.objective, domain: domainOf(it.objective), mode: s.mode, ms: ex.questionMs[qid] ?? 0, at: now };
    if (isPbq(it)) {
      const g = gradePbq(it, ex.pbqAnswers?.[qid]);
      await recordAttempt({ ...base, selected: [], correct: g.correct, score: g.score }, false);
    } else {
      const sel = ex.answers[qid] ?? [];
      await recordAttempt({ ...base, selected: sel, correct: isCorrect(it, sel) }, false);
    }
  }
  s.result = summarize(s);
  s.endedAt = now;
  await putSession(s, false);
  emitDbChange();
  return s;
}

/** Counts as answered once the learner touched a PBQ (an order PBQ is "complete" from the start). */
export function isAnswered(ex: ExamState, qid: string) {
  return isPbqId(qid) ? !!ex.pbqAnswers?.[qid] : !!ex.answers[qid]?.length;
}

export const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
