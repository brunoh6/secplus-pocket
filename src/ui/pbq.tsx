import { useState, type CSSProperties } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Pbq } from '../content/schema';
import { emptyAnswer, gradePbq, isComplete, PBQ_TYPE_LABEL, rightOptions, type PbqAnswer } from '../engine/pbq';
import { ObjectiveTag } from './question';

type OrderPbq = Extract<Pbq, { type: 'order' }>;
type MatchPbq = Extract<Pbq, { type: 'match' }>;
type CatPbq = Extract<Pbq, { type: 'categorize' }>;

interface Props {
  p: Pbq;
  layout: number[];
  answer: PbqAnswer;
  onChange?: (a: PbqAnswer) => void;
  reveal?: boolean;
}

/** Touch-friendly mini PBQ: drag to order, tap-to-pair, or tap chips to classify. */
export function PbqView(props: Props) {
  const { p, reveal } = props;
  const g = reveal ? gradePbq(p, props.answer) : null;
  return (
    <div className="stack">
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="chip warn">PBQ · {PBQ_TYPE_LABEL[p.type]}</span>
        {g && <span className={`chip ${g.correct ? 'good' : g.score >= 0.5 ? 'warn' : 'bad'}`}>{Math.round(g.score * 100)}%</span>}
      </div>
      <ObjectiveTag objective={p.objective} link={!!reveal} />
      <h2>{p.title}</h2>
      <p className="stem">{p.prompt}</p>
      {p.type === 'order' && <OrderView {...props} p={p} />}
      {p.type === 'match' && <MatchView {...props} p={p} />}
      {p.type === 'categorize' && <CatView {...props} p={p} />}
      {reveal && (
        <>
          <div className="callout info"><strong>Explicación. </strong>{p.explanation}</div>
          {p.industryVsComptia && <div className="callout warn"><strong>Industria vs CompTIA. </strong>{p.industryVsComptia}</div>}
        </>
      )}
    </div>
  );
}

/* ---------- order ---------- */

function SortRow({ id, children, disabled, tone }: { id: number; children: React.ReactNode; disabled?: boolean; tone?: 'good' | 'bad' }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: id + 1, disabled });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined,
    boxShadow: isDragging ? '0 8px 24px rgb(0 0 0 / .2)' : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className={`pbq-row ${tone ? `opt ${tone === 'good' ? 'correct' : 'wrong'}` : 'opt'}`}>
      {!disabled && <button className="drag-handle" aria-label="Arrastrar" {...attributes} {...listeners}>≡</button>}
      {children}
    </div>
  );
}

const A11Y = {
  screenReaderInstructions: { draggable: 'Para mover un elemento, pulsa espacio, usa las flechas y pulsa espacio otra vez para soltarlo.' },
  announcements: {
    onDragStart: () => 'Elemento tomado.',
    onDragOver: () => '',
    onDragEnd: () => 'Elemento soltado.',
    onDragCancel: () => 'Movimiento cancelado.',
  },
};

function OrderView({ p, answer, onChange, reveal }: Props & { p: OrderPbq }) {
  const order = answer.order ?? [];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const move = (from: number, to: number) => onChange?.({ ...answer, order: arrayMove(order, from, to) });
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    move(order.indexOf(Number(e.active.id) - 1), order.indexOf(Number(e.over.id) - 1));
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="tiny muted">▲ {p.firstLabel}</span>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={A11Y}>
        <SortableContext items={order.map((i) => i + 1)} strategy={verticalListSortingStrategy}>
          <div className="opts">
            {order.map((orig, pos) => (
              <SortRow key={orig} id={orig} disabled={reveal} tone={reveal ? (orig === pos ? 'good' : 'bad') : undefined}>
                <span className="key">{pos + 1}</span>
                <span className="grow">
                  {p.items[orig].text}
                  {reveal && (
                    <span className="why">
                      {orig !== pos && <strong>Va en la posición {orig + 1}. </strong>}
                      {p.items[orig].why}
                    </span>
                  )}
                </span>
                {!reveal && (
                  <span className="updown">
                    <button aria-label="Subir" disabled={pos === 0} onClick={() => move(pos, pos - 1)}>▲</button>
                    <button aria-label="Bajar" disabled={pos === order.length - 1} onClick={() => move(pos, pos + 1)}>▼</button>
                  </span>
                )}
              </SortRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <span className="tiny muted">▼ {p.lastLabel}</span>
      {!reveal && <span className="tiny muted center">Arrastra con ≡ o usa ▲▼</span>}
    </div>
  );
}

/* ---------- match ---------- */

function MatchView({ p, layout, answer, onChange, reveal }: Props & { p: MatchPbq }) {
  const rights = rightOptions(p);
  const match = answer.match ?? p.pairs.map(() => null);
  const [active, setActive] = useState<number | null>(0);
  const assign = (opt: number) => {
    const target = active ?? match.findIndex((m) => m === null);
    if (target < 0) return;
    const next = match.map((m) => (m === opt ? null : m));   // each option used once
    next[target] = opt;
    onChange?.({ ...answer, match: next });
    const nextEmpty = next.findIndex((m, i) => m === null && i !== target);
    setActive(nextEmpty >= 0 ? nextEmpty : null);
  };
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row between tiny muted"><span>{p.leftLabel}</span><span>{p.rightLabel}</span></div>
      <div className="opts">
        {p.pairs.map((pair, i) => {
          const chosen = match[i];
          const tone = reveal ? (chosen === i ? 'correct' : 'wrong') : '';
          return (
            <button key={i} className={`opt ${tone}`} aria-pressed={!reveal && active === i}
              onClick={() => { if (reveal) return; if (active === i && chosen !== null) { const n = match.slice(); n[i] = null; onChange?.({ ...answer, match: n }); } setActive(i); }}>
              <span className="grow">
                <strong>{pair.left}</strong>
                <span className="match-slot">{chosen === null ? (reveal ? '—' : 'Toca y elige abajo') : `→ ${rights[chosen]}`}</span>
                {reveal && (
                  <span className="why">
                    {chosen !== i && <strong>Correcto: {pair.right}. </strong>}
                    {pair.why}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {!reveal && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="tiny muted">{active !== null ? `Elige para «${p.pairs[active].left}»` : 'Toca un elemento de arriba para cambiarlo'}</span>
          <div className="row wrap" style={{ gap: 8 }}>
            {layout.map((opt) => {
              const usedBy = match.indexOf(opt);
              return (
                <button key={opt} className={`btn sm ${usedBy >= 0 ? '' : 'primary'}`} style={{ opacity: usedBy >= 0 ? 0.55 : 1 }} onClick={() => assign(opt)}>
                  {rights[opt]}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {reveal && p.distractors.length > 0 && <span className="tiny muted">Sobraban: {p.distractors.join(', ')}</span>}
    </div>
  );
}

/* ---------- categorize ---------- */

function CatView({ p, layout, answer, onChange, reveal }: Props & { p: CatPbq }) {
  const cat: Record<string, string>[] = answer.cat ?? p.items.map(() => ({}));
  const set = (i: number, dim: string, v: string) => {
    const next = cat.map((c) => ({ ...c }));
    next[i][dim] = v;
    onChange?.({ ...answer, cat: next });
  };
  return (
    <div className="stack" style={{ gap: 10 }}>
      {layout.map((i) => {
        const it = p.items[i];
        const ok = reveal ? p.dimensions.every((d) => cat[i]?.[d.id] === it.answers[d.id]) : null;
        return (
          <div key={i} className={`card tight stack ${reveal ? (ok ? 'cat-good' : 'cat-bad') : ''}`} style={{ gap: 8 }}>
            <strong>{it.text}</strong>
            {p.dimensions.map((d) => (
              <div key={d.id} className="stack" style={{ gap: 4 }}>
                {p.dimensions.length > 1 && <span className="tiny muted">{d.label}</span>}
                <div className="row wrap" style={{ gap: 6 }}>
                  {d.options.map((o) => {
                    const chosen = cat[i]?.[d.id] === o;
                    const isAns = it.answers[d.id] === o;
                    const cls = reveal ? (isAns ? 'chip good' : chosen ? 'chip bad' : 'chip') : chosen ? 'chip accent' : 'chip';
                    return (
                      <button key={o} className={`${cls} cat-chip`} aria-pressed={chosen} disabled={reveal} onClick={() => set(i, d.id, o)}>
                        {reveal && isAns ? '✓ ' : reveal && chosen ? '✕ ' : ''}{o}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {reveal && <span className="small muted">{it.why}</span>}
          </div>
        );
      })}
    </div>
  );
}

export interface PbqStepResult { answer: PbqAnswer; score: number; correct: boolean; ms: number }

/** One PBQ with immediate feedback: solve → Comprobar → reveal → next. */
export function PbqStep({ p, layout, onAnswer, onNext, nextLabel = 'Siguiente' }: {
  p: Pbq; layout: number[]; onAnswer: (r: PbqStepResult) => void; onNext: () => void; nextLabel?: string;
}) {
  const [answer, setAnswer] = useState<PbqAnswer>(() => emptyAnswer(p, layout));
  const [done, setDone] = useState<PbqStepResult | null>(null);
  const [t0] = useState(() => Date.now());
  const ready = isComplete(p, answer);
  const check = () => {
    const g = gradePbq(p, answer);
    const r = { answer, score: g.score, correct: g.correct, ms: Date.now() - t0 };
    setDone(r);
    onAnswer(r);
  };
  return (
    <div className="stack">
      <PbqView p={p} layout={layout} answer={answer} onChange={setAnswer} reveal={!!done} />
      {done && (
        <div className={`callout ${done.correct ? 'good' : done.score >= 0.5 ? 'warn' : 'bad'}`}>
          <strong>{done.correct ? '¡Perfecto!' : `Crédito parcial: ${Math.round(done.score * 100)}%.`}</strong>
          {!done.correct && ' Revisa la explicación de cada elemento.'}
        </div>
      )}
      <div className="actionbar">
        {!done
          ? <button className="btn primary" disabled={!ready} onClick={check}>{ready ? 'Comprobar' : 'Completa todos los elementos'}</button>
          : <button className="btn primary" onClick={onNext}>{nextLabel}</button>}
      </div>
    </div>
  );
}
