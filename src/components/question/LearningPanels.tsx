import { useState } from 'react';
import { useStudio, learning } from '../../features/architecture/architecture.store';
import { compareWithReference } from '../../features/reference/compare';
import type { ArchitectureDocument } from '../../features/architecture/architecture.types';

export const FOLLOW_UPS = learning.followUpQuestions;
const REFS = learning.referenceSolutions;

export function FollowUps() {
  const { answers, setAnswer } = useStudio();
  return (
    <div>
      {FOLLOW_UPS.map((f) => {
        const a = answers[f.id] ?? { text: '', covered: [], revealed: false };
        return (
          <details key={f.id} className="fu">
            <summary><b>{f.prompt}</b> <small>{f.difficulty}{a.revealed ? ` · ${a.covered.length}/${f.expectedAnswerPoints.length} covered` : ''}</small></summary>
            <textarea name={`answer-${f.id}`} autoComplete="off" aria-label={`Answer: ${f.prompt}`} rows={4} placeholder="Write your answer first…" value={a.text} onChange={(e) => setAnswer(f.id, { text: e.target.value })} />
            {!a.revealed ? <button disabled={!a.text.trim()} onClick={() => setAnswer(f.id, { revealed: true })}>Check against key points</button> : (
              <div>
                <p className="muted">Tick the points your answer made. This is a self-check, not an automatic grade.</p>
                {f.expectedAnswerPoints.map((pt, i) => (
                  <label key={pt} className="field check"><input type="checkbox" checked={a.covered.includes(i)}
                    onChange={(e) => setAnswer(f.id, { covered: e.target.checked ? [...a.covered, i] : a.covered.filter((x) => x !== i) })} /> {pt}</label>
                ))}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}

export function ReferencePanel() {
  const { doc, loadReference } = useStudio();
  const locked = useStudio((s) => !!s.interview && !s.interview.endedAt);
  const [shown, setShown] = useState(false); const [open, setOpen] = useState<string | null>(null); const [confirm, setConfirm] = useState<string | null>(null);
  if (locked) return <div><h2>Reference solutions</h2><div className="callout"><b>Locked during the interview</b><p>End the session first. Reference solutions unlock afterwards.</p></div></div>;
  if (!shown) return (
    <div><h2>Reference solutions</h2>
      <p className="muted">These are example designs, not the only correct answer. Try your own design and validate it first.</p>
      <button onClick={() => setShown(true)}>Show reference solutions</button></div>
  );
  const names = (d: ArchitectureDocument) => d.nodes.length;
  return (
    <div>
      <h2>Reference solutions</h2>
      <p className="muted">Your design is judged by requirements, not by similarity to these.</p>
      {REFS.map((r) => {
        const cmp = compareWithReference(doc, r.architecture);
        return (
          <section key={r.id} className="cat">
            <button className="cat-head" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span /><span className="cat-name">{r.name}</span><span className="count">{r.difficulty}</span></button>
            {open === r.id && (
              <div className="refbody">
                <h3>Compared with your design</h3>
                <p>Shared: {cmp.shared.join(', ') || 'none'}</p>
                <p>In reference, not in yours: {cmp.missing.join(', ') || 'none'}</p>
                <p>In yours, not in reference: {cmp.extra.join(', ') || 'none'}</p>
                {r.flows.map((f) => <div key={f.name}><h3>{f.name}</h3><ol>{f.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>)}
                <h3>Strengths</h3><ul>{r.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
                <h3>Limitations</h3><ul>{r.limitations.map((s) => <li key={s}>{s}</li>)}</ul>
                <h3>Trade-offs</h3><ul>{r.tradeoffs.map((s) => <li key={s}>{s}</li>)}</ul>
                <button onClick={() => (names(doc) ? setConfirm(r.id) : loadReference(r.architecture))}>Load onto canvas</button>
                {confirm === r.id && <div className="callout"><b>Replace your current design?</b><p>You can undo this with Ctrl+Z.</p>
                  <button onClick={() => setConfirm(null)}>Cancel</button> <button className="danger" onClick={() => { loadReference(r.architecture); setConfirm(null); }}>Replace</button></div>}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
