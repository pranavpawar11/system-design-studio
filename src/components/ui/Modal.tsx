import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Accessible dialog: labelled, traps Tab, closes on Escape or backdrop click, returns focus to what opened it. */
export default function Modal({ label, onClose, wide, dismissible = true, children }: { label: string; onClose(): void; wide?: boolean; dismissible?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null; const el = ref.current!;
    (el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus();
    return () => opener?.focus?.();
  }, []);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el || !el.contains(e.target as Node)) return; // ignore events bubbling from a dialog stacked on top
    if (e.key === 'Escape' && dismissible) { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0]; const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return createPortal(
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) onClose(); }}>
      <div ref={ref} className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={onKeyDown}>{children}</div>
    </div>, document.body);
}
