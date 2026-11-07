import { useState } from 'react';
import { Camera, GitCompare, RotateCcw } from 'lucide-react';
import { useStudio } from '../../features/architecture/architecture.store';
import Modal from '../ui/Modal';
import CompareModal from './CompareModal';

const when = (iso: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

/** Version history: save named snapshots, compare any of them with the current design, restore or delete. */
export default function HistoryDialog({ onClose }: { onClose(): void }) {
  const { snapshots, saveSnapshot, restoreSnapshot, deleteSnapshot } = useStudio();
  const [name, setName] = useState(''); const [cmp, setCmp] = useState<string | null>(null); const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const snap = snapshots.find((x) => x.id === cmp);
  return (
    <Modal label="Version history" wide onClose={onClose}>
      <div className="modal-head"><h2>Version history</h2><button className="icon-btn" aria-label="Close version history" onClick={onClose}>✕</button></div>
      <p className="muted">Save a version before you try something risky. Compare it with your design later, or go back to it.</p>
      <form className="snap-new" onSubmit={(e) => { e.preventDefault(); saveSnapshot(name); setName(''); }}>
        <label className="sr-only" htmlFor="snapname">Version name</label>
        <input id="snapname" name="snapshot-name" autoComplete="off" data-autofocus placeholder="Name this version (optional)…" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="primary"><Camera size={14} aria-hidden /> Save version</button>
      </form>
      {snapshots.length === 0 && <div className="empty"><b>No versions yet</b><p>Your current design isn’t saved as a version. Save one to start comparing.</p></div>}
      <ul className="snap-list">
        {snapshots.map((x) => (
          <li key={x.id} className="snap">
            <div className="snap-main"><b>{x.name}</b><small>{when(x.createdAt)} · {x.doc.nodes.length} components</small></div>
            {confirmDelete === x.id ? (
              <div className="snap-actions" role="group" aria-label={`Delete ${x.name}?`}>
                <span className="muted">Delete this version?</span>
                <button className="danger" onClick={() => { deleteSnapshot(x.id); setConfirmDelete(null); }}>Delete</button>
                <button onClick={() => setConfirmDelete(null)}>Keep</button>
              </div>
            ) : (
              <div className="snap-actions">
                <button aria-label={`Compare ${x.name} with current design`} onClick={() => setCmp(x.id)}><GitCompare size={14} aria-hidden /> Compare</button>
                <button aria-label={`Restore ${x.name}`} onClick={() => { restoreSnapshot(x.id); onClose(); }}><RotateCcw size={14} aria-hidden /> Restore</button>
                <button className="ghost" aria-label={`Delete ${x.name}`} onClick={() => setConfirmDelete(x.id)}>Delete</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {snap && <CompareModal snapshot={snap} onClose={() => setCmp(null)} />}
    </Modal>
  );
}
