import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { acronyms, domainOf, flashcards, questions } from '../content';
import { newId, recordAttempt } from '../db/repo';
import type { MissReason } from '../db/types';
import { buildQueue, quickSessionPlan } from '../engine/queue';
import { pickWeak } from '../engine/selection';
import { shuffle } from '../engine/rng';
import { fmtDuration, TopBar } from '../ui/components';
import { useData } from '../ui/data';
import { QuestionStep, type StepResult } from '../ui/question';
import { CardRunner, type CardTally } from './review/CardRunner';

const LIMIT = 5 * 60_000;

/** ~5 minutes: due mistakes → due reviews → a few new cards → 3 questions on weak objectives. */
export default function Quick() {
  const d = useData();
  const nav = useNavigate();
  const t0 = useRef(Date.now());
  const sessionId = useRef(`quick-${newId()}`);
  const [now, setNow] = useState(Date.now());
  const [phase, setPhase] = useState<'cards' | 'questions' | 'done'>('cards');
  const [tally, setTally] = useState<CardTally>({ reviewed: 0, again: 0, good: 0 });
  const [qi, setQi] = useState(0);
  const [qCorrect, setQCorrect] = useState(0);
  const pending = useRef<(StepResult & { missReason?: MissReason }) | null>(null);

  const plan = useMemo(() => {
    if (!d.ready) return null;
    const q = buildQueue({ deck: 'all', srs: d.srs, flashcards, acronyms, settings: d.settings, mastery: d.mastery });
    const cards = quickSessionPlan(q);
    const qs = pickWeak(questions, 3, d.mastery, Math.random).map((x) => ({ q: x, order: shuffle(x.options.map((_, i) => i)) }));
    return { cards, qs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.ready]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (plan && !plan.cards.length && phase === 'cards') setPhase('questions'); }, [plan, phase]);

  if (!plan) return null;
  const left = LIMIT - (now - t0.current);
  const timeUp = left <= 0;

  const nextQuestion = async () => {
    const r = pending.current, item = plan.qs[qi];
    if (r && item) {
      await recordAttempt({ sessionId: sessionId.current, questionId: item.q.id, objective: item.q.objective, domain: domainOf(item.q.objective), mode: 'quick',
        selected: r.selected, correct: r.correct, confidence: r.confidence, missReason: r.missReason, ms: r.ms, at: Date.now() });
      if (r.correct) setQCorrect((c) => c + 1);
    }
    pending.current = null;
    if (qi + 1 >= plan.qs.length || timeUp) setPhase('done');
    else setQi(qi + 1);
  };

  return (
    <div className="stack">
      <TopBar title="Sesión rápida" back="/" right={<span className={`timer ${timeUp ? 'low' : ''}`}>{timeUp ? 'Tiempo ✓' : fmtDuration(left)}</span>} />
      {phase === 'cards' && (
        <CardRunner items={plan.cards} onFinish={(t) => { setTally(t); setPhase(plan.qs.length ? 'questions' : 'done'); }} />
      )}
      {phase === 'questions' && plan.qs[qi] && (
        <>
          <p className="small muted">Pregunta {qi + 1} de {plan.qs.length} · objetivos débiles</p>
          <QuestionStep q={plan.qs[qi].q} order={plan.qs[qi].order} confidence={d.settings.confidence} missReason={d.settings.missReason}
            onAnswer={(r) => { pending.current = r; }} onMissReason={(m) => { if (pending.current) pending.current.missReason = m; }}
            onNext={nextQuestion} nextLabel={qi + 1 >= plan.qs.length ? 'Terminar' : 'Siguiente'} />
        </>
      )}
      {phase === 'done' && (
        <div className="stack-lg">
          <div className="card center stack">
            <div style={{ fontSize: 44 }}>⚡</div>
            <h2>¡Listo!</h2>
            <p className="muted">{tally.reviewed} tarjetas · {qCorrect}/{plan.qs.length} preguntas correctas · {fmtDuration(now - t0.current)}</p>
          </div>
          <button className="btn primary block" onClick={() => nav('/')}>Volver al inicio</button>
          <button className="btn block" onClick={() => nav('/review/all')}>Seguir repasando</button>
        </div>
      )}
    </div>
  );
}
