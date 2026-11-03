import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession } from '../../db/repo';
import { dayKey } from '../../engine/dates';
import { useData } from '../../ui/data';
import { createSession } from '../sessions';
import { dailyQuestions } from './pools';

export default function Daily() {
  const nav = useNavigate();
  const d = useData();
  useEffect(() => {
    if (!d.ready) return;
    (async () => {
      const day = dayKey();
      const id = `daily-${day}`;
      const existing = await getSession(id);
      if (existing) return nav(existing.endedAt ? `/train/results/${id}` : `/train/quiz/${id}`, { replace: true });
      await createSession({ id, mode: 'daily', dayKey: day, questions: dailyQuestions(day), label: day, seen: d.seenQuestions });
      nav(`/train/quiz/${id}`, { replace: true });
    })();
  }, [d.ready, d.seenQuestions, nav]);
  return null;
}
