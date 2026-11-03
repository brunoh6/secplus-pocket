import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { domains, pbqs, questions } from '../../content';
import { PBQ_TYPE_LABEL } from '../../engine/pbq';
import { deleteSession } from '../../db/repo';
import type { SessionMode } from '../../db/types';
import { DomainDot, fmtDuration, Seg, Sheet, TopBar } from '../../ui/components';
import { useData } from '../../ui/data';
import { createSession, EXAM_MODES } from '../sessions';
import { EXAM_PBQS, examQuestions, pickPbqs, quizQuestions, reviewedPool, scopeLabel, type PbqFilter, type QuizScope } from './pools';

const MODE_LABEL: Record<string, string> = { exam: 'Simulacro', mini: 'Mini-examen', diagnostic: 'Diagnóstico', quiz: 'Quiz', daily: 'Reto diario', pbq: 'PBQs' };
export const modeLabel = (m: SessionMode) => MODE_LABEL[m] ?? m;

export default function Train() {
  const d = useData();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const preDomain = Number(params.get('domain')) || 0;
  const [quizOpen, setQuizOpen] = useState(preDomain > 0);
  const [miniOpen, setMiniOpen] = useState(false);
  const [pbqOpen, setPbqOpen] = useState(false);
  const inProgress = d.sessions.filter((s) => !s.endedAt && s.exam && (EXAM_MODES.includes(s.mode) || s.mode === 'quiz' || s.mode === 'pbq')).sort((a, b) => b.startedAt - a.startedAt);
  const pool = reviewedPool().length;

  const startExam = async (mode: SessionMode, count: number, minutes: number) => {
    const qs = examQuestions(count, d.seenQuestions, mode === 'exam');
    const id = await createSession({ mode, questions: qs, label: `${count} preguntas`, limitMs: minutes * 60_000, strict: d.settings.strictTimer, seen: d.seenQuestions });
    nav(`/train/exam/${id}`);
  };

  return (
    <div className="stack-lg">
      <TopBar title="Entrenar" back={false} />

      {inProgress.length > 0 && (
        <section className="stack">
          <h3>En curso</h3>
          {inProgress.map((s) => {
            const ex = s.exam!;
            const answered = Object.keys(ex.answers).length;
            const isExam = EXAM_MODES.includes(s.mode);
            return (
              <div key={s.id} className="card tight row">
                <div className="grow">
                  <strong>{modeLabel(s.mode)}</strong> <span className="small muted">{s.label}</span>
                  <div className="tiny muted">
                    {isExam ? `${answered}/${ex.questionIds.length} respondidas · ${fmtDuration(ex.limitMs - ex.elapsedMs)} restantes` : `pregunta ${ex.index + 1}/${ex.questionIds.length}`}
                  </div>
                </div>
                <button className="btn sm ghost" onClick={() => confirm('¿Descartar esta sesión?') && deleteSession(s.id)}>Descartar</button>
                <Link className="btn sm primary" to={isExam ? `/train/exam/${s.id}` : `/train/quiz/${s.id}`}>Seguir</Link>
              </div>
            );
          })}
        </section>
      )}

      <section className="stack">
        <h3>Aprender con feedback</h3>
        <Mode icon="🧠" title="Quiz" sub="Por dominio, objetivo, mixto o tus débiles. Explicación inmediata." onClick={() => setQuizOpen(true)} />
        <Mode icon="🎯" title="Reto diario" sub="10 preguntas del día, mismas todo el día. Suma a la racha." to="/train/daily" />
        <Mode icon="🧩" title="PBQs interactivas" sub={`Ordenar, emparejar y clasificar · ${pbqs.length} disponibles`} onClick={() => setPbqOpen(true)} disabled={!pbqs.length} />
      </section>

      <section className="stack">
        <h3>Probarte como en el examen</h3>
        <Mode icon="🧭" title="Diagnóstico" sub="30 preguntas · 30 min. Detecta tus débiles para empezar." onClick={() => startExam('diagnostic', 30, 30)} disabled={pool < 10} />
        <Mode icon="⏱️" title="Mini-examen" sub="10, 20 o 30 preguntas a ritmo de examen. Feedback al final." onClick={() => setMiniOpen(true)} disabled={pool < 10} />
        <Mode icon="🏁" title="Simulacro completo" sub={`90 preguntas · 90 min · ${pbqs.filter((p) => p.status === 'reviewed').length >= EXAM_PBQS ? `empieza con ${EXAM_PBQS} PBQs · ` : ''}puntaje estimado 100–900.`} onClick={() => startExam('exam', 90, 90)} disabled={pool < 90} />
        {pool < 270 && (
          <p className="tiny muted">
            Banco actual: {pool} preguntas revisadas. Un simulacro usa 90, así que se repetirán preguntas entre simulacros
            hasta que el banco crezca. La app te muestra también el puntaje solo sobre preguntas inéditas.
          </p>
        )}
      </section>

      <QuizSheet open={quizOpen} onClose={() => setQuizOpen(false)} preDomain={preDomain} />
      <PbqSheet open={pbqOpen} onClose={() => setPbqOpen(false)} />

      <Sheet open={miniOpen} onClose={() => setMiniOpen(false)}>
        <div className="stack">
          <h2>Mini-examen</h2>
          <p className="small muted">1 minuto por pregunta (el ritmo del examen real). Puedes marcar preguntas y volver a ellas.</p>
          {[10, 20, 30].map((n) => (
            <button key={n} className="btn block" onClick={() => { setMiniOpen(false); startExam('mini', n, n); }}>{n} preguntas · {n} min</button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function Mode({ icon, title, sub, to, onClick, disabled }: { icon: string; title: string; sub: string; to?: string; onClick?: () => void; disabled?: boolean }) {
  const inner = (
    <>
      <span style={{ fontSize: 28 }}>{icon}</span>
      <div className="grow" style={{ textAlign: 'left' }}>
        <h3>{title}</h3>
        <p className="small muted">{sub}</p>
      </div>
      <span className="muted">›</span>
    </>
  );
  if (to) return <Link to={to} className="card link row">{inner}</Link>;
  return <button className="card link row" style={{ width: '100%', opacity: disabled ? 0.5 : 1 }} disabled={disabled} onClick={onClick}>{inner}</button>;
}

function QuizSheet({ open, onClose, preDomain }: { open: boolean; onClose: () => void; preDomain: number }) {
  const d = useData();
  const nav = useNavigate();
  const [kind, setKind] = useState<QuizScope['kind']>(preDomain ? 'domain' : 'mixed');
  const [domain, setDomain] = useState(preDomain || 1);
  const [objective, setObjective] = useState('1.1');
  const [count, setCount] = useState(10);
  const scope: QuizScope =
    kind === 'domain' ? { kind, domain } : kind === 'objective' ? { kind, objective } : ({ kind } as QuizScope);
  const available =
    kind === 'domain' ? questions.filter((q) => q.objective.startsWith(`${domain}.`)).length
    : kind === 'objective' ? questions.filter((q) => q.objective === objective).length
    : kind === 'unseen' ? questions.filter((q) => !d.seenQuestions.has(q.id)).length
    : questions.length;

  const start = async () => {
    const qs = quizQuestions(scope, count, d.mastery, d.seenQuestions);
    if (!qs.length) return;
    const id = await createSession({ mode: 'quiz', questions: qs, label: scopeLabel(scope), seen: d.seenQuestions });
    onClose();
    nav(`/train/quiz/${id}`);
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="stack">
        <h2>Quiz</h2>
        <div className="field">
          <label>Qué practicar</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as QuizScope['kind'])}>
            <option value="mixed">Mixto ponderado por el examen</option>
            <option value="weak">Solo mis débiles</option>
            <option value="domain">Un dominio</option>
            <option value="objective">Un objetivo</option>
            <option value="unseen">Nunca vistas</option>
          </select>
        </div>
        {kind === 'domain' && (
          <div className="field">
            <label>Dominio</label>
            <select value={domain} onChange={(e) => setDomain(Number(e.target.value))}>
              {domains.map((dm) => <option key={dm.id} value={dm.id}>D{dm.id} · {dm.name}</option>)}
            </select>
          </div>
        )}
        {kind === 'objective' && (
          <div className="field">
            <label>Objetivo</label>
            <select value={objective} onChange={(e) => setObjective(e.target.value)}>
              {domains.flatMap((dm) => dm.objectives).map((o) => <option key={o.id} value={o.id}>{o.id} {o.title}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label>Preguntas</label>
          <Seg value={count} onChange={setCount} options={[5, 10, 20, 30].map((n) => ({ value: n, label: n }))} />
        </div>
        <p className="tiny muted row" style={{ gap: 6 }}>
          {kind === 'domain' && <DomainDot d={domain} />} {available} disponibles
          {d.settings.confidence && ' · con nivel de confianza'}
        </p>
        <button className="btn primary block" disabled={!available} onClick={start}>Empezar</button>
      </div>
    </Sheet>
  );
}

function PbqSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useData();
  const nav = useNavigate();
  const [type, setType] = useState<PbqFilter['type']>('all');
  const [count, setCount] = useState(3);
  const [missed, setMissed] = useState(false);
  // Latest result per PBQ; "missed" = last attempt not fully correct.
  const last = new Map<string, boolean>();
  for (const a of d.attempts.filter((x) => x.questionId.startsWith('pbq-')).sort((x, y) => x.at - y.at)) last.set(a.questionId, a.correct);
  const missedIds = new Set(Array.from(last).filter(([, ok]) => !ok).map(([id]) => id));
  const start = async () => {
    const items = pickPbqs({ count, type, onlyMissed: missed ? missedIds : undefined }, d.seenQuestions, d.mastery);
    if (!items.length) return;
    const id = await createSession({ mode: 'pbq', questions: items, label: type === 'all' ? 'Mixtas' : PBQ_TYPE_LABEL[type], seen: d.seenQuestions });
    onClose();
    nav(`/train/quiz/${id}`);
  };
  const available = pbqs.filter((p) => (type === 'all' || p.type === type) && (!missed || missedIds.has(p.id))).length;
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="stack">
        <h2>PBQs interactivas</h2>
        <p className="small muted">Como las del examen, en formato táctil. Crédito parcial y explicación de cada elemento.</p>
        <div className="field">
          <label>Tipo</label>
          <Seg value={type} onChange={setType} options={[{ value: 'all', label: 'Todas' }, { value: 'order', label: 'Ordenar' }, { value: 'match', label: 'Emparejar' }, { value: 'categorize', label: 'Clasificar' }]} />
        </div>
        <div className="field">
          <label>Cantidad</label>
          <Seg value={count} onChange={setCount} options={[1, 3, 5, 10].map((n) => ({ value: n, label: n }))} />
        </div>
        <label className="toggle"><span>Solo las que fallé ({missedIds.size})</span>
          <input type="checkbox" checked={missed} onChange={(e) => setMissed(e.target.checked)} /></label>
        <p className="tiny muted">{available} disponibles</p>
        <button className="btn primary block" disabled={!available} onClick={start}>Empezar</button>
      </div>
    </Sheet>
  );
}
