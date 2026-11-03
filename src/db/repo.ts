import { db, emitDbChange, STORES } from './idb';
import { DEFAULT_SETTINGS, type Attempt, type CardKind, type ReviewLogEntry, type Session, type Settings, type SrsRecord } from './types';
import { dayKey } from '../engine/dates';
import { MISTAKE_GRADUATION_DAYS, newCard, review, type Grade } from '../engine/srs';

export async function getSettings(): Promise<Settings> {
  const s = (await (await db()).get('meta', 'settings')) as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function saveSettings(patch: Partial<Settings>) {
  const next = { ...(await getSettings()), ...patch };
  await (await db()).put('meta', next, 'settings');
  emitDbChange();
  return next;
}

export async function getActiveDays(): Promise<string[]> {
  return ((await (await db()).get('meta', 'activeDays')) as string[] | undefined) ?? [];
}

async function markActive(now = Date.now()) {
  const d = await db();
  const days = ((await d.get('meta', 'activeDays')) as string[] | undefined) ?? [];
  const k = dayKey(now);
  if (!days.includes(k)) await d.put('meta', [...days, k], 'activeDays');
}

export const getAllSrs = async () => (await db()).getAll('srs');
export const getSrs = async (id: string) => (await db()).get('srs', id);

export async function rateCard(
  item: { id: string; kind: CardKind; refId: string; objective?: string },
  rating: Grade,
  ms?: number,
  now = new Date(),
) {
  const d = await db();
  const settings = await getSettings();
  const existing = await d.get('srs', item.id);
  const rec: SrsRecord = existing ?? { ...item, card: newCard(now), introducedAt: +now };
  rec.card = review(rec.card, rating, settings, now);
  const tx = d.transaction(['srs', 'reviewLog'], 'readwrite');
  if (rec.kind === 'mistake' && rec.card.scheduled_days >= MISTAKE_GRADUATION_DAYS) await tx.objectStore('srs').delete(rec.id);
  else await tx.objectStore('srs').put(rec);
  await tx.objectStore('reviewLog').add({ itemId: item.id, kind: item.kind, rating, at: +now, ms } satisfies ReviewLogEntry);
  await tx.done;
  await markActive(+now);
  emitDbChange();
  return rec;
}

/** Records a quiz/exam answer. Wrong answers and lucky guesses feed the "Mis errores" deck. */
export async function recordAttempt(a: Omit<Attempt, 'id' | 'seenBefore'>, emit = true) {
  const d = await db();
  const seenBefore = (await d.countFromIndex('attempts', 'questionId', a.questionId)) > 0;
  await d.add('attempts', { ...a, seenBefore });
  // PBQs are practised in their own mode, not as flashcards.
  const toMistakes = !a.questionId.startsWith('pbq-') && (!a.correct || a.confidence === 'guess');
  if (toMistakes) {
    const id = `mistake:${a.questionId}`;
    const existing = await d.get('srs', id);
    // Re-missing a question resets it to due now so it shows up again soon.
    const card = existing ? { ...existing.card, due: a.at } : newCard(new Date(a.at));
    await d.put('srs', { id, kind: 'mistake', refId: a.questionId, objective: a.objective, card, introducedAt: existing?.introducedAt ?? a.at });
  }
  await markActive(a.at);
  if (emit) emitDbChange();
  return { seenBefore };
}

export const getAttempts = async () => (await db()).getAll('attempts');
export const getAttemptsForSession = async (sessionId: string) => (await db()).getAllFromIndex('attempts', 'sessionId', sessionId);
export const getReviewLog = async () => (await db()).getAll('reviewLog');

export const getSessions = async () => (await db()).getAll('sessions');
export const getSession = async (id: string) => (await db()).get('sessions', id);
export async function putSession(s: Session, emit = true) {
  await (await db()).put('sessions', s);
  if (emit) emitDbChange();
}
export async function deleteSession(id: string) {
  await (await db()).delete('sessions', id);
  emitDbChange();
}

export async function wipeAll() {
  const d = await db();
  const tx = d.transaction(STORES, 'readwrite');
  await Promise.all(STORES.map((s) => tx.objectStore(s).clear()));
  await tx.done;
  emitDbChange();
}

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
