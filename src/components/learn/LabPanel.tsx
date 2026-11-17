import { useEffect, useId, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { compileLab, defaultsOf, formatValue, runLab, sweep, type CompiledLab, type LabSpecError } from '../../features/learning/lab';
import type { LabSpec, Tone } from '../../features/learning/types';
import SweepChart from './SweepChart';

const TONE: Record<Tone, string> = { ok: 'Healthy', warn: 'Careful', bad: 'Problem', info: 'Note' };

function Running({ lab, completed, onComplete }: { lab: CompiledLab; completed: boolean; onComplete(): void }) {
  const uid = useId(); const spec = lab.spec;
  const [inputs, setInputs] = useState(() => defaultsOf(spec));
  const [latched, setLatched] = useState<Set<string>>(() => new Set(completed ? spec.tasks.map((t) => t.id) : []));
  const result = useMemo(() => runLab(lab, inputs), [lab, inputs]);
  const chart = useMemo(() => sweep(lab, inputs), [lab, inputs]);

  // A task stays ticked once you have achieved it, even if you then move on to the next one.
  useEffect(() => {
    const fresh = spec.tasks.filter((t) => result.tasksMet[t.id] && !latched.has(t.id)).map((t) => t.id);
    if (fresh.length) setLatched(new Set([...latched, ...fresh]));
  }, [result, spec.tasks, latched]);
  useEffect(() => { if (!completed && latched.size === spec.tasks.length) onComplete(); }, [latched, completed, spec.tasks.length, onComplete]);

  const set = (id: string, v: number) => setInputs((s) => ({ ...s, [id]: v }));
  const sw = spec.sweep; const swInput = sw && spec.inputs.find((i) => i.id === sw.input); const swOut = sw && spec.derived.find((d) => d.id === sw.output);
  return (
    <section className="lab" aria-labelledby={`${uid}-t`}>
      <div className="lab-head"><h3 id={`${uid}-t`}>Lab: {spec.title}</h3>{completed && <span className="badge pass">✓ Completed</span>}</div>
      <p>{spec.intro}</p>
      <div className="lab-grid">
        <div className="lab-controls" role="group" aria-label="Controls">
          {spec.inputs.map((i) => {
            const id = `${uid}-${i.id}`; const v = inputs[i.id];
            return i.type === 'toggle' ? (
              <label key={i.id} className="switch lab-switch"><input type="checkbox" role="switch" checked={v === 1} onChange={(e) => set(i.id, e.target.checked ? 1 : 0)} /><i aria-hidden /><span>{i.label}</span></label>
            ) : (
              <div key={i.id} className="lab-field">
                <label htmlFor={id}>{i.label}</label>
                <input id={id} type="range" min={i.min} max={i.max} step={i.step} value={v} aria-valuetext={formatValue(v, i.format, i.unit)} onChange={(e) => set(i.id, Number(e.target.value))} />
                <output htmlFor={id}>{formatValue(v, i.format, i.unit)}</output>
                {i.help && <small>{i.help}</small>}
              </div>
            );
          })}
          <div className="lab-actions">
            {spec.scenarios?.map((s) => <button key={s.label} onClick={() => setInputs((p) => ({ ...p, ...s.set }))}>{s.label}</button>)}
            <button className="ghost" onClick={() => setInputs(defaultsOf(spec))}><RotateCcw size={14} aria-hidden /> Reset sliders</button>
          </div>
        </div>
        <div className="lab-out">
          <div className="lab-stats">{result.outputs.map((o) => <div key={o.id}><b>{o.text}</b><span>{o.label}</span></div>)}</div>
          <div className="lab-live" aria-live="polite" aria-atomic="true">
            {result.headline && <p className={`lab-headline ${result.headline.tone}`}><b>{TONE[result.headline.tone]}.</b> {result.headline.text}</p>}
            {result.notes.length > 0 && <ul className="lab-notes">{result.notes.map((n) => <li key={n.text}>{n.text}</li>)}</ul>}
          </div>
          {chart && sw && swInput && swOut && (
            <SweepChart title={sw.title} xs={chart.xs} ys={chart.ys} xNow={inputs[sw.input]} yNow={result.values[sw.output]} xLabel={swInput.label.toLowerCase()} yLabel={(swOut.label ?? swOut.id).toLowerCase()}
              xFormat={swInput.format} yFormat={swOut.format ?? 'integer'} ref={sw.reference && chart.ref !== null ? { label: sw.reference.label, value: chart.ref } : null} />
          )}
        </div>
      </div>
      <h4>Your tasks ({latched.size} of {spec.tasks.length})</h4>
      <ol className="tasks">
        {spec.tasks.map((t) => { const done = latched.has(t.id); return <li key={t.id} className={done ? 'done' : ''}><span aria-hidden>{done ? '✓' : '○'}</span><span>{t.text}<span className="sr-only">{done ? ' (done)' : ' (not done yet)'}</span></span></li>; })}
      </ol>
    </section>
  );
}

export default function LabPanel({ lab, completed, onComplete }: { lab: LabSpec; completed: boolean; onComplete(): void }) {
  const compiled = useMemo((): { ok: CompiledLab; problems?: undefined } | { ok?: undefined; problems: string[] } => { try { return { ok: compileLab(lab) }; } catch (e) { return { problems: (e as LabSpecError).problems ?? [String(e)] }; } }, [lab]);
  if (!compiled.ok) return <div className="note warning" role="alert"><b>This lab has a mistake and cannot run.</b><ul>{compiled.problems.map((p) => <li key={p}>{p}</li>)}</ul></div>;
  return <Running lab={compiled.ok} completed={completed} onComplete={onComplete} />;
}
