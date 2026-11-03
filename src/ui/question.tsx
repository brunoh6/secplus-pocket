import { Fragment, useEffect, useRef, useState } from 'react';
import type { Question } from '../content/schema';
import { messerSearchUrl, objectiveById } from '../content';
import { DomainDot } from './components';
import type { Confidence, MissReason } from '../db/types';

const KEYWORDS = /\b(BEST|MOST|FIRST|PRIMARY|PRIMARILY|LEAST|NOT|EXCEPT|NEXT|LAST|TWO|THREE|GREATEST|MAIN)\b/g;

export function Stem({ text }: { text: string }) {
  const parts = text.split(KEYWORDS);
  return (
    <p className="stem">
      {parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}
    </p>
  );
}

export function ObjectiveTag({ objective, link = true }: { objective: string; link?: boolean }) {
  const o = objectiveById.get(objective);
  return (
    <div className="row small muted" style={{ gap: 6, alignItems: 'flex-start' }}>
      <span style={{ paddingTop: 5 }}><DomainDot d={Number(objective[0])} /></span>
      <span className="grow"><strong>{objective}</strong> {o?.title}</span>
      {link && (
        <a href={messerSearchUrl(objective)} target="_blank" rel="noopener noreferrer" className="chip accent" style={{ textDecoration: 'none' }}>
          ▶ Video
        </a>
      )}
    </div>
  );
}

const LETTERS = 'ABCDEF';

/** Renders a question with options in `order` (shuffled indices). Selected/answer use ORIGINAL indices. */
export function QuestionView({
  q, order, selected, onToggle, reveal, showObjective = true,
}: {
  q: Question;
  order: number[];
  selected: number[];
  onToggle?: (originalIndex: number) => void;
  reveal?: boolean;
  showObjective?: boolean;
}) {
  return (
    <div className="stack">
      {showObjective && <ObjectiveTag objective={q.objective} link={!!reveal} />}
      <Stem text={q.stem} />
      {q.type === 'multi' && <span className="chip warn" style={{ alignSelf: 'flex-start' }}>Elige {q.answer.length}</span>}
      <div className="opts">
        {order.map((orig, pos) => {
          const isSel = selected.includes(orig);
          const isAns = q.answer.includes(orig);
          const cls = reveal ? (isAns ? 'correct' : isSel ? 'wrong' : '') : '';
          return (
            <button key={orig} className={`opt ${cls}`} aria-pressed={!reveal && isSel} disabled={reveal && !onToggle}
              onClick={() => !reveal && onToggle?.(orig)}>
              <span className="key">{reveal ? (isAns ? '✓' : isSel ? '✕' : LETTERS[pos]) : LETTERS[pos]}</span>
              <span className="grow">
                {q.options[orig].text}
                {reveal && <span className="why">{q.options[orig].why}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {reveal && (
        <>
          <div className="callout info"><strong>Explicación. </strong>{q.explanation}</div>
          {q.industryVsComptia && (
            <div className="callout warn"><strong>Industria vs CompTIA. </strong>{q.industryVsComptia}</div>
          )}
        </>
      )}
    </div>
  );
}

export const isCorrect = (q: Question, sel: number[]) =>
  sel.length === q.answer.length && q.answer.every((a) => sel.includes(a));

export function toggleSel(q: Question, sel: number[], i: number) {
  if (q.type === 'single') return [i];
  return sel.includes(i) ? sel.filter((x) => x !== i) : sel.length >= q.answer.length ? [...sel.slice(1), i] : [...sel, i];
}

const MISS: { v: MissReason; label: string }[] = [
  { v: 'unknown', label: 'No lo sabía' },
  { v: 'misread', label: 'Leí mal' },
  { v: 'terms', label: 'Confundí términos' },
  { v: 'two-good', label: 'Dudé entre dos' },
];

export interface StepResult { selected: number[]; correct: boolean; confidence?: Confidence; missReason?: MissReason; ms: number }

/**
 * One question with immediate feedback: pick → (confidence) → reveal → (why did I miss?) → next.
 * Calls onAnswer as soon as the answer is checked, and onUpdate if a miss reason is added.
 */
export function QuestionStep({
  q, order, confidence, missReason, onAnswer, onMissReason, onNext, nextLabel = 'Siguiente',
}: {
  q: Question;
  order: number[];
  confidence: boolean;
  missReason: boolean;
  onAnswer: (r: StepResult) => void;
  onMissReason?: (r: MissReason) => void;
  onNext: () => void;
  nextLabel?: string;
}) {
  const [sel, setSel] = useState<number[]>([]);
  const [done, setDone] = useState<StepResult | null>(null);
  const [reason, setReason] = useState<MissReason | null>(null);
  const t0 = useRef(Date.now());
  useEffect(() => { setSel([]); setDone(null); setReason(null); t0.current = Date.now(); window.scrollTo(0, 0); }, [q.id]);

  const ready = sel.length === q.answer.length;
  const check = (c?: Confidence) => {
    const r: StepResult = { selected: sel, correct: isCorrect(q, sel), confidence: c, ms: Date.now() - t0.current };
    setDone(r);
    onAnswer(r);
  };

  return (
    <div className="stack">
      <QuestionView q={q} order={order} selected={sel} onToggle={(i) => setSel(toggleSel(q, sel, i))} reveal={!!done} />
      {done && (
        <div className={`callout ${done.correct ? 'good' : 'bad'}`}>
          <strong>{done.correct ? (done.confidence === 'guess' ? '¡Correcta, pero adivinaste! ' : '¡Correcta! ') : 'Incorrecta. '}</strong>
          {done.correct && done.confidence === 'guess' && 'La añadí a "Mis errores" para repasarla.'}
          {!done.correct && 'Añadida a "Mis errores".'}
        </div>
      )}
      {done && !done.correct && missReason && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="small muted">¿Por qué fallaste? (opcional)</span>
          <div className="row wrap" style={{ gap: 8 }}>
            {MISS.map((m) => (
              <button key={m.v} className={`btn sm ${reason === m.v ? 'primary' : ''}`}
                onClick={() => { setReason(m.v); onMissReason?.(m.v); }}>{m.label}</button>
            ))}
          </div>
        </div>
      )}
      <div className="actionbar">
        {!done && confidence && (
          <>
            <button className="btn" disabled={!ready} onClick={() => check('guess')}>Adiviné</button>
            <button className="btn" disabled={!ready} onClick={() => check('unsure')}>Dudo</button>
            <button className="btn primary" disabled={!ready} onClick={() => check('sure')}>Seguro</button>
          </>
        )}
        {!done && !confidence && <button className="btn primary" disabled={!ready} onClick={() => check()}>Comprobar</button>}
        {done && <button className="btn primary" onClick={onNext}>{nextLabel}</button>}
      </div>
    </div>
  );
}
