import { useState } from 'react';
import { rateCard } from '../../db/repo';
import type { QueueItem } from '../../engine/queue';
import { Rating, type Grade } from '../../engine/srs';
import { Bar } from '../../ui/components';
import { useData } from '../../ui/data';
import { FlashcardView } from '../../ui/flashcard';

const RELEARN_WINDOW = 15 * 60_000;

export interface CardTally { reviewed: number; again: number; good: number }

/** Steps through cards; ones that come due again within 15 min (learning steps) are re-queued. */
export function CardRunner({ items, onFinish, header }: { items: QueueItem[]; onFinish: (t: CardTally) => void; header?: React.ReactNode }) {
  const d = useData();
  const [queue, setQueue] = useState(items);
  const [i, setI] = useState(0);
  const [tally, setTally] = useState<CardTally>({ reviewed: 0, again: 0, good: 0 });
  const [busy, setBusy] = useState(false);
  const item = queue[i];
  if (!item) return null;
  const record = d.srs.find((r) => r.id === item.id);

  const onRate = async (g: Grade, ms: number) => {
    if (busy) return;
    setBusy(true);
    const rec = await rateCard(item, g, ms);
    const t = { reviewed: tally.reviewed + 1, again: tally.again + (g === Rating.Again ? 1 : 0), good: tally.good + (g >= Rating.Good ? 1 : 0) };
    setTally(t);
    let q = queue;
    if (rec.card.due - Date.now() < RELEARN_WINDOW) q = [...queue, { ...item, isNew: false }];
    setQueue(q);
    setBusy(false);
    if (i + 1 >= q.length) onFinish(t);
    else setI(i + 1);
  };

  return (
    <div className="stack">
      {header}
      <div className="row small muted">
        <span className="num">{i + 1} / {queue.length}</span>
        <div className="grow"><Bar value={i / queue.length} /></div>
      </div>
      <FlashcardView item={item} record={record} settings={d.settings} onRate={onRate} />
    </div>
  );
}
