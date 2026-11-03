import type { State } from 'ts-fsrs';

export type CardKind = 'flashcard' | 'acronym' | 'mistake';

/** ts-fsrs Card with dates stored as epoch ms (JSON/IndexedDB friendly). */
export interface StoredCard {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: number;
}

export interface SrsRecord {
  id: string;            // flashcard/acronym id, or "mistake:<questionId>"
  kind: CardKind;
  refId: string;         // content id the card points to
  objective?: string;
  card: StoredCard;
  introducedAt: number;  // first time it entered the queue
}

export interface ReviewLogEntry {
  id?: number;
  itemId: string;
  kind: CardKind;
  rating: number;        // 1 Again · 2 Hard · 3 Good · 4 Easy
  at: number;
  ms?: number;
}

export type Confidence = 'sure' | 'unsure' | 'guess';
export type MissReason = 'unknown' | 'misread' | 'terms' | 'two-good';
export type SessionMode = 'quiz' | 'daily' | 'diagnostic' | 'mini' | 'exam' | 'quick' | 'review' | 'pbq';

export interface Attempt {
  id?: number;
  sessionId: string;
  questionId: string;
  objective: string;
  domain: number;
  mode: SessionMode;
  selected: number[];    // indices in the ORIGINAL options order
  correct: boolean;
  /** Partial credit 0–1 (PBQs). Absent for multiple choice. */
  score?: number;
  confidence?: Confidence;
  missReason?: MissReason;
  ms: number;
  at: number;
  seenBefore: boolean;
}

export interface ExamState {
  questionIds: string[];
  order: Record<string, number[]>;     // shuffled option order per question
  answers: Record<string, number[]>;   // original option indices
  pbqAnswers?: Record<string, import('../engine/pbq').PbqAnswer>;
  flags: string[];
  index: number;
  elapsedMs: number;                   // active time spent
  limitMs: number;
  strict: boolean;
  resumedAt?: number;                  // wall clock of last resume (strict mode counts background time)
  questionMs: Record<string, number>;
  seenBefore: string[];
}

export interface SessionResult {
  total: number;
  correct: number;
  pct: number;
  scaled?: number;
  byDomain: Record<number, { correct: number; total: number }>;
  unseenTotal?: number;
  unseenCorrect?: number;
  avgMs?: number;
}

export interface Session {
  id: string;
  mode: SessionMode;
  startedAt: number;
  endedAt?: number;
  label?: string;
  dayKey?: string;
  exam?: ExamState;
  result?: SessionResult;
}

export interface Settings {
  newPerDay: number;
  retention: number;
  maxIntervalDays: number;
  confidence: boolean;
  missReason: boolean;
  strictTimer: boolean;
  examDate?: string;
  lastExportAt?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 15,
  retention: 0.9,
  maxIntervalDays: 60,
  confidence: true,
  missReason: true,
  strictTimer: false,
};
