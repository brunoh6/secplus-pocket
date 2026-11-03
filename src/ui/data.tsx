// App-wide data snapshot from IndexedDB, re-queried after every write (onDbChange).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onDbChange } from '../db/idb';
import { getActiveDays, getAllSrs, getAttempts, getSessions, getSettings } from '../db/repo';
import { DEFAULT_SETTINGS, type Attempt, type Session, type Settings, type SrsRecord } from '../db/types';
import { domains, objectives } from '../content';
import { domainMastery, objectiveStats, type ObjectiveStat } from '../engine/mastery';
import { currentStreak, longestStreak } from '../engine/streak';

interface Snapshot { settings: Settings; srs: SrsRecord[]; attempts: Attempt[]; sessions: Session[]; activeDays: string[] }

export interface AppData extends Snapshot {
  ready: boolean;
  stats: Map<string, ObjectiveStat>;
  mastery: (objective: string) => number;
  domainProgress: ReturnType<typeof domainMastery>;
  streak: number;
  bestStreak: number;
  seenQuestions: Set<string>;
}

const empty: Snapshot = { settings: DEFAULT_SETTINGS, srs: [], attempts: [], sessions: [], activeDays: [] };
const Ctx = createContext<AppData | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(empty);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true, pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      await Promise.resolve(); // coalesce bursts of writes
      pending = false;
      const [settings, srs, attempts, sessions, activeDays] = await Promise.all([getSettings(), getAllSrs(), getAttempts(), getSessions(), getActiveDays()]);
      if (alive) { setSnap({ settings, srs, attempts, sessions, activeDays }); setReady(true); }
    };
    load();
    const off = onDbChange(load);
    const onVis = () => document.visibilityState === 'visible' && load(); // refresh due counts after a long pause
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; off(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const value = useMemo<AppData>(() => {
    const stats = objectiveStats(objectives.map((o) => o.id), snap.attempts, snap.srs, snap.settings);
    return {
      ...snap,
      ready,
      stats,
      mastery: (o) => stats.get(o)?.mastery ?? 0,
      domainProgress: domainMastery(domains, stats),
      streak: currentStreak(snap.activeDays),
      bestStreak: longestStreak(snap.activeDays),
      seenQuestions: new Set(snap.attempts.map((a) => a.questionId)),
    };
  }, [snap, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData outside DataProvider');
  return v;
}
