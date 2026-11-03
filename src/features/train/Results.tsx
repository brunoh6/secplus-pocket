import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { domainById, pbqById, questionById } from '../../content';
import { getAttemptsForSession, getSession } from '../../db/repo';
import type { Attempt, Session } from '../../db/types';
import { PASSING_SCALED } from '../../engine/scoring';
import { Bar, domainColor, DomainDot, fmtDuration, pct, Seg, TopBar } from '../../ui/components';
import { useData } from '../../ui/data';
import { QuestionView } from '../../ui/question';
import { PbqView } from '../../ui/pbq';
import { emptyAnswer, isPbqId } from '../../engine/pbq';
import { createSession, EXAM_MODES, fmtScore, itemById, itemScore } from '../sessions';
import { modeLabel } from './Train';

export default function Results() {
  const { id } = useParams();
  const nav = useNavigate();
  const d = useData();
  const [s, setS] = useState<Session | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [filter, setFilter] = useState<'wrong' | 'all' | 'flagged'>('wrong');
  const [openQ, setOpenQ] = useState<string | null>(null);
  useEffect(() => {
    getSession(id!).then((x) => setS(x ?? null));
    getAttemptsForSession(id!).then(setAttempts);
  }, [id]);
  if (!s?.result || !s.exam) return null;
  const r = s.result, ex = s.exam;
  const isExam = EXAM_MODES.includes(s.mode);
  const att = new Map(attempts.map((a) => [a.questionId, a]));
  const list = ex.questionIds.filter((qid) => {
    if (!itemById(qid)) return false;
    if (filter === 'wrong') return itemScore(ex, qid) < 1;
    if (filter === 'flagged') return ex.flags.includes(qid);
    return true;
  });
  const passed = (r.scaled ?? 0) >= PASSING_SCALED;
  const guesses = attempts.filter((a) => a.correct && a.confidence === 'guess').length;

  const retryWrong = async () => {
    const qs = ex.questionIds.filter((qid) => itemScore(ex, qid) < 1).map(itemById).filter((x) => !!x);
    if (!qs.length) return;
    const nid = await createSession({ mode: 'quiz', questions: qs, label: 'Repetir falladas', seen: d.seenQuestions });
    nav(`/train/quiz/${nid}`);
  };

  return (
    <div className="stack-lg">
      <TopBar title={`Resultado · ${modeLabel(s.mode)}`} back="/train" />
      <section className="card stack center">
        <div style={{ fontSize: 48, fontWeight: 800 }} className="num">{pct(r.pct)}</div>
        <p className="muted">{fmtScore(r.correct)} de {r.total} correctas{r.avgMs ? ` · ${Math.round(r.avgMs / 1000)} s por pregunta` : ''}</p>
        {isExam && r.scaled !== undefined && (
          <div className="stack" style={{ gap: 4 }}>
            <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
              <strong style={{ fontSize: 24 }} className="num">≈ {r.scaled}</strong><span className="muted">/ 900</span>
              <span className={`chip ${passed ? 'good' : 'bad'}`}>{passed ? 'Aprobaría' : 'Por debajo de 750'}</span>
            </div>
            <p className="tiny muted">
              Estimación aproximada. CompTIA no publica cómo convierte aciertos a la escala 100–900 y las PBQs pesan distinto;
              úsala como tendencia, no como predicción.
            </p>
          </div>
        )}
        {r.unseenTotal !== undefined && r.unseenTotal < r.total && (
          <p className="small callout warn" style={{ textAlign: 'left' }}>
            {r.total - r.unseenTotal} de {r.total} preguntas ya las habías visto.
            {r.unseenTotal > 0 && <> Solo en inéditas: <strong>{pct(r.unseenCorrect! / r.unseenTotal)}</strong> ({fmtScore(r.unseenCorrect!)}/{r.unseenTotal}).</>}
          </p>
        )}
        {guesses > 0 && <p className="small muted">🎲 {guesses} acierto(s) marcados como "adiviné" → enviados a Mis errores.</p>}
      </section>

      <section className="card stack">
        <h2>Por dominio</h2>
        {Object.entries(r.byDomain).sort(([a], [b]) => Number(a) - Number(b)).map(([dom, v]) => (
          <div key={dom} className="stack" style={{ gap: 4 }}>
            <div className="row between small">
              <span className="row grow" style={{ gap: 6 }}><DomainDot d={Number(dom)} /><span className="ellipsis">D{dom} {domainById.get(Number(dom))?.name}</span></span>
              <span className="num muted nowrap">{fmtScore(v.correct)}/{v.total} · {pct(v.correct / v.total)}</span>
            </div>
            <Bar value={v.correct / v.total} color={domainColor(Number(dom))} />
          </div>
        ))}
      </section>

      <div className="row" style={{ gap: 8 }}>
        <button className="btn grow" onClick={retryWrong} disabled={r.correct >= r.total}>Repetir falladas</button>
        <Link className="btn primary grow" to="/review/mistakes">Repasar errores</Link>
      </div>

      <section className="stack">
        <h2>Revisión</h2>
        <Seg value={filter} onChange={setFilter} options={[
          { value: 'wrong', label: `Falladas (${ex.questionIds.filter((q) => itemById(q) && itemScore(ex, q) < 1).length})` },
          { value: 'all', label: 'Todas' },
          ...(isExam ? [{ value: 'flagged' as const, label: `Marcadas (${ex.flags.length})` }] : []),
        ]} />
        {list.map((qid) => {
          const p = isPbqId(qid) ? pbqById.get(qid) : undefined;
          const q = p ? undefined : questionById.get(qid);
          const stem = p ? `PBQ · ${p.title}` : q!.stem;
          const objective = (p ?? q)!.objective;
          const sel = ex.answers[qid] ?? [];
          const sc = itemScore(ex, qid);
          const ok = sc === 1;
          const a = att.get(qid);
          const n = ex.questionIds.indexOf(qid) + 1;
          return (
            <div key={qid} className="card tight stack">
              <button className="row" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', width: '100%' }} onClick={() => setOpenQ(openQ === qid ? null : qid)}>
                <span className={`chip ${ok ? 'good' : sc > 0 ? 'warn' : 'bad'}`}>{ok ? '✓' : sc > 0 ? '½' : '✕'} {n}</span>
                <span className="grow small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stem}</span>
                <span className="tiny muted">{objective}</span>
              </button>
              {openQ === qid && (
                <>
                  {!p && !sel.length && <span className="chip warn">Sin responder</span>}
                  {a?.ms ? <span className="tiny muted">Tiempo: {fmtDuration(a.ms)}</span> : null}
                  {p
                    ? <PbqView p={p} layout={ex.order[qid]} answer={ex.pbqAnswers?.[qid] ?? emptyAnswer(p, ex.order[qid])} reveal />
                    : <QuestionView q={q!} order={ex.order[qid]} selected={sel} reveal />}
                </>
              )}
            </div>
          );
        })}
        {!list.length && <p className="muted center small">Nada que mostrar aquí.</p>}
      </section>
    </div>
  );
}
