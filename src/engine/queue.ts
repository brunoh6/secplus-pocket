import type { CardKind, Settings, SrsRecord } from '../db/types';
import { startOfDay } from './dates';

export interface QueueItem { id: string; kind: CardKind; refId: string; objective?: string; isNew: boolean }

export type Deck = 'all' | 'mistakes' | 'acronyms' | `d${1 | 2 | 3 | 4 | 5}` | `obj:${string}`;

export interface ContentCard { id: string; objective?: string }

function inDeck(deck: Deck, kind: CardKind, objective?: string) {
  if (deck === 'mistakes') return kind === 'mistake';
  if (deck === 'acronyms') return kind === 'acronym';
  if (kind === 'acronym') return false;
  if (deck === 'all') return true;
  if (deck.startsWith('obj:')) return objective === deck.slice(4);
  return objective?.startsWith(`${deck.slice(1)}.`) ?? false;
}

export function newIntroducedToday(srs: SrsRecord[], kind: 'flashcard' | 'acronym', now = Date.now()) {
  const sod = startOfDay(now);
  return srs.filter((r) => r.kind === kind && r.introducedAt >= sod).length;
}

/**
 * Due cards (mistakes first, then oldest due) plus new cards up to today's limit.
 * New flashcards are ordered weakest objective first; acronyms alphabetically.
 */
export function buildQueue(opts: {
  deck: Deck;
  srs: SrsRecord[];
  flashcards: ContentCard[];
  acronyms: ContentCard[];
  settings: Settings;
  mastery?: (objective: string) => number;
  now?: number;
}): { due: QueueItem[]; fresh: QueueItem[]; newLeft: number } {
  const { deck, srs, settings, now = Date.now() } = opts;
  const known = new Set(srs.map((r) => r.id));
  const due = srs
    .filter((r) => r.card.due <= now && inDeck(deck, r.kind, r.objective))
    .sort((a, b) => Number(b.kind === 'mistake') - Number(a.kind === 'mistake') || a.card.due - b.card.due)
    .map((r) => ({ id: r.id, kind: r.kind, refId: r.refId, objective: r.objective, isNew: false }));

  if (deck === 'mistakes') return { due, fresh: [], newLeft: 0 };
  const kind: 'acronym' | 'flashcard' = deck === 'acronyms' ? 'acronym' : 'flashcard';
  const newLeft = Math.max(0, settings.newPerDay - newIntroducedToday(srs, kind, now));
  const source = kind === 'acronym' ? opts.acronyms : opts.flashcards;
  let candidates = source.filter((c) => !known.has(c.id) && inDeck(deck, kind, c.objective));
  if (kind === 'flashcard' && opts.mastery) {
    const m = opts.mastery;
    candidates = candidates
      .map((c, i) => ({ c, k: m(c.objective!) + i * 1e-6 }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.c);
  }
  const fresh = candidates.slice(0, newLeft).map((c): QueueItem => ({ id: c.id, kind, refId: c.id, objective: c.objective, isNew: true }));
  return { due, fresh, newLeft };
}

export interface DeckCounts { due: number; newAvailable: number; total: number; mistakes: number }

export function deckCounts(deck: Deck, srs: SrsRecord[], flashcards: ContentCard[], acronyms: ContentCard[], settings: Settings, now = Date.now()): DeckCounts {
  const q = buildQueue({ deck, srs, flashcards, acronyms, settings, now });
  const total = deck === 'mistakes'
    ? srs.filter((r) => r.kind === 'mistake').length
    : (deck === 'acronyms' ? acronyms : flashcards).filter((c) => inDeck(deck, deck === 'acronyms' ? 'acronym' : 'flashcard', c.objective)).length;
  return { due: q.due.length, newAvailable: q.fresh.length, total, mistakes: srs.filter((r) => r.kind === 'mistake').length };
}

/** 5-minute session: mistakes due → reviews due → a few new cards → questions on weak objectives. */
export function quickSessionPlan(q: { due: QueueItem[]; fresh: QueueItem[] }, maxCards = 12, maxNew = 5) {
  const cards = q.due.slice(0, maxCards);
  cards.push(...q.fresh.slice(0, Math.min(maxNew, maxCards - cards.length)));
  return cards;
}
