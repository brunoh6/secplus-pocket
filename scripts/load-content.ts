import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const CONTENT_DIR = join(import.meta.dirname, '..', 'content');

export function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(CONTENT_DIR, rel), 'utf8'));
}

export type ContentKind = 'questions' | 'flashcards' | 'pbqs' | 'acronyms' | 'reference';

export function contentFiles() {
  const files: { rel: string; kind: ContentKind; domain?: number }[] = [];
  for (let d = 1; d <= 5; d++) {
    for (const kind of ['questions', 'flashcards', 'pbqs'] as const) {
      const rel = `d${d}/${kind}.json`;
      if (existsSync(join(CONTENT_DIR, rel))) files.push({ rel, kind, domain: d });
    }
  }
  if (existsSync(join(CONTENT_DIR, 'acronyms.json'))) files.push({ rel: 'acronyms.json', kind: 'acronyms' });
  const refDir = join(CONTENT_DIR, 'reference');
  if (existsSync(refDir))
    for (const f of readdirSync(refDir).filter((f) => f.endsWith('.json')).sort())
      files.push({ rel: `reference/${f}`, kind: 'reference' });
  return files;
}
