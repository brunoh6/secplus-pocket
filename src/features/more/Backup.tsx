import { useRef, useState } from 'react';
import { exportBackup, importBackup, parseBackup, type Backup as BackupData } from '../../db/backup';
import { saveSettings } from '../../db/repo';
import { fmtDate, TopBar } from '../../ui/components';
import { useData } from '../../ui/data';
import { dayKey } from '../../engine/dates';

export default function Backup() {
  const d = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [pending, setPending] = useState<BackupData | null>(null);

  const doExport = async () => {
    const b = await exportBackup();
    const name = `secplus-pocket-${dayKey()}.json`;
    const blob = new Blob([JSON.stringify(b)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    try {
      // iOS standalone: the share sheet is the reliable way to save to Files / AirDrop.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Respaldo Security+ Pocket' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: name });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
      await saveSettings({ lastExportAt: Date.now() });
      setMsg({ tone: 'good', text: `Respaldo generado: ${name}` });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg({ tone: 'bad', text: `No se pudo exportar: ${(e as Error).message}` });
    }
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      setPending(parseBackup(await f.text()));
      setMsg(null);
    } catch (e) {
      setMsg({ tone: 'bad', text: (e as Error).message });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const apply = async (mode: 'replace' | 'merge') => {
    if (!pending) return;
    if (mode === 'replace' && !confirm('Esto reemplaza TODO tu progreso local por el del archivo. ¿Continuar?')) return;
    await importBackup(pending, mode);
    setMsg({ tone: 'good', text: mode === 'replace' ? 'Progreso restaurado.' : 'Progreso fusionado.' });
    setPending(null);
  };

  return (
    <div className="stack-lg">
      <TopBar title="Respaldo" back="/more" />
      <p className="small muted">
        Tu progreso vive en este iPhone (IndexedDB). Safari puede borrar datos de webs en algunos casos, así que exporta un respaldo
        de vez en cuando y guárdalo en Archivos o iCloud Drive.
      </p>
      <section className="card stack">
        <h2>Exportar</h2>
        <p className="small muted">
          {d.srs.length} tarjetas · {d.attempts.length} respuestas · {d.sessions.length} sesiones.
          {d.settings.lastExportAt ? ` Último respaldo: ${fmtDate(d.settings.lastExportAt)}.` : ' Nunca exportado.'}
        </p>
        <button className="btn primary block" onClick={doExport}>Exportar progreso (JSON)</button>
      </section>
      <section className="card stack">
        <h2>Importar</h2>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <button className="btn block" onClick={() => fileRef.current?.click()}>Elegir archivo…</button>
        {pending && (
          <div className="stack">
            <p className="small">
              Respaldo del {fmtDate(pending.exportedAt)}: {pending.data.srs.length} tarjetas, {pending.data.attempts.length} respuestas, {pending.data.sessions.length} sesiones.
            </p>
            <button className="btn primary block" onClick={() => apply('merge')}>Fusionar con lo actual</button>
            <button className="btn bad block" onClick={() => apply('replace')}>Reemplazar todo</button>
          </div>
        )}
      </section>
      {msg && <div className={`callout ${msg.tone}`}>{msg.text}</div>}
    </div>
  );
}
