import Modal from '../ui/Modal';
import { question, useStudio } from '../../features/architecture/architecture.store';
import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { EvaluationReport } from '../../api';
import { diffDocs } from '../../features/snapshots/diff';
import { reqTitle } from '../../features/questions/requirementGroups';
import type { Snapshot } from '../../features/architecture/session.types';

const RANK = { pass: 2, 'not-evaluated': 1, fail: 0 } as const;
const LABEL = { pass: 'Met', 'not-evaluated': 'Unverified', fail: 'Not met' } as const;

export default function CompareModal({ snapshot, onClose }: { snapshot: Snapshot; onClose(): void }) {
  const doc = useStudio((s) => s.doc);
  const typeName = (id: string) => question.connectionTypes.find((c) => c.id === id)?.name ?? id;
  const d = diffDocs(snapshot.doc, doc, typeName);
  const [reports, setReports] = useState<{ before: EvaluationReport; after: EvaluationReport } | null>(null); const [err, setErr] = useState('');
  useEffect(() => {
    let live = true; const id = question.question.id;
    Promise.all([api.evaluate(id, { doc: snapshot.doc }), api.evaluate(id, { doc })]).then(([before, after]) => live && setReports({ before, after })).catch((e: Error) => live && setErr(e.message));
    return () => { live = false; };
  }, [snapshot, doc]);
  const before = new Map(reports?.before.requirements.map((r) => [r.requirementId, r.status]) ?? []);
  const after = new Map(reports?.after.requirements.map((r) => [r.requirementId, r.status]) ?? []);
  const rows = [...after].map(([id, st]) => ({ id, from: before.get(id) ?? 'not-evaluated', to: st })).filter((r) => r.from !== r.to);
  const List = ({ title, items }: { title: string; items: string[] }) => items.length ? <><h3>{title}</h3><ul>{items.map((i) => <li key={i}>{i}</li>)}</ul></> : null;
  return (
    <Modal label="Compare with snapshot" wide onClose={onClose}>
      <h2>“{snapshot.name}” → current design</h2>
      <p className="muted">Saved {new Date(snapshot.createdAt).toLocaleString()}. Requirement results are re-checked now for both versions.</p>
      {d.identical && <div className="callout"><b>No differences</b><p>Your current design matches this snapshot.</p></div>}
      <List title="Components added" items={d.addedNodes} /><List title="Components removed" items={d.removedNodes} />
      {d.changedNodes.length > 0 && <><h3>Components changed</h3><ul>{d.changedNodes.map((c) => <li key={c.name}><b>{c.name}</b>: {c.changes.join('; ')}</li>)}</ul></>}
      <List title="Connections added" items={d.addedEdges} /><List title="Connections removed" items={d.removedEdges} />
      {d.movedCount > 0 && <p className="muted">{d.movedCount} component{d.movedCount === 1 ? ' was' : 's were'} only moved.</p>}
      <h3>Requirement results</h3>
      {err ? <p className="err" role="alert">Could not check requirements: {err}</p> : !reports ? <p className="muted">Checking requirements…</p> : rows.length === 0 ? <p className="muted">No requirement changed status.</p> : <ul>{rows.map((r) => (
        <li key={r.id}>{reqTitle(r.id)}: {LABEL[r.from as keyof typeof LABEL]} → <b>{LABEL[r.to as keyof typeof LABEL]}</b> {RANK[r.to as keyof typeof RANK] > RANK[r.from as keyof typeof RANK] ? '▲ improved' : '▼ regressed'}</li>
      ))}</ul>}
      <div className="modal-actions"><button className="primary" onClick={onClose}>Close</button></div>
    </Modal>
  );
}
