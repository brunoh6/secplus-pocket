// Writes content/schema/*.schema.json from the zod schemas (for editor autocompletion).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { QuestionsFileSchema, FlashcardsFileSchema, AcronymsFileSchema, ReferenceSheetSchema, ObjectivesFileSchema, PbqsFileSchema } from '../src/content/schema.ts';
import { CONTENT_DIR } from './load-content.ts';

const out = join(CONTENT_DIR, 'schema');
mkdirSync(out, { recursive: true });
const all = { pbqs: PbqsFileSchema, questions: QuestionsFileSchema, flashcards: FlashcardsFileSchema, acronyms: AcronymsFileSchema, reference: ReferenceSheetSchema, objectives: ObjectivesFileSchema };
for (const [name, s] of Object.entries(all))
  writeFileSync(join(out, `${name}.schema.json`), JSON.stringify(zodToJsonSchema(s, name), null, 2) + '\n');
console.log('schemas written to content/schema/');
