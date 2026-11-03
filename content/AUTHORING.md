# Authoring rules (SY0-701 content)

Format: see `SCHEMA.md`. Validate a file with
`npx tsx scripts/validate-content.ts --file <path> --kind questions|flashcards|pbqs [--objectives 1.1,1.2]`.

The learner is a cybersecurity professional (~4 years SOC/IR/AppSec). They need CompTIA's exact terminology and
framing, not beginner explanations.

## Hard rules
- English content. 100% original wording: never copy or closely paraphrase Professor Messer, Jason Dion,
  Sybex/Chapple, Gibson, ExamCompass, CertMaster or any question bank.
- Technical accuracy over volume. If you are not sure an item is correct per the SY0-701 objectives and CompTIA
  terminology, leave it out. Fewer correct items beats many dubious ones.
- Cover the sub-topics actually listed under each SY0-701 objective (the exam objectives bullet lists).
- Options and PBQ items are shuffled at runtime: never refer to them by letter or position.

## Questions
- CompTIA-style scenarios (mostly 2–4 sentences, not trivia) with a keyword in caps: BEST, MOST likely, FIRST,
  PRIMARY, MOST effective, LEAST…
- Exactly 4 options for `single`. `multi` ("Choose TWO", 5 options) sparingly.
- Distractors plausible (same domain and level) and of similar length/specificity to the answer. The answer must not be
  the only option that reuses words from the stem, nor systematically the longest.
- Exactly one defensible answer. If a distractor could be argued correct, rewrite the stem or the distractor.
- Every option has a `why`: the correct one starts with "Correct:"; each distractor explains why it is wrong *in this scenario*.
- `explanation`: the reasoning, plus exam technique when relevant ("FIRST means containment before eradication").
- `industryVsComptia` only when real-world practice differs from what CompTIA expects; otherwise null.
- Difficulty mix ≈ 20% 1 · 50% 2 · 30% 3.

## Flashcards
- Front readable in 3 seconds; back concise but complete (`\n` for lists).
- Prefer comparison cards ("X vs Y") for commonly confused concepts. `comptiaNote` for CompTIA wording or classic traps.

## PBQs
- One defensible solution. For `order`, the sequence must be one CompTIA material would agree on (e.g. CompTIA's IR
  phases, order of volatility). For `categorize`, only include items whose classification is unambiguous — skip items
  that sources classify differently. For `match`, each left item has exactly one correct right item.
- 4–7 elements is the sweet spot on a phone. Keep each element short (≤ 60 characters).
- Each element's `why` explains its position/pairing/classification.
