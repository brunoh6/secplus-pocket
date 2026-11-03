import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Attempt, ReviewLogEntry, Session, SrsRecord } from './types';

export const DB_NAME = 'secplus-pocket';
export const DB_VERSION = 1;

interface PocketDB extends DBSchema {
  srs: { key: string; value: SrsRecord; indexes: { kind: string; due: number } };
  reviewLog: { key: number; value: ReviewLogEntry; indexes: { at: number; itemId: string } };
  attempts: { key: number; value: Attempt; indexes: { at: number; questionId: string; objective: string; sessionId: string } };
  sessions: { key: string; value: Session; indexes: { mode: string; startedAt: number } };
  meta: { key: string; value: unknown };
}

export type StoreName = 'srs' | 'reviewLog' | 'attempts' | 'sessions' | 'meta';
export const STORES: StoreName[] = ['srs', 'reviewLog', 'attempts', 'sessions', 'meta'];

let dbp: Promise<IDBPDatabase<PocketDB>> | null = null;

export function db() {
  dbp ??= openDB<PocketDB>(DB_NAME, DB_VERSION, {
    upgrade(d, oldVersion) {
      // Versioned migrations: add a new `if (oldVersion < N)` block per schema change.
      if (oldVersion < 1) {
        const srs = d.createObjectStore('srs', { keyPath: 'id' });
        srs.createIndex('kind', 'kind');
        srs.createIndex('due', 'card.due');
        const log = d.createObjectStore('reviewLog', { keyPath: 'id', autoIncrement: true });
        log.createIndex('at', 'at');
        log.createIndex('itemId', 'itemId');
        const att = d.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true });
        att.createIndex('at', 'at');
        att.createIndex('questionId', 'questionId');
        att.createIndex('objective', 'objective');
        att.createIndex('sessionId', 'sessionId');
        const ses = d.createObjectStore('sessions', { keyPath: 'id' });
        ses.createIndex('mode', 'mode');
        ses.createIndex('startedAt', 'startedAt');
        d.createObjectStore('meta');
      }
    },
  });
  return dbp;
}

// Tiny change bus so hooks re-query after writes.
type Listener = () => void;
const listeners = new Set<Listener>();
export const onDbChange = (l: Listener) => (listeners.add(l), () => listeners.delete(l));
export const emitDbChange = () => listeners.forEach((l) => l());

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* not supported */ }
}
