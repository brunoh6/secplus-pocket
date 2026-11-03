import { saveSettings, wipeAll } from '../../db/repo';
import type { Settings as S } from '../../db/types';
import { TopBar } from '../../ui/components';
import { useData } from '../../ui/data';

export default function Settings() {
  const { settings } = useData();
  const set = (p: Partial<S>) => saveSettings(p);
  return (
    <div className="stack-lg">
      <TopBar title="Ajustes" back="/more" />
      <section className="card stack">
        <h2>Repaso espaciado</h2>
        <div className="field">
          <label>Tarjetas nuevas por día (por mazo: flashcards y acrónimos)</label>
          <select value={settings.newPerDay} onChange={(e) => set({ newPerDay: Number(e.target.value) })}>
            {[5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Retención objetivo</label>
          <select value={settings.retention} onChange={(e) => set({ retention: Number(e.target.value) })}>
            {[0.85, 0.9, 0.93, 0.95].map((n) => <option key={n} value={n}>{Math.round(n * 100)}%{n === 0.9 ? ' (recomendado)' : ''}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Intervalo máximo</label>
          <select value={settings.maxIntervalDays} onChange={(e) => set({ maxIntervalDays: Number(e.target.value) })}>
            {[30, 45, 60, 90, 180].map((n) => <option key={n} value={n}>{n} días</option>)}
          </select>
          <span className="tiny muted">Tope para que ninguna tarjeta desaparezca demasiado tiempo antes del examen.</span>
        </div>
      </section>
      <section className="card stack">
        <h2>Preguntas</h2>
        <label className="toggle"><span>Pedir nivel de confianza (Seguro / Dudo / Adiviné)</span>
          <input type="checkbox" checked={settings.confidence} onChange={(e) => set({ confidence: e.target.checked })} /></label>
        <label className="toggle"><span>Preguntar "¿por qué fallaste?"</span>
          <input type="checkbox" checked={settings.missReason} onChange={(e) => set({ missReason: e.target.checked })} /></label>
        <label className="toggle"><span>Temporizador estricto en exámenes<br /><span className="tiny muted">El reloj sigue corriendo si sales de la app</span></span>
          <input type="checkbox" checked={settings.strictTimer} onChange={(e) => set({ strictTimer: e.target.checked })} /></label>
      </section>
      <section className="card stack">
        <h2>Examen</h2>
        <div className="field">
          <label>Fecha de tu examen</label>
          <input type="date" value={settings.examDate ?? ''} onChange={(e) => set({ examDate: e.target.value || undefined })} />
        </div>
      </section>
      <section className="card stack">
        <h2>Zona peligrosa</h2>
        <button className="btn bad block" onClick={() => confirm('¿Borrar TODO tu progreso de este dispositivo? Exporta un respaldo antes.') && confirm('Seguro, ¿de verdad?') && wipeAll()}>
          Borrar todo el progreso
        </button>
      </section>
    </div>
  );
}
