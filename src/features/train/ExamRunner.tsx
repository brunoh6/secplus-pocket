import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pbqById, questionById } from '../../content';
import { getSession, putSession } from '../../db/repo';
import type { Session } from '../../db/types';
import { fmtDuration, Sheet } from '../../ui/components';
import { QuestionView, toggleSel } from '../../ui/question';
import { PbqView } from '../../ui/pbq';
import { emptyAnswer, isPbqId } from '../../engine/pbq';
import { finishExam, isAnswered } from '../sessions';
import { modeLabel } from './Train';

/**
 * Exam-style runner (simulacro, mini-examen, diagnóstico): no feedback until the end, flag & jump grid.
 * Timer counts active time; when the app goes to background it pauses unless strict mode is on.
 */
export default function ExamRunner() {
  const { id } = useParams();
  const nav = useNavigate();
  const [s, setS] = useState<Session | null>(null);
  const [now, setNow] = useState(Date.now());
  const [gridOpen, setGridOpen] = useState(false);
  const qStart = useRef(Date.now());
  const sRef = useRef<Session | null>(null);
  sRef.current = s;

  useEffect(() => {
    getSession(id!).then((x) => {
      if (!x?.exam) return;
      if (x.endedAt) return nav(`/train/results/${x.id}`, { replace: true });
      // Non-strict: time while the app was closed doesn't count.
      if (!x.exam.strict) x.exam.resumedAt = Date.now();
      qStart.current = Date.now();
      setS({ ...x });
    });
  }, [id, nav]);

  const elapsed = (x: Session, t = Date.now()) => x.exam!.elapsedMs + (x.exam!.resumedAt ? t - x.exam!.resumedAt : 0);

  /** Folds running time into elapsedMs and per-question time, then persists. */
  const commit = useCallback(async (mut?: (x: Session) => void, pause = false) => {
    const x = sRef.current;
    if (!x?.exam) return;
    const t = Date.now();
    const ex = { ...x.exam, answers: { ...x.exam.answers }, pbqAnswers: { ...x.exam.pbqAnswers }, questionMs: { ...x.exam.questionMs }, flags: [...x.exam.flags] };
    ex.elapsedMs = elapsed(x, t);
    ex.resumedAt = pause ? undefined : t;
    const qid = ex.questionIds[ex.index];
    ex.questionMs[qid] = (ex.questionMs[qid] ?? 0) + (t - qStart.current);
    qStart.current = t;
    const next = { ...x, exam: ex };
    mut?.(next);
    sRef.current = next;
    setS(next);
    await putSession(next, false);
  }, []);

  const submit = useCallback(async () => {
    await commit(undefined, true);
    await finishExam(id!);
    nav(`/train/results/${id}`, { replace: true });
  }, [commit, id, nav]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const vis = () => {
      const x = sRef.current;
      if (!x?.exam) return;
      if (document.visibilityState === 'hidden') commit(undefined, !x.exam.strict);
      else if (!x.exam.strict) { x.exam.resumedAt = Date.now(); qStart.current = Date.now(); }
    };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', vis); };
  }, [commit]);

  const remaining = s?.exam ? s.exam.limitMs - elapsed(s, now) : 1;
  useEffect(() => { if (s?.exam && remaining <= 0) submit(); }, [remaining <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s?.exam) return null;
  const ex = s.exam;
  const qid = ex.questionIds[ex.index];
  const q = questionById.get(qid);
  const p = isPbqId(qid) ? pbqById.get(qid) : undefined;
  const answered = ex.questionIds.filter((id) => isAnswered(ex, id)).length;
  const flagged = ex.flags.includes(qid);
  const go = (i: number) => commit((x) => { x.exam!.index = Math.max(0, Math.min(ex.questionIds.length - 1, i)); }).then(() => window.scrollTo(0, 0));

  const confirmSubmit = () => {
    const missing = ex.questionIds.length - answered;
    if (confirm(missing ? `Te faltan ${missing} preguntas sin responder (cuentan como incorrectas). ¿Entregar?` : '¿Entregar el examen?')) submit();
  };

  return (
    <div className="stack">
      <header className="topbar">
        <button className="back" aria-label="Salir" onClick={() => commit(undefined, true).then(() => nav('/train'))}>‹</button>
        <div className="grow">
          <strong>{modeLabel(s.mode)}</strong>
          <div className="tiny muted">{answered}/{ex.questionIds.length} respondidas{ex.strict ? ' · estricto' : ''}</div>
        </div>
        <span className={`timer ${remaining < 5 * 60_000 ? 'low' : ''}`}>⏱ {fmtDuration(remaining)}</span>
      </header>

      <div className="row between">
        <button className="btn sm" onClick={() => setGridOpen(true)}>▦ {ex.index + 1} / {ex.questionIds.length}</button>
        <button className={`btn sm ${flagged ? 'primary' : ''}`} onClick={() => commit((x) => {
          const f = x.exam!.flags;
          x.exam!.flags = f.includes(qid) ? f.filter((z) => z !== qid) : [...f, qid];
        })}>⚑ {flagged ? 'Marcada' : 'Marcar'}</button>
      </div>

      {p ? (
        <PbqView p={p} layout={ex.order[qid]} answer={ex.pbqAnswers?.[qid] ?? emptyAnswer(p, ex.order[qid])}
          onChange={(a) => commit((x) => { x.exam!.pbqAnswers = { ...x.exam!.pbqAnswers, [qid]: a }; })} />
      ) : q ? (
        <QuestionView q={q} order={ex.order[qid]} selected={ex.answers[qid] ?? []} showObjective={false}
          onToggle={(i) => commit((x) => { x.exam!.answers[qid] = toggleSel(q, x.exam!.answers[qid] ?? [], i); })} />
      ) : <p>Pregunta no disponible.</p>}

      <div className="actionbar">
        <button className="btn" disabled={ex.index === 0} onClick={() => go(ex.index - 1)}>‹ Anterior</button>
        {ex.index + 1 < ex.questionIds.length
          ? <button className="btn primary" onClick={() => go(ex.index + 1)}>Siguiente ›</button>
          : <button className="btn good" onClick={confirmSubmit}>Entregar</button>}
      </div>

      <Sheet open={gridOpen} onClose={() => setGridOpen(false)}>
        <div className="stack">
          <div className="row between">
            <h2>Navegar</h2>
            <span className="small muted">{answered} respondidas · {ex.flags.length} marcadas</span>
          </div>
          <div className="grid-nums">
            {ex.questionIds.map((id, i) => (
              <button key={id}
                className={`${isAnswered(ex, id) ? 'answered' : ''} ${ex.flags.includes(id) ? 'flagged' : ''} ${i === ex.index ? 'current' : ''}`}
                onClick={() => { setGridOpen(false); go(i); }}>{i + 1}</button>
            ))}
          </div>
          <button className="btn good block" onClick={() => { setGridOpen(false); confirmSubmit(); }}>Entregar examen</button>
        </div>
      </Sheet>
    </div>
  );
}
