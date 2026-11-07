import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { useStudio } from '../../features/architecture/architecture.store';

export const fmt = (ms: number) => { const s = Math.floor(Math.abs(ms) / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

export default function InterviewClock({ onEnd }: { onEnd(): void }) {
  const iv = useStudio((s) => s.interview);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!iv || iv.endedAt) return null;
  const left = iv.startedAt + iv.durationMs - now;
  return (
    <span className={`clock${left < 0 ? ' over' : left < 300000 ? ' low' : ''}`} role="timer" aria-label="Interview time remaining">
      <Timer size={14} aria-hidden /> {left < 0 ? `+${fmt(left)} over` : fmt(left)}
      <button onClick={onEnd}>End session</button>
    </span>
  );
}
