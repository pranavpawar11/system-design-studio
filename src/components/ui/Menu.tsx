import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface MenuItem { label: string; icon?: ReactNode; hint?: string; danger?: boolean; disabled?: boolean; separatorBefore?: boolean; onSelect(): void }

/** Disclosure menu: arrow keys move, Escape closes and returns focus, outside click closes. */
export default function Menu({ label, icon, items }: { label: string; icon?: ReactNode; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null); const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', down);
    root.current?.querySelector<HTMLElement>('[role=menuitem]:not([disabled])')?.focus();
    return () => document.removeEventListener('mousedown', down);
  }, [open]);
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const els = [...root.current!.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])')]; const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };
  return (
    <div className="menu" ref={root}>
      <button ref={btn} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {icon}<span className="btn-label">{label}</span><ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div className="menu-list" role="menu" aria-label={label} onKeyDown={key}>
          {items.map((it) => (
            <div key={it.label} role="none">
              {it.separatorBefore && <hr className="menu-sep" />}
              <button role="menuitem" className={it.danger ? 'danger-item' : ''} disabled={it.disabled} onClick={() => { setOpen(false); it.onSelect(); }}>
                {it.icon}<span>{it.label}</span>{it.hint && <kbd>{it.hint}</kbd>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
