import type { KeyboardEvent, PointerEvent } from 'react';
import { useStudio } from '../../features/architecture/architecture.store';

export default function ResizeHandle({ side }: { side: 'left' | 'right' }) {
  const width = useStudio((s) => (side === 'left' ? s.leftWidth : s.rightWidth));
  const setWidth = useStudio((s) => s.setWidth);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX; const start = width;
    document.body.classList.add('resizing');
    const move = (ev: globalThis.PointerEvent) => setWidth(side, start + (side === 'left' ? ev.clientX - startX : startX - ev.clientX));
    const up = () => { document.body.classList.remove('resizing'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir) { e.preventDefault(); setWidth(side, width + dir * 16 * (side === 'left' ? 1 : -1)); }
  };
  return <div className="resizer" role="separator" aria-orientation="vertical" aria-label={`Resize ${side} panel`} aria-valuenow={width} tabIndex={0} onPointerDown={down} onKeyDown={key} />;
}
