import { formatValue } from '../../features/learning/lab';
import type { Format } from '../../features/learning/types';

interface Props { title: string; xs: number[]; ys: number[]; xNow: number; xLabel: string; yLabel: string; xFormat?: Format; yFormat?: Format; yNow: number; ref?: { label: string; value: number } | null }

/** A plain SVG line chart. The current slider position is marked, and the text below says the same thing for screen readers. */
export default function SweepChart({ title, xs, ys, xNow, xLabel, yLabel, xFormat = 'decimal1', yFormat = 'integer', yNow, ref }: Props) {
  const W = 480, H = 220, L = 58, R = 16, T = 14, B = 40;
  const finite = ys.filter(Number.isFinite); const top = Math.max(1, ...finite, ref?.value ?? 0) * 1.1;
  const x0 = xs[0], x1 = xs[xs.length - 1];
  const sx = (x: number) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R); const sy = (y: number) => T + (1 - Math.min(y, top) / top) * (H - T - B);
  let pen = false; // lift the pen over missing points so the path always starts with M
  const path = xs.map((x, i) => { if (!Number.isFinite(ys[i])) { pen = false; return ''; } const seg = `${pen ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(ys[i]).toFixed(1)}`; pen = true; return seg; }).join(' ');
  const summary = `${title}. At ${xLabel} ${formatValue(xNow, xFormat)}, ${yLabel} is ${formatValue(yNow, yFormat)}.${ref ? ` ${ref.label} is ${formatValue(ref.value, yFormat)}.` : ''}`;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        <line x1={L} y1={T} x2={L} y2={H - B} className="axis" /><line x1={L} y1={H - B} x2={W - R} y2={H - B} className="axis" />
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={sy(top * f / 1.1)} y2={sy(top * f / 1.1)} className="grid" /><text x={L - 6} y={sy(top * f / 1.1) + 4} textAnchor="end" className="tick">{formatValue((top / 1.1) * f, yFormat)}</text></g>)}
        <text x={L} y={H - B + 16} className="tick">{formatValue(x0, xFormat)}</text><text x={W - R} y={H - B + 16} textAnchor="end" className="tick">{formatValue(x1, xFormat)}</text>
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="tick">{xLabel}</text>
        {ref && Number.isFinite(ref.value) && <g><line x1={L} x2={W - R} y1={sy(ref.value)} y2={sy(ref.value)} className="ref" /><text x={W - R - 4} y={sy(ref.value) - 5} textAnchor="end" className="reflabel">{ref.label}</text></g>}
        <path d={path} className="line" fill="none" />
        {Number.isFinite(yNow) && <circle cx={sx(xNow)} cy={sy(yNow)} r={5} className="now" />}
      </svg>
      <figcaption>{title}</figcaption>
    </figure>
  );
}
