// Single source of truth for content shape. Used at build time (scripts/validate-content.ts),
// at runtime (loader), and to generate content/schema/*.schema.json.
import { z } from 'zod';

const objectiveId = z.string().regex(/^[1-5]\.[1-9]$/, 'objective must look like "4.8"');
const status = z.enum(['draft', 'reviewed']).default('reviewed');

export const ObjectiveSchema = z.object({
  id: objectiveId,
  title: z.string().min(5),
});

export const DomainSchema = z.object({
  id: z.number().int().min(1).max(5),
  name: z.string(),
  weight: z.number().gt(0).lt(1),
  objectives: z.array(ObjectiveSchema).min(1),
});

export const ObjectivesFileSchema = z.object({
  exam: z.literal('SY0-701'),
  domains: z.array(DomainSchema).length(5),
});

export const OptionSchema = z.object({
  text: z.string().min(1),
  why: z.string().min(10, 'every option needs a "why" (correct or incorrect reason)'),
});

export const QuestionSchema = z
  .object({
    id: z.string().regex(/^q-[1-5]\.[1-9]-\d{3}$/, 'id must look like "q-4.8-001"'),
    objective: objectiveId,
    type: z.enum(['single', 'multi']).default('single'),
    difficulty: z.number().int().min(1).max(3).default(2),
    stem: z.string().min(20),
    options: z.array(OptionSchema).min(4).max(6),
    answer: z.array(z.number().int().min(0)).min(1),
    explanation: z.string().min(20),
    industryVsComptia: z.string().nullable().optional(),
    tags: z.array(z.string()).default([]),
    status,
  })
  .superRefine((q, ctx) => {
    if (q.answer.some((i) => i >= q.options.length))
      ctx.addIssue({ code: 'custom', message: 'answer index out of range' });
    if (new Set(q.answer).size !== q.answer.length)
      ctx.addIssue({ code: 'custom', message: 'duplicate answer index' });
    if (q.type === 'single' && q.answer.length !== 1)
      ctx.addIssue({ code: 'custom', message: 'single questions need exactly one answer' });
    if (q.type === 'multi' && q.answer.length < 2)
      ctx.addIssue({ code: 'custom', message: 'multi questions need 2+ answers' });
    if (!q.id.startsWith(`q-${q.objective}-`))
      ctx.addIssue({ code: 'custom', message: 'id prefix must match objective' });
    // Options are shuffled at runtime, so letter references are meaningless.
    const letterRef = /\b(option|answer|choice)\s+[A-D]\b|\(([A-D])\)/;
    const texts = [q.explanation, ...q.options.map((o) => o.why)];
    if (texts.some((t) => letterRef.test(t)))
      ctx.addIssue({ code: 'custom', message: 'do not reference options by letter (they are shuffled)' });
  });

export const FlashcardSchema = z
  .object({
    id: z.string().regex(/^fc-[1-5]\.[1-9]-\d{3}$/, 'id must look like "fc-5.2-004"'),
    objective: objectiveId,
    front: z.string().min(3),
    back: z.string().min(1),
    comptiaNote: z.string().optional(),
    tags: z.array(z.string()).default([]),
    status,
  })
  .superRefine((c, ctx) => {
    if (!c.id.startsWith(`fc-${c.objective}-`))
      ctx.addIssue({ code: 'custom', message: 'id prefix must match objective' });
  });

export const AcronymSchema = z
  .object({
    id: z.string().regex(/^acr-[A-Za-z0-9&./+-]+$/),
    acronym: z.string().min(2),
    expansion: z.string().min(3),
    note: z.string().optional(),
    objectives: z.array(objectiveId).default([]),
  })
  .superRefine((a, ctx) => {
    if (a.id !== `acr-${a.acronym.replace(/\s+/g, '')}` && !a.id.startsWith(`acr-${a.acronym.replace(/\s+/g, '')}-`))
      ctx.addIssue({ code: 'custom', message: 'id must be "acr-" + acronym (suffix "-2" allowed for duplicates)' });
  });

export const ReferenceSheetSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    description: z.string().optional(),
    objectives: z.array(objectiveId).default([]),
    columns: z.array(z.string()).min(2),
    rows: z.array(z.array(z.string())).min(1),
  })
  .superRefine((s, ctx) => {
    s.rows.forEach((r, i) => {
      if (r.length !== s.columns.length)
        ctx.addIssue({ code: 'custom', message: `row ${i} has ${r.length} cells, expected ${s.columns.length}` });
    });
  });

// Performance-based questions (touch-friendly mini PBQs). Three interaction types.
const pbqBase = {
  id: z.string().regex(/^pbq-[1-5]\.[1-9]-\d{3}$/, 'id must look like "pbq-4.8-001"'),
  objective: objectiveId,
  title: z.string().min(5).max(80),
  prompt: z.string().min(20),
  explanation: z.string().min(20),
  industryVsComptia: z.string().nullable().optional(),
  difficulty: z.number().int().min(1).max(3).default(2),
  tags: z.array(z.string()).default([]),
  status,
};

const PbqOrderSchema = z.object({
  ...pbqBase,
  type: z.literal('order'),
  /** Items listed in the CORRECT order; the app shuffles them. */
  items: z.array(z.object({ text: z.string().min(1), why: z.string().min(5) })).min(3).max(8),
  firstLabel: z.string().min(2),   // e.g. "Most volatile", "First step"
  lastLabel: z.string().min(2),    // e.g. "Least volatile", "Last step"
});

const PbqMatchSchema = z.object({
  ...pbqBase,
  type: z.literal('match'),
  leftLabel: z.string().min(2),
  rightLabel: z.string().min(2),
  pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1), why: z.string().min(5) })).min(3).max(8),
  /** Extra right-side options that match nothing. */
  distractors: z.array(z.string().min(1)).max(4).default([]),
});

const PbqCategorizeSchema = z.object({
  ...pbqBase,
  type: z.literal('categorize'),
  /** 1–2 dimensions, e.g. [{id:"category", options:[...]}, {id:"type", options:[...]}]. */
  dimensions: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9-]*$/), label: z.string().min(2), options: z.array(z.string().min(1)).min(2).max(7) })).min(1).max(2),
  items: z.array(z.object({ text: z.string().min(1), answers: z.record(z.string()), why: z.string().min(5) })).min(3).max(10),
});

export const PbqSchema = z
  .discriminatedUnion('type', [PbqOrderSchema, PbqMatchSchema, PbqCategorizeSchema])
  .superRefine((p, ctx) => {
    if (!p.id.startsWith(`pbq-${p.objective}-`)) ctx.addIssue({ code: 'custom', message: 'id prefix must match objective' });
    const dup = (xs: string[], what: string) => {
      const n = xs.map((x) => x.trim().toLowerCase());
      if (new Set(n).size !== n.length) ctx.addIssue({ code: 'custom', message: `duplicate ${what}` });
    };
    if (p.type === 'order') dup(p.items.map((i) => i.text), 'order item');
    if (p.type === 'match') {
      dup(p.pairs.map((x) => x.left), 'left item');
      dup([...p.pairs.map((x) => x.right), ...p.distractors], 'right option (each right side must be unique; add distractors for extras)');
    }
    if (p.type === 'categorize') {
      dup(p.items.map((i) => i.text), 'item');
      for (const it of p.items) {
        const keys = Object.keys(it.answers).sort().join(',');
        if (keys !== p.dimensions.map((d) => d.id).sort().join(','))
          ctx.addIssue({ code: 'custom', message: `item "${it.text}" must answer exactly the dimensions ${p.dimensions.map((d) => d.id).join(', ')}` });
        for (const d of p.dimensions)
          if (it.answers[d.id] !== undefined && !d.options.includes(it.answers[d.id]))
            ctx.addIssue({ code: 'custom', message: `item "${it.text}": "${it.answers[d.id]}" is not an option of ${d.id}` });
      }
    }
  });

export const QuestionsFileSchema = z.array(QuestionSchema);
export const FlashcardsFileSchema = z.array(FlashcardSchema);
export const AcronymsFileSchema = z.array(AcronymSchema);
export const PbqsFileSchema = z.array(PbqSchema);
export type Pbq = z.infer<typeof PbqSchema>;

export type Objective = z.infer<typeof ObjectiveSchema>;
export type Domain = z.infer<typeof DomainSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Flashcard = z.infer<typeof FlashcardSchema>;
export type Acronym = z.infer<typeof AcronymSchema>;
export type ReferenceSheet = z.infer<typeof ReferenceSheetSchema>;
