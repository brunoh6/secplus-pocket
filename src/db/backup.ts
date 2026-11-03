import { z } from 'zod';
import { db, DB_VERSION, emitDbChange, STORES } from './idb';
import type { Attempt, ReviewLogEntry, Session, SrsRecord } from './types';

export const BACKUP_FORMAT = 'secplus-pocket-backup';

const BackupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int(),
  exportedAt: z.number(),
  appVersion: z.string().optional(),
  data: z.object({
    srs: z.array(z.object({ id: z.string(), kind: z.string(), refId: z.string(), card: z.object({ due: z.number() }).passthrough() }).passthrough()),
    reviewLog: z.array(z.object({ itemId: z.string(), rating: z.number(), at: z.number() }).passthrough()),
    attempts: z.array(z.object({ questionId: z.string(), correct: z.boolean(), at: z.number() }).passthrough()),
    sessions: z.array(z.object({ id: z.string(), mode: z.string(), startedAt: z.number() }).passthrough()),
    meta: z.array(z.tuple([z.string(), z.unknown()])),
  }),
});
export type Backup = z.infer<typeof BackupSchema>;

export async function exportBackup(): Promise<Backup> {
  const d = await db();
  const tx = d.transaction(STORES, 'readonly');
  const metaStore = tx.objectStore('meta');
  const [srs, reviewLog, attempts, sessions, keys, vals] = await Promise.all([
    tx.objectStore('srs').getAll(), tx.objectStore('reviewLog').getAll(), tx.objectStore('attempts').getAll(),
    tx.objectStore('sessions').getAll(), metaStore.getAllKeys(), metaStore.getAll(),
  ]);
  return {
    format: BACKUP_FORMAT, schemaVersion: DB_VERSION, exportedAt: Date.now(), appVersion: __APP_VERSION__,
    data: { srs, reviewLog, attempts, sessions, meta: keys.map((k, i) => [String(k), vals[i]]) },
  } as unknown as Backup;
}

export function parseBackup(text: string): Backup {
  const json = JSON.parse(text);
  const r = BackupSchema.safeParse(json);
  if (!r.success) throw new Error('El archivo no es un respaldo válido de Security+ Pocket.');
  if (r.data.schemaVersion > DB_VERSION) throw new Error('Este respaldo viene de una versión más nueva de la app. Actualiza primero.');
  return r.data;
}

/**
 * replace: wipes local data and loads the backup.
 * merge: keeps the most recently reviewed version of each card, unions attempts/reviews/sessions (deduplicated), unions active days.
 */
export async function importBackup(b: Backup, mode: 'replace' | 'merge') {
  const d = await db();
  const tx = d.transaction(STORES, 'readwrite');
  const srsS = tx.objectStore('srs'), logS = tx.objectStore('reviewLog'), attS = tx.objectStore('attempts'), sesS = tx.objectStore('sessions'), metaS = tx.objectStore('meta');
  const strip = <T extends { id?: number }>(x: T) => { const { id: _drop, ...rest } = x; return rest as T; };
  if (mode === 'replace') {
    await Promise.all(STORES.map((s) => tx.objectStore(s).clear()));
    for (const r of b.data.srs) await srsS.put(r as unknown as SrsRecord);
    for (const r of b.data.reviewLog) await logS.add(strip(r as unknown as ReviewLogEntry));
    for (const r of b.data.attempts) await attS.add(strip(r as unknown as Attempt));
    for (const r of b.data.sessions) await sesS.put(r as unknown as Session);
    for (const [k, v] of b.data.meta) await metaS.put(v, k);
  } else {
    for (const r of b.data.srs as unknown as SrsRecord[]) {
      const cur = await srsS.get(r.id);
      if (!cur || (r.card.last_review ?? 0) > (cur.card.last_review ?? 0)) await srsS.put(r);
    }
    const logKeys = new Set((await logS.getAll()).map((x) => `${x.itemId}|${x.at}`));
    for (const r of b.data.reviewLog as unknown as ReviewLogEntry[]) if (!logKeys.has(`${r.itemId}|${r.at}`)) await logS.add(strip(r));
    const attKeys = new Set((await attS.getAll()).map((x) => `${x.questionId}|${x.at}|${x.sessionId}`));
    for (const r of b.data.attempts as unknown as Attempt[]) if (!attKeys.has(`${r.questionId}|${r.at}|${r.sessionId}`)) await attS.add(strip(r));
    for (const r of b.data.sessions as unknown as Session[]) if (!(await sesS.get(r.id))) await sesS.put(r);
    const meta = new Map(b.data.meta);
    const days = new Set([...(((await metaS.get('activeDays')) as string[]) ?? []), ...((meta.get('activeDays') as string[]) ?? [])]);
    await metaS.put([...days].sort(), 'activeDays');
    if (!(await metaS.get('settings')) && meta.has('settings')) await metaS.put(meta.get('settings'), 'settings');
  }
  await tx.done;
  emitDbChange();
}
