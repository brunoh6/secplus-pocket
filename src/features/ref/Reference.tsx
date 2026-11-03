import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { acronyms, referenceSheets, type ReferenceSheet } from '../../content';
import { Empty, TopBar } from '../../ui/components';

const ACR_SHEET: ReferenceSheet = {
  id: 'acronyms',
  title: 'Acrónimos',
  description: 'Lista oficial SY0-701',
  objectives: [],
  columns: ['Acronym', 'Expansion', 'Note', 'Objectives'],
  rows: acronyms.map((a) => [a.acronym, a.expansion, a.note ?? '', a.objectives.join(', ')]),
};
const ALL = [...referenceSheets, ACR_SHEET];
const ICON: Record<string, string> = { ports: '🔌', crypto: '🔐', controls: '🛡️', resilience: '⏱️', backups: '💾', cloud: '☁️', ir: '🚨', acronyms: '🔤' };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const matches = (row: string[], q: string) => !q || row.some((c) => norm(c).includes(q));

function Rows({ sheet, q }: { sheet: ReferenceSheet; q: string }) {
  const rows = sheet.rows.filter((r) => matches(r, q));
  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} className="card tight stack" style={{ gap: 4 }}>
          <strong className={sheet.id === 'acronyms' || sheet.id === 'ports' ? 'mono' : undefined}>{r[0]}</strong>
          <dl className="kv">
            {r.slice(1).map((c, j) => c && (
              <div key={j} style={{ display: 'contents' }}>
                <dt>{sheet.columns[j + 1]}</dt>
                <dd>{c}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {!rows.length && <p className="small muted">Sin coincidencias.</p>}
    </div>
  );
}

export function RefHome() {
  const [q, setQ] = useState('');
  const nq = norm(q.trim());
  const hits = useMemo(() => (nq ? ALL.map((s) => ({ s, n: s.rows.filter((r) => matches(r, nq)).length })).filter((x) => x.n) : []), [nq]);
  return (
    <div className="stack-lg">
      <TopBar title="Fichas" back={false} />
      <input className="search" type="search" placeholder="Buscar en todas las fichas (p. ej. 443, OCSP, RPO)" value={q} onChange={(e) => setQ(e.target.value)} />
      {nq ? (
        hits.length ? hits.map(({ s }) => (
          <section key={s.id} className="stack">
            <Link to={`/ref/${s.id}?q=${encodeURIComponent(q)}`} className="row between" style={{ color: 'inherit', textDecoration: 'none' }}>
              <h3>{ICON[s.id] ?? '📄'} {s.title}</h3><span className="small">ver ficha ›</span>
            </Link>
            <Rows sheet={{ ...s, rows: s.rows.filter((r) => matches(r, nq)).slice(0, 8) }} q="" />
          </section>
        )) : <Empty>Sin resultados para “{q}”.</Empty>
      ) : (
        <section className="card list">
          {ALL.map((s) => (
            <Link key={s.id} to={`/ref/${s.id}`} className="list-item">
              <span style={{ fontSize: 22 }}>{ICON[s.id] ?? '📄'}</span>
              <div className="grow">
                <div>{s.title}</div>
                <div className="tiny muted">{s.rows.length} filas{s.objectives.length ? ` · ${s.objectives.join(', ')}` : ''}</div>
              </div>
              <span className="muted">›</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

export function RefSheet() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const sheet = ALL.find((s) => s.id === id);
  if (!sheet) return <Empty>Ficha no encontrada.</Empty>;
  return (
    <div className="stack">
      <TopBar title={sheet.title} back="/ref" />
      {sheet.description && <p className="small muted">{sheet.description}</p>}
      <input className="search" type="search" placeholder="Filtrar…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Rows sheet={sheet} q={norm(q.trim())} />
    </div>
  );
}
