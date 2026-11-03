import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { domainOf, pbqById, questionById } from '../../content';
import { getSession, putSession, recordAttempt } from '../../db/repo';
import type { MissReason, Session } from '../../db/types';
import { Bar, TopBar } from '../../ui/components';
import { useData } from '../../ui/data';
import { QuestionStep, type StepResult } from '../../ui/question';
import { PbqStep, type PbqStepResult } from '../../ui/pbq';
import { summarize } from '../sessions';
import { modeLabel } from './Train';

type Pending = { kind: 'q'; r: StepResult & { missReason?: MissReason } } | { kind: 'pbq'; r: PbqStepResult };

/** Quiz / daily challenge / PBQ practice: one item at a time with immediate feedback. */
export default function QuizRunner() {
  const { id } = useParams();
  const nav = useNavigate();
  const d = useData();
  const [s, setS] = useState<Session | null>(null);
  const pending = useRef<Pending | null>(null);

  useEffect(() => { getSession(id!).then((x) => (x?.endedAt ? nav(`/train/results/${x.id}`, { replace: true }) : setS(x ?? null))); }, [id, nav]);
  if (!s?.exam) return null;
  const ex = s.exam;
  const qid = ex.questionIds[ex.index];
  const q = questionById.get(qid);
  const p = pbqById.get(qid);
  const item = q ?? p;

  const next = async () => {
    const pd = pending.current;
    const nextEx = { ...ex, answers: { ...ex.answers }, pbqAnswers: { ...ex.pbqAnswers }, questionMs: { ...ex.questionMs } };
    if (pd && item) {
      const base = { sessionId: s.id, questionId: item.id, objective: item.objective, domain: domainOf(item.objective), mode: s.mode, ms: pd.r.ms, at: Date.now() };
      if (pd.kind === 'q') {
        await recordAttempt({ ...base, selected: pd.r.selected, correct: pd.r.correct, confidence: pd.r.confidence, missReason: pd.r.missReason });
        nextEx.answers[item.id] = pd.r.selected;
      } else {
        await recordAttempt({ ...base, selected: [], correct: pd.r.correct, score: pd.r.score });
        nextEx.pbqAnswers[item.id] = pd.r.answer;
      }
      nextEx.questionMs[item.id] = pd.r.ms;
    }
    pending.current = null;
    const last = ex.index + 1 >= ex.questionIds.length;
    const nextS: Session = { ...s, exam: { ...nextEx, index: last ? ex.index : ex.index + 1 } };
    if (last) {
      nextS.endedAt = Date.now();
      nextS.result = summarize(nextS);
      await putSession(nextS);
      nav(`/train/results/${s.id}`, { replace: true });
    } else {
      await putSession(nextS);
      setS(nextS);
      window.scrollTo(0, 0);
    }
  };

  const isLast = ex.index + 1 >= ex.questionIds.length;
  return (
    <div className="stack">
      <TopBar title={modeLabel(s.mode)} back="/train" right={<span className="small muted num">{ex.index + 1}/{ex.questionIds.length}</span>} />
      <Bar value={ex.index / ex.questionIds.length} />
      {q && (
        <QuestionStep
          q={q}
          order={ex.order[q.id]}
          confidence={d.settings.confidence}
          missReason={d.settings.missReason}
          onAnswer={(r) => { pending.current = { kind: 'q', r }; }}
          onMissReason={(m) => { if (pending.current?.kind === 'q') pending.current.r.missReason = m; }}
          onNext={next}
          nextLabel={isLast ? 'Ver resultado' : 'Siguiente'}
        />
      )}
      {p && (
        <PbqStep key={p.id} p={p} layout={ex.order[p.id]} onAnswer={(r) => { pending.current = { kind: 'pbq', r }; }}
          onNext={next} nextLabel={isLast ? 'Ver resultado' : 'Siguiente'} />
      )}
      {!item && (
        <div className="stack"><p>Esta pregunta ya no existe en el banco.</p><button className="btn primary" onClick={next}>Saltar</button></div>
      )}
    </div>
  );
}
