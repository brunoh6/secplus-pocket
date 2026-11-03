// Loads and validates all content at build time (JSON is bundled, so it is precached for offline use).
import {
  ObjectivesFileSchema, QuestionsFileSchema, FlashcardsFileSchema, AcronymsFileSchema, ReferenceSheetSchema, PbqsFileSchema,
  type Pbq, type Question, type Flashcard, type Acronym, type ReferenceSheet, type Domain,
} from './schema';
import objectivesRaw from '../../content/objectives.json';

const questionFiles = import.meta.glob('../../content/d*/questions.json', { eager: true, import: 'default' });
const flashcardFiles = import.meta.glob('../../content/d*/flashcards.json', { eager: true, import: 'default' });
const pbqFiles = import.meta.glob('../../content/d*/pbqs.json', { eager: true, import: 'default' });
const acronymFiles = import.meta.glob('../../content/acronyms.json', { eager: true, import: 'default' });
const referenceFiles = import.meta.glob('../../content/reference/*.json', { eager: true, import: 'default' });

const sorted = (m: Record<string, unknown>) => Object.keys(m).sort().map((k) => m[k]);

export const domains: Domain[] = ObjectivesFileSchema.parse(objectivesRaw).domains;
export const questions: Question[] = sorted(questionFiles).flatMap((f) => QuestionsFileSchema.parse(f));
export const pbqs: Pbq[] = sorted(pbqFiles).flatMap((f) => PbqsFileSchema.parse(f));
export const flashcards: Flashcard[] = sorted(flashcardFiles).flatMap((f) => FlashcardsFileSchema.parse(f));
export const acronyms: Acronym[] = sorted(acronymFiles)
  .flatMap((f) => AcronymsFileSchema.parse(f))
  .sort((a, b) => a.acronym.localeCompare(b.acronym, 'en', { sensitivity: 'base' }));
export const referenceSheets: ReferenceSheet[] = sorted(referenceFiles).map((f) => ReferenceSheetSchema.parse(f));

export const objectives = domains.flatMap((d) => d.objectives.map((o) => ({ ...o, domain: d.id })));
export const objectiveById = new Map(objectives.map((o) => [o.id, o]));
export const questionById = new Map(questions.map((q) => [q.id, q]));
export const pbqById = new Map(pbqs.map((p) => [p.id, p]));
export const flashcardById = new Map(flashcards.map((c) => [c.id, c]));
export const acronymById = new Map(acronyms.map((a) => [a.id, a]));

export const domainOf = (objective: string) => Number(objective.split('.')[0]);
export const domainById = new Map(domains.map((d) => [d.id, d]));

/** YouTube search for Professor Messer's free SY0-701 video on an objective (opened only when tapped). */
export function messerSearchUrl(objectiveId: string) {
  const o = objectiveById.get(objectiveId);
  const q = `Professor Messer SY0-701 ${objectiveId} ${o?.title ?? ''}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export type { Pbq, Question, Flashcard, Acronym, ReferenceSheet, Domain };
