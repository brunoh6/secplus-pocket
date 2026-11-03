// Coverage per objective: how many flashcards / questions each objective has.
import { ObjectivesFileSchema } from '../src/content/schema.ts';
import { contentFiles, readJson } from './load-content.ts';

const objectives = ObjectivesFileSchema.parse(readJson('objectives.json'));
const fc: Record<string, number> = {}, q: Record<string, number> = {};
for (const f of contentFiles()) {
  if (f.kind !== 'questions' && f.kind !== 'flashcards') continue;
  for (const it of readJson(f.rel) as { objective: string }[]) {
    const m = f.kind === 'questions' ? q : fc;
    m[it.objective] = (m[it.objective] ?? 0) + 1;
  }
}
console.log('obj    fc   q   title');
for (const d of objectives.domains) {
  for (const o of d.objectives)
    console.log(`${o.id.padEnd(5)} ${String(fc[o.id] ?? 0).padStart(3)} ${String(q[o.id] ?? 0).padStart(3)}   ${o.title}${!fc[o.id] && !q[o.id] ? '  ← SIN CONTENIDO' : ''}`);
}
const tot = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
console.log(`\ntotal flashcards ${tot(fc)} · questions ${tot(q)}`);
