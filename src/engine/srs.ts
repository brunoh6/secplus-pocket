import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { StoredCard } from '../db/types';

export { Rating, State };
export type { Grade };

export interface SrsConfig { retention: number; maxIntervalDays: number }

const schedulers = new Map<string, ReturnType<typeof fsrs>>();
function scheduler({ retention, maxIntervalDays }: SrsConfig) {
  const key = `${retention}:${maxIntervalDays}`;
  let f = schedulers.get(key);
  if (!f) {
    f = fsrs(generatorParameters({ request_retention: retention, maximum_interval: maxIntervalDays, enable_fuzz: true }));
    schedulers.set(key, f);
  }
  return f;
}

export function toStored(c: Card): StoredCard {
  return {
    due: +c.due, stability: c.stability, difficulty: c.difficulty, elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days, learning_steps: c.learning_steps, reps: c.reps, lapses: c.lapses,
    state: c.state, last_review: c.last_review ? +c.last_review : undefined,
  };
}

export function fromStored(s: StoredCard): Card {
  return { ...s, due: new Date(s.due), last_review: s.last_review ? new Date(s.last_review) : undefined } as Card;
}

export const newCard = (now = new Date()) => toStored(createEmptyCard(now));

export function review(card: StoredCard, rating: Grade, cfg: SrsConfig, now = new Date()): StoredCard {
  return toStored(scheduler(cfg).next(fromStored(card), now, rating).card);
}

/** Due date for each possible rating, for the button labels. */
export function preview(card: StoredCard, cfg: SrsConfig, now = new Date()): Record<Grade, number> {
  const p = scheduler(cfg).repeat(fromStored(card), now);
  return {
    [Rating.Again]: +p[Rating.Again].card.due,
    [Rating.Hard]: +p[Rating.Hard].card.due,
    [Rating.Good]: +p[Rating.Good].card.due,
    [Rating.Easy]: +p[Rating.Easy].card.due,
  } as Record<Grade, number>;
}

/** Probability of recall right now (0–1). New cards → 0. */
export function retrievability(card: StoredCard, cfg: SrsConfig, now = new Date()): number {
  if (card.state === State.New) return 0;
  return scheduler(cfg).get_retrievability(fromStored(card), now, false);
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} d`;
  return `${Math.round(d / 30)} m`;
}

/** Mistake cards graduate (leave the deck) once scheduled this far out. */
export const MISTAKE_GRADUATION_DAYS = 21;
