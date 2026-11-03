import { useEffect, useRef, useState, type ReactNode } from 'react';
import { acronymById, flashcardById, questionById } from '../content';
import type { QueueItem } from '../engine/queue';
import { formatInterval, preview, Rating, type Grade } from '../engine/srs';
import type { Settings, SrsRecord } from '../db/types';
import { newCard } from '../engine/srs';
import { ObjectiveTag, QuestionView } from './question';

function faces(item: QueueItem): { front: ReactNode; back: ReactNode; label: string } {
  if (item.kind === 'acronym') {
    const a = acronymById.get(item.refId);
    return {
      label: 'Acrónimo',
      front: <div className="face center"><div className="big mono" style={{ fontSize: 40 }}>{a?.acronym}</div></div>,
      back: (
        <div className="face center stack">
          <div className="mono muted">{a?.acronym}</div>
          <div className="big">{a?.expansion}</div>
          {a?.note && <p className="muted">{a.note}</p>}
        </div>
      ),
    };
  }
  if (item.kind === 'mistake') {
    const q = questionById.get(item.refId);
    if (!q) return { label: 'Error', front: <p>Pregunta no encontrada</p>, back: <p>—</p> };
    const order = q.options.map((_, i) => i);
    return {
      label: 'Mis errores',
      front: <div className="face"><QuestionView q={q} order={order} selected={[]} showObjective={false} /></div>,
      back: <div className="face"><QuestionView q={q} order={order} selected={[]} reveal /></div>,
    };
  }
  const c = flashcardById.get(item.refId);
  return {
    label: 'Flashcard',
    front: <div className="face"><div className="big">{c?.front}</div></div>,
    back: (
      <div className="face stack">
        <div className="muted small">{c?.front}</div>
        <div className="answer">{c?.back}</div>
        {c?.comptiaNote && <div className="callout warn small"><strong>CompTIA: </strong>{c.comptiaNote}</div>}
      </div>
    ),
  };
}

const SWIPE: Record<'left' | 'right' | 'up' | 'down', { g: Grade; label: string; color: string }> = {
  left: { g: Rating.Again, label: 'Otra vez', color: 'var(--bad)' },
  down: { g: Rating.Hard, label: 'Difícil', color: 'var(--warn)' },
  right: { g: Rating.Good, label: 'Bien', color: 'var(--good)' },
  up: { g: Rating.Easy, label: 'Fácil', color: 'var(--accent)' },
};
const THRESH = 80;

/** Tap to flip; once flipped, swipe ← Otra vez · ↓ Difícil · → Bien · ↑ Fácil (or use the buttons). */
export function FlashcardView({ item, record, settings, onRate }: {
  item: QueueItem; record?: SrsRecord; settings: Settings; onRate: (g: Grade, ms: number) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const shown = useRef(Date.now());
  const elRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setFlipped(false); setDrag({ x: 0, y: 0 }); shown.current = Date.now(); elRef.current?.scrollTo(0, 0); }, [item.id]);

  const f = faces(item);
  const intervals = preview(record?.card ?? newCard(), settings);
  const now = Date.now();
  const dir = Math.abs(drag.x) > Math.abs(drag.y) ? (drag.x > 0 ? 'right' : 'left') : drag.y > 0 ? 'down' : 'up';
  const dist = Math.max(Math.abs(drag.x), Math.abs(drag.y));
  const active = flipped && dist > 20 ? SWIPE[dir] : null;

  const rate = (g: Grade) => onRate(g, Date.now() - shown.current);

  return (
    <div className="stack">
      <div className="flash-wrap">
        <div
          ref={elRef}
          className="flash"
          style={{
            transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 25}deg)`,
            transition: start.current ? 'none' : 'transform .2s',
            borderColor: active && dist > THRESH ? active.color : undefined,
          }}
          onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY, moved: false }; }}
          onPointerMove={(e) => {
            if (!start.current) return;
            const dx = e.clientX - start.current.x, dy = e.clientY - start.current.y;
            if (Math.hypot(dx, dy) > 10) {
              start.current.moved = true;
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            }
            if (flipped && start.current.moved) setDrag({ x: dx, y: dy });
          }}
          onPointerUp={() => {
            const s = start.current;
            start.current = null;
            if (!s) return;
            if (!s.moved) { setFlipped((v) => !v); return; }
            if (flipped && dist > THRESH) rate(SWIPE[dir].g);
            setDrag({ x: 0, y: 0 });
          }}
          onPointerCancel={() => { start.current = null; setDrag({ x: 0, y: 0 }); }}
        >
          <span className="hint chip">{f.label}{item.isNew ? ' · nueva' : ''}</span>
          {active && (
            <span className="swipe-tag" style={{ opacity: Math.min(1, dist / THRESH), background: active.color, color: '#fff' }}>{active.label}</span>
          )}
          {flipped ? f.back : f.front}
          {!flipped && <p className="tiny muted center" style={{ marginTop: 'auto' }}>Toca para voltear</p>}
        </div>
      </div>
      {item.objective && item.kind !== 'mistake' && <ObjectiveTag objective={item.objective} />}
      {flipped ? (
        <div className="grades">
          {([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]).map((g) => (
            <button key={g} className={`btn g${g}`} onClick={() => rate(g)}>
              {{ 1: 'Otra vez', 2: 'Difícil', 3: 'Bien', 4: 'Fácil' }[g]}
              <small>{formatInterval(intervals[g] - now)}</small>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn primary block" onClick={() => setFlipped(true)}>Mostrar respuesta</button>
      )}
      {flipped && <p className="tiny muted center">Desliza ← otra vez · ↓ difícil · → bien · ↑ fácil</p>}
    </div>
  );
}
