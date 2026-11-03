import { Link } from 'react-router-dom';
import { acronyms, domains, flashcards, questions } from '../content';
import { buildQueue } from '../engine/queue';
import { readiness } from '../engine/scoring';
import { dayKey } from '../engine/dates';
import { Bar, DomainDot, pct, Ring, domainColor } from '../ui/components';
import { useData } from '../ui/data';

const DAY = 86_400_000;

export default function Home() {
  const d = useData();
  const now = Date.now();
  const q = buildQueue({ deck: 'all', srs: d.srs, flashcards, acronyms, settings: d.settings, mastery: d.mastery, now });
  const acr = buildQueue({ deck: 'acronyms', srs: d.srs, flashcards, acronyms, settings: d.settings, now });
  const mistakesDue = q.due.filter((x) => x.kind === 'mistake').length;
  const exams = d.sessions.filter((s) => s.mode === 'exam' && s.endedAt);
  const ready = readiness(exams);
  const today = dayKey();
  const dailyDone = d.sessions.some((s) => s.mode === 'daily' && s.dayKey === today && s.endedAt);
  const exportOverdue = d.attempts.length + d.srs.length > 0 && (!d.settings.lastExportAt || now - d.settings.lastExportAt > 7 * DAY);
  const daysToExam = d.settings.examDate ? Math.ceil((new Date(d.settings.examDate + 'T09:00').getTime() - now) / DAY) : null;
  const doneToday = d.activeDays.includes(today);

  return (
    <div className="stack-lg">
      <header className="row between">
        <div>
          <p className="small muted">Security+ SY0-701</p>
          <h1>Hola 👋</h1>
        </div>
        <div className="card tight center" style={{ minWidth: 86 }}>
          <div style={{ fontSize: 22 }}>{doneToday ? '🔥' : '🕯️'}</div>
          <strong className="num">{d.streak}</strong> <span className="tiny muted">{d.streak === 1 ? 'día' : 'días'}</span>
        </div>
      </header>

      <Link to="/quick" className="btn hero primary" style={{ flexDirection: 'column', gap: 2 }}>
        ⚡ Sesión rápida 5 min
        <span className="small" style={{ fontWeight: 500, opacity: 0.85 }}>
          {q.due.length} repasos · {Math.min(5, q.fresh.length)} nuevas · 3 preguntas
        </span>
      </Link>

      <section className="card stack">
        <div className="row between">
          <h2>Cola de hoy</h2>
          <Link to="/review" className="small">Ver mazos ›</Link>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Stat n={q.due.length} label="repasos" />
          <Stat n={q.fresh.length} label="nuevas" />
          <Stat n={mistakesDue} label="mis errores" tone={mistakesDue ? 'bad' : undefined} />
          <Stat n={acr.due.length + acr.fresh.length} label="acrónimos" />
        </div>
      </section>

      <Link to="/train/daily" className="card link row">
        <span style={{ fontSize: 28 }}>{dailyDone ? '✅' : '🎯'}</span>
        <div className="grow">
          <h3>Reto diario</h3>
          <p className="small muted">{dailyDone ? 'Completado hoy. ¡Vuelve mañana!' : '10 preguntas ponderadas por el examen. Cuenta para la racha.'}</p>
        </div>
        <span className="muted">›</span>
      </Link>

      <section className="card stack">
        <div className="row" style={{ gap: 16 }}>
          <Ring value={d.domainProgress.overall} label="dominio" />
          <div className="grow stack" style={{ gap: 4 }}>
            <h2>Progreso ponderado</h2>
            <p className="small muted">Cada dominio pesa lo que pesa en el examen. Combina precisión reciente en preguntas y retención de flashcards.</p>
          </div>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {domains.map((dom, i) => {
            const m = d.domainProgress.perDomain[i].mastery;
            return (
              <Link key={dom.id} to={`/train?domain=${dom.id}`} className="stack" style={{ gap: 4, color: 'inherit', textDecoration: 'none' }}>
                <div className="row between small">
                  <span className="row grow" style={{ gap: 6 }}><DomainDot d={dom.id} /><span className="ellipsis">D{dom.id} {dom.name}</span></span>
                  <span className="muted num nowrap">{pct(m)} · {Math.round(dom.weight * 100)}%</span>
                </div>
                <Bar value={m} color={domainColor(dom.id)} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="card stack">
        <div className="row between">
          <h2>¿Listo para el examen?</h2>
          {ready.ready ? <span className="chip good">Listo</span> : <span className="chip">Aún no</span>}
        </div>
        <p className="small muted">Tu criterio: ≥85% en dos simulacros completos seguidos.</p>
        <div className="row" style={{ gap: 8 }}>
          {[0, 1].map((i) => {
            const v = ready.lastTwo[i];
            return (
              <div key={i} className="card tight grow center" style={{ background: 'var(--surface-2)', border: 0 }}>
                <div className="tiny muted">{i === 0 ? 'Penúltimo' : 'Último'}</div>
                <strong className="num" style={{ color: v === undefined ? undefined : v >= 0.85 ? 'var(--good)' : 'var(--bad)' }}>
                  {v === undefined ? '—' : pct(v)}
                </strong>
              </div>
            );
          })}
        </div>
        {daysToExam !== null && daysToExam >= 0 && <p className="small">📅 Faltan <strong>{daysToExam}</strong> días para tu examen.</p>}
        <p className="tiny muted">Banco actual: {questions.length} preguntas · {flashcards.length} flashcards · {acronyms.length} acrónimos.</p>
      </section>

      {exportOverdue && (
        <Link to="/more/backup" className="callout warn" style={{ color: 'inherit', textDecoration: 'none' }}>
          💾 Hace más de 7 días que no exportas tu progreso. Safari puede borrar datos: <strong>exportar ahora ›</strong>
        </Link>
      )}
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: 'bad' }) {
  return (
    <div className="grow center card tight" style={{ background: 'var(--surface-2)', border: 0, padding: '10px 4px' }}>
      <strong className="num" style={{ fontSize: 22, color: tone ? 'var(--bad)' : undefined }}>{n}</strong>
      <div className="tiny muted">{label}</div>
    </div>
  );
}
