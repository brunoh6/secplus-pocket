import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { acronyms, domains, flashcards, objectiveById } from '../../content';
import { buildQueue, deckCounts, type Deck } from '../../engine/queue';
import { DomainDot, Empty, TopBar } from '../../ui/components';
import { useData } from '../../ui/data';
import { CardRunner, type CardTally } from './CardRunner';

export function deckTitle(deck: Deck) {
  if (deck === 'all') return 'Todo';
  if (deck === 'mistakes') return 'Mis errores';
  if (deck === 'acronyms') return 'Acrónimos';
  if (deck.startsWith('obj:')) return `Objetivo ${deck.slice(4)}`;
  return `Dominio ${deck.slice(1)}`;
}

export function ReviewHome() {
  const d = useData();
  const [open, setOpen] = useState<number | null>(null);
  const c = (deck: Deck) => deckCounts(deck, d.srs, flashcards, acronyms, d.settings);
  const Row = ({ deck, title, sub, icon }: { deck: Deck; title: React.ReactNode; sub?: string; icon?: React.ReactNode }) => {
    const n = c(deck);
    return (
      <Link to={`/review/${encodeURIComponent(deck)}`} className="list-item">
        {icon}
        <div className="grow">
          <div>{title}</div>
          {sub && <div className="tiny muted">{sub}</div>}
        </div>
        {n.due > 0 && <span className="chip bad num">{n.due}</span>}
        {n.newAvailable > 0 && <span className="chip accent num">+{n.newAvailable}</span>}
        <span className="muted">›</span>
      </Link>
    );
  };
  return (
    <div className="stack-lg">
      <TopBar title="Repasar" back={false} />
      <p className="small muted">Repetición espaciada (FSRS). <span className="chip bad">n</span> pendientes · <span className="chip accent">+n</span> nuevas disponibles hoy (límite {d.settings.newPerDay}/día).</p>
      <section className="card list">
        <Row deck="all" title={<strong>Todo</strong>} sub="Flashcards de todos los dominios + mis errores" icon={<span>📚</span>} />
        <Row deck="mistakes" title={<strong>Mis errores</strong>} sub={`Preguntas falladas o adivinadas · ${c('mistakes').total} en el mazo`} icon={<span>🩹</span>} />
        <Row deck="acronyms" title={<strong>Acrónimos</strong>} sub={`${acronyms.length} de la lista oficial`} icon={<span>🔤</span>} />
      </section>
      <section className="card list">
        {domains.map((dom) => (
          <div key={dom.id}>
            <div className="row">
              <div className="grow"><Row deck={`d${dom.id}` as Deck} title={`D${dom.id} · ${dom.name}`} icon={<DomainDot d={dom.id} />} /></div>
              <button className="btn sm ghost" aria-label="Ver objetivos" onClick={() => setOpen(open === dom.id ? null : dom.id)}>{open === dom.id ? '▴' : '▾'}</button>
            </div>
            {open === dom.id && (
              <div style={{ paddingLeft: 22 }} className="list">
                {dom.objectives.map((o) => (
                  <Row key={o.id} deck={`obj:${o.id}`} title={<span className="small"><strong>{o.id}</strong> {o.title}</span>} />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

export function ReviewSession() {
  const deck = decodeURIComponent(useParams().deck ?? 'all') as Deck;
  const d = useData();
  const nav = useNavigate();
  const [done, setDone] = useState<CardTally | null>(null);
  // Snapshot the queue once, when data first becomes available.
  const items = useMemo(() => {
    if (!d.ready) return null;
    const q = buildQueue({ deck, srs: d.srs, flashcards, acronyms, settings: d.settings, mastery: d.mastery });
    return [...q.due, ...q.fresh];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.ready, deck]);

  const title = deckTitle(deck);
  const sub = deck.startsWith('obj:') ? objectiveById.get(deck.slice(4))?.title : undefined;
  if (!items) return null;
  if (done) {
    return (
      <div className="stack-lg">
        <TopBar title={title} back="/review" />
        <div className="card center stack">
          <div style={{ fontSize: 44 }}>🎉</div>
          <h2>Sesión terminada</h2>
          <p className="muted">{done.reviewed} repasos · {done.good} bien · {done.again} otra vez</p>
        </div>
        <button className="btn primary block" onClick={() => nav('/review')}>Volver a los mazos</button>
      </div>
    );
  }
  return (
    <div className="stack">
      <TopBar title={title} back="/review" />
      {sub && <p className="small muted">{sub}</p>}
      {items.length === 0 ? (
        <Empty>
          <div style={{ fontSize: 36 }}>✨</div>
          <p>Nada pendiente en este mazo por ahora.</p>
          <p className="small">{deck === 'mistakes' ? 'Las preguntas que falles en quizzes aparecerán aquí.' : 'Vuelve más tarde o sube el límite de nuevas en Ajustes.'}</p>
        </Empty>
      ) : (
        <CardRunner items={items} onFinish={setDone} />
      )}
    </div>
  );
}
