// Merges verified files from content/_staging into content/dN/{questions,flashcards,pbqs}.json.
// Each item goes to the domain of its objective; ids must not already exist. Items are kept sorted by id.
// Usage: npx tsx scripts/merge-staging.ts [--dry]
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_DIR } from './load-content.ts';

const dry = process.argv.includes('--dry');
const STAGING = join(CONTENT_DIR, '_staging');
if (!existsSync(STAGING)) { console.log('no staging dir'); process.exit(0); }

const kindOf = (f: string) => (f.endsWith('-questions.json') ? 'questions' : f.endsWith('-flashcards.json') ? 'flashcards' : f.endsWith('-pbqs.json') ? 'pbqs' : null);
const idKey = (id: string) => id.replace(/-(\d+)$/, (_, n) => `-${n.padStart(4, '0')}`).replace(/(\d)\.(\d)/, '$1.$2');

const target = new Map<string, { id: string; objective: string }[]>();
const load = (rel: string) => {
  if (!target.has(rel)) target.set(rel, existsSync(join(CONTENT_DIR, rel)) ? JSON.parse(readFileSync(join(CONTENT_DIR, rel), 'utf8')) : []);
  return target.get(rel)!;
};

const added: Record<string, number> = {};
let errors = 0;
for (const f of readdirSync(STAGING).filter((x) => x.endsWith('.json')).sort()) {
  const kind = kindOf(f);
  if (!kind) { console.warn(`skip ${f}`); continue; }
  const items = JSON.parse(readFileSync(join(STAGING, f), 'utf8')) as { id: string; objective: string }[];
  for (const it of items) {
    const rel = `d${it.objective[0]}/${kind}.json`;
    const arr = load(rel);
    if (arr.some((x) => x.id === it.id)) { console.error(`✗ ${f}: ${it.id} already exists in ${rel}`); errors++; continue; }
    arr.push(it);
    added[rel] = (added[rel] ?? 0) + 1;
  }
}
if (errors) process.exit(1);
for (const [rel, arr] of target) {
  arr.sort((a, b) => a.objective.localeCompare(b.objective, 'en', { numeric: true }) || idKey(a.id).localeCompare(idKey(b.id)));
  if (!dry) writeFileSync(join(CONTENT_DIR, rel), JSON.stringify(arr, null, 2) + '\n');
}
for (const [rel, n] of Object.entries(added).sort()) console.log(`  +${String(n).padStart(3)}  ${rel}`);
console.log(dry ? '(dry run, nothing written)' : '✓ merged — now run npm run validate:content');
