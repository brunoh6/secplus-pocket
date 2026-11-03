// Validates every JSON file under /content. Exit code 1 on any error (CI blocks deploys).
// Also usable on a single file: `npx tsx scripts/validate-content.ts --file <path> --kind questions|flashcards|pbqs [--objectives 1.1,1.2]`
// which additionally checks that its ids do not collide with existing content.
import { readFileSync } from 'node:fs';
import { ZodError, type ZodTypeAny } from 'zod';
import {
  ObjectivesFileSchema, QuestionsFileSchema, FlashcardsFileSchema, AcronymsFileSchema, ReferenceSheetSchema, PbqsFileSchema,
} from '../src/content/schema.ts';
import { contentFiles, readJson, type ContentKind } from './load-content.ts';

const SCHEMAS: Record<ContentKind, ZodTypeAny> = {
  questions: QuestionsFileSchema, flashcards: FlashcardsFileSchema, pbqs: PbqsFileSchema, acronyms: AcronymsFileSchema, reference: ReferenceSheetSchema,
};

const objectives = ObjectivesFileSchema.parse(readJson('objectives.json'));
const objectiveIds = new Set(objectives.domains.flatMap((d) => d.objectives.map((o) => o.id)));

type Item = { id: string; objective?: string; objectives?: string[]; options?: { text: string }[] };

function fmt(file: string, e: ZodError, data: unknown) {
  return e.issues.map((i) => {
    const idx = typeof i.path[0] === 'number' ? i.path[0] : undefined;
    const id = idx !== undefined && Array.isArray(data) ? (data[idx] as { id?: string })?.id : undefined;
    return `${file}${id ? ` [${id}]` : ''} ${i.path.join('.')}: ${i.message}`;
  });
}

/** Validates one file's content; registers ids in `seen`; returns item count. */
function checkFile(rel: string, kind: ContentKind, raw: unknown, seen: Map<string, string>, errors: string[], domain?: number, allowed?: Set<string>) {
  const res = SCHEMAS[kind].safeParse(raw);
  if (!res.success) { errors.push(...fmt(rel, res.error, raw)); return 0; }
  const items = (Array.isArray(res.data) ? res.data : [res.data]) as Item[];
  for (const it of items) {
    if (seen.has(it.id)) errors.push(`${rel} [${it.id}]: duplicate id (also in ${seen.get(it.id)})`);
    seen.set(it.id, rel);
    const objs = it.objective ? [it.objective] : it.objectives ?? [];
    for (const o of objs) if (!objectiveIds.has(o)) errors.push(`${rel} [${it.id}]: unknown objective ${o}`);
    if (domain && it.objective && !it.objective.startsWith(`${domain}.`))
      errors.push(`${rel} [${it.id}]: objective ${it.objective} does not belong to domain ${domain}`);
    if (allowed && it.objective && !allowed.has(it.objective))
      errors.push(`${rel} [${it.id}]: objective ${it.objective} is not one of ${[...allowed].join(', ')}`);
    if (it.options) {
      const texts = it.options.map((o) => o.text.trim().toLowerCase());
      if (new Set(texts).size !== texts.length) errors.push(`${rel} [${it.id}]: duplicate option text`);
    }
  }
  return kind === 'reference' ? (res.data as { rows: unknown[] }).rows.length : items.length;
}

const errors: string[] = [];
const seen = new Map<string, string>();
const counts: Record<string, number> = {};
const weightSum = objectives.domains.reduce((s, d) => s + d.weight, 0);
if (Math.abs(weightSum - 1) > 1e-6) errors.push(`objectives.json: weights sum to ${weightSum}, expected 1`);

for (const f of contentFiles()) {
  let raw: unknown;
  try { raw = readJson(f.rel); } catch (e) { errors.push(`${f.rel}: invalid JSON (${(e as Error).message})`); continue; }
  counts[f.rel] = checkFile(f.rel, f.kind, raw, seen, errors, f.domain);
}

const argv = process.argv.slice(2);
const flag = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const single = flag('file');
if (single) {
  const kind = flag('kind') as ContentKind;
  if (!SCHEMAS[kind]) { console.error('--kind must be questions | flashcards | pbqs'); process.exit(2); }
  const allowed = flag('objectives') ? new Set(flag('objectives')!.split(',')) : undefined;
  const fileErrors: string[] = [];
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(single, 'utf8')); } catch (e) { console.error(`✗ ${single}: invalid JSON (${(e as Error).message})`); process.exit(1); }
  const n = checkFile(single, kind, raw, seen, fileErrors, undefined, allowed);
  if (fileErrors.length) { console.error(`✗ ${fileErrors.length} error(s) in ${single}:`); for (const e of fileErrors) console.error('  ' + e); process.exit(1); }
  console.log(`✓ ${single} OK (${n} ${kind}, no id collisions with /content)`);
  process.exit(errors.length ? 1 : 0);
}

for (const [file, n] of Object.entries(counts)) console.log(`  ${file.padEnd(32)} ${n}`);
if (errors.length) {
  console.error(`\n✗ ${errors.length} content error(s):`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`\n✓ content OK (${seen.size} ids)`);
