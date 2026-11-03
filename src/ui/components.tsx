import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { domainById } from '../content';

export function TopBar({ title, back = true, right }: { title: ReactNode; back?: boolean | string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      {back && (
        <button className="back" aria-label="Volver" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>
          ‹
        </button>
      )}
      <h1 className="grow">{title}</h1>
      {right}
    </header>
  );
}

export function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function Ring({ value, label, size = 96 }: { value: number; label?: ReactNode; size?: number }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: 'stroke-dashoffset .5s' }} />
      </svg>
      <div className="val">
        <strong className="num" style={{ fontSize: size > 80 ? 22 : 15 }}>{Math.round(value * 100)}%</strong>
        {label && <span className="tiny muted">{label}</span>}
      </div>
    </div>
  );
}

export const domainColor = (d: number) => `var(--d${d})`;

export function DomainDot({ d }: { d: number }) {
  return <span className="domain-dot" style={{ background: domainColor(d) }} />;
}

export function DomainLabel({ d, short }: { d: number; short?: boolean }) {
  const dom = domainById.get(d);
  return (
    <span className="row" style={{ gap: 6 }}>
      <DomainDot d={d} />
      <span>{short ? `D${d}` : `D${d} · ${dom?.name}`}</span>
    </span>
  );
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card center muted" style={{ padding: 28 }}>{children}</div>;
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function fmtDate(t: number) {
  return new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}
