import { domains, objectives, questions, flashcards, pbqs } from '../../content';
import { PBQ_TYPE_LABEL } from '../../engine/pbq';
import { DomainDot, fmtDate, pct, TopBar } from '../../ui/components';
import { useData } from '../../ui/data';
import { State } from '../../engine/srs';

const MISS_LABEL: Record<string, string> = { unknown: 'No lo sabía', misread: 'Leí mal', terms: 'Confundí términos', 'two-good': 'Dudé entre dos' };

export default function Stats() {
  const d = useData();
  const exams = d.sessions.filter((s) => s.mode === 'exam' && s.result && s.endedAt).sort((a, b) => a.endedAt! - b.endedAt!);
  const minis = d.sessions.filter((s) => (s.mode === 'mini' || s.mode === 'diagnostic') && s.result && s.endedAt).sort((a, b) => a.endedAt! - b.endedAt!);
  const neverSeen = objectives.filter((o) => {
    const st = d.stats.get(o.id);
    return !st || (st.attempts === 0 && st.cardsSeen === 0);
  });
  const conf = (['sure', 'unsure', 'guess'] as const).map((c) => {
    const a = d.attempts.filter((x) => x.confidence === c);
    return { c, n: a.length, acc: a.length ? a.filter((x) => x.correct).length / a.length : null };
  });
  const misses = d.attempts.filter((a) => a.missReason).reduce<Record<string, number>>((m, a) => ((m[a.missReason!] = (m[a.missReason!] ?? 0) + 1), m), {});
  const totalMs = d.attempts.reduce((s, a) => s + a.ms, 0);
  const pbqAttempts = d.attempts.filter((a) => a.questionId.startsWith('pbq-'));
  const pbqByType = (['order', 'match', 'categorize'] as const).map((t) => {
    const ids = new Set(pbqs.filter((p) => p.type === t).map((p) => p.id));
    const at = pbqAttempts.filter((a) => ids.has(a.questionId));
    return { t, n: at.length, avg: at.length ? at.reduce((s, a) => s + (a.score ?? (a.correct ? 1 : 0)), 0) / at.length : null };
  });
  const cardsMature = d.srs.filter((r) => r.kind !== 'mistake' && r.card.state === State.Review && r.card.scheduled_days >= 21).length;

  return (
    <div className="stack-lg">
      <TopBar title="Estadísticas" back="/more" />
      <section className="row wrap" style={{ gap: 8 }}>
        <Tile n={d.attempts.length} label="respuestas" />
        <Tile n={d.attempts.length ? pct(d.attempts.reduce((s, a) => s + (a.score ?? (a.correct ? 1 : 0)), 0) / d.attempts.length) : '—'} label="precisión total" />
        <Tile n={d.attempts.length ? `${Math.round(totalMs / d.attempts.length / 1000)} s` : '—'} label="tiempo medio" />
        <Tile n={`${d.bestStreak}`} label="mejor racha" />
        <Tile n={`${d.srs.filter((r) => r.kind === 'flashcard').length}/${flashcards.length}`} label="flashcards vistas" />
        <Tile n={cardsMature} label="tarjetas maduras (≥21 d)" />
      </section>

      <section className="card stack">
        <h2>Simulacros</h2>
        {exams.length ? <Trend points={exams.map((e) => ({ t: e.endedAt!, v: e.result!.pct }))} /> : <p className="small muted">Aún no hiciste ningún simulacro completo.</p>}
        {exams.map((e) => (
          <div key={e.id} className="row between small">
            <span>{fmtDate(e.endedAt!)}</span>
            <span className="num">{pct(e.result!.pct)} · ≈{e.result!.scaled}{e.result!.unseenTotal! < e.result!.total ? ` · inéditas ${e.result!.unseenTotal ? pct(e.result!.unseenCorrect! / e.result!.unseenTotal!) : '—'}` : ''}</span>
          </div>
        ))}
        {minis.length > 0 && (
          <>
            <h3 style={{ marginTop: 8 }}>Mini-exámenes y diagnósticos</h3>
            {minis.slice(-8).map((e) => (
              <div key={e.id} className="row between small"><span>{fmtDate(e.endedAt!)} · {e.mode === 'diagnostic' ? 'Diagnóstico' : `Mini ${e.result!.total}`}</span><span className="num">{pct(e.result!.pct)}</span></div>
            ))}
          </>
        )}
      </section>

      <section className="card stack">
        <h2>PBQs</h2>
        {pbqByType.map((x) => (
          <div key={x.t} className="row between small">
            <span>{PBQ_TYPE_LABEL[x.t]}</span>
            <span className="num muted">{x.n} intentos · {x.avg === null ? '—' : `${pct(x.avg)} crédito medio`}</span>
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2>Calibración de confianza</h2>
        <p className="small muted">Si "Seguro" no está cerca del 100%, estás confiando en respuestas que no dominas.</p>
        {conf.map((c) => (
          <div key={c.c} className="row between small">
            <span>{{ sure: 'Seguro', unsure: 'Dudo', guess: 'Adiviné' }[c.c]}</span>
            <span className="num muted">{c.n} resp. · {c.acc === null ? '—' : pct(c.acc)} aciertos</span>
          </div>
        ))}
        {Object.keys(misses).length > 0 && (
          <>
            <h3 style={{ marginTop: 8 }}>Por qué fallas</h3>
            {Object.entries(misses).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <div key={k} className="row between small"><span>{MISS_LABEL[k]}</span><span className="num muted">{n}</span></div>
            ))}
          </>
        )}
      </section>

      <section className="card stack">
        <h2>Por objetivo</h2>
        <table className="simple">
          <thead><tr><th>Obj.</th><th>Maestría</th><th>Precisión</th><th>Resp.</th><th>t̄</th></tr></thead>
          <tbody>
            {domains.flatMap((dom) => dom.objectives.map((o) => {
              const st = d.stats.get(o.id)!;
              const nq = questions.filter((q) => q.objective === o.id).length;
              return (
                <tr key={o.id}>
                  <td><span className="row" style={{ gap: 6 }}><DomainDot d={dom.id} /><strong>{o.id}</strong></span></td>
                  <td className="num">{pct(st.mastery)}</td>
                  <td className="num">{st.attempts ? pct(st.correct / st.attempts) : '—'}</td>
                  <td className="num muted">{st.attempts}/{nq}</td>
                  <td className="num muted">{st.avgMs ? `${Math.round(st.avgMs / 1000)}s` : '—'}</td>
                </tr>
              );
            }))}
          </tbody>
        </table>
        <p className="tiny muted">Maestría = mezcla de precisión reciente y retención de flashcards. Resp. = respuestas / preguntas del banco.</p>
      </section>

      <section className="card stack">
        <h2>Objetivos nunca vistos ({neverSeen.length})</h2>
        {neverSeen.length ? neverSeen.map((o) => <p key={o.id} className="small"><strong>{o.id}</strong> {o.title}</p>) : <p className="small muted">¡Ya tocaste todos los objetivos!</p>}
      </section>
    </div>
  );
}

function Tile({ n, label }: { n: React.ReactNode; label: string }) {
  return (
    <div className="card tight center" style={{ flex: '1 1 30%' }}>
      <strong className="num" style={{ fontSize: 20 }}>{n}</strong>
      <div className="tiny muted">{label}</div>
    </div>
  );
}

function Trend({ points }: { points: { t: number; v: number }[] }) {
  const W = 300, H = 120, P = 8;
  const x = (i: number) => P + (points.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (points.length - 1));
  const y = (v: number) => H - P - v * (H - 2 * P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Tendencia de simulacros">
      <line x1={P} x2={W - P} y1={y(0.85)} y2={y(0.85)} stroke="var(--good)" strokeDasharray="4 4" />
      <text x={W - P} y={y(0.85) - 4} fontSize="10" textAnchor="end" fill="var(--good)">85%</text>
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" points={points.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')} />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r="4" fill="var(--accent)" />)}
    </svg>
  );
}
