import { useEffect } from 'react';
import { useStudio } from '../features/architecture/architecture.store';
import { api } from '../api';
import { validateDocument } from '../features/architecture/architecture.utils';
import { question } from '../features/architecture/architecture.store';
import { switchQuestion } from '../api/preferences';
import ResizeHandle from '../components/layout/ResizeHandle';
import TopBar from '../components/layout/TopBar';
import LeftSidebar from '../components/layout/LeftSidebar';
import RightInspector from '../components/layout/RightInspector';
import ArchitectureCanvas from '../components/canvas/ArchitectureCanvas';

export default function App() {
  const s = useStudio();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void useStudio.getState().save(); return; }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      const st = useStudio.getState(); const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); }
      else if (mod && k === 'y') { e.preventDefault(); st.redo(); }
      else if (mod && k === 'c') st.copy();
      else if (mod && k === 'v') { e.preventDefault(); st.paste(); }
      else if (mod && k === 'd') { e.preventDefault(); st.duplicate(); }
      else if (mod && k === 'a') { e.preventDefault(); st.selectAll(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { if (st.selIds.length) st.removeNodes(st.selIds); else if (st.selEdge) st.removeEdge(st.selEdge); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    api.resolveShare({ hash: window.location.hash, pathname: window.location.pathname }).then((p) => {
      if (!p) return;
      if (p.questionId !== question.question.id) return useStudio.getState().setShared({ kind: 'other-question', questionId: p.questionId });
      const v = validateDocument(p.doc, question);
      useStudio.getState().setShared(v.ok ? { kind: 'design', doc: v.doc } : { kind: 'error', message: `The shared design is not valid here: ${v.errors[0]}` });
    }).catch((e: Error) => useStudio.getState().setShared({ kind: 'error', message: e.message }));
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { const st = useStudio.getState(); if (st.dirty || st.saveState !== 'saved') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => { if (!s.toast) return; const t = setTimeout(() => s.notify(null), 4500); return () => clearTimeout(t); }, [s.toast, s]);
  return (
    <div className="app">
      <a className="skip" href="#canvas">Skip to the canvas</a>
      <TopBar />
      {s.draftErrors && (
        <div className="banner" role="alert">Your saved draft could not be restored ({s.draftErrors[0]}). <button onClick={s.discardDraft}>Discard corrupted draft</button></div>
      )}
      {s.shared?.kind === 'design' && <div className="banner info" role="status">A shared design was found in this link. <button onClick={s.openShared}>Open it</button> <button onClick={() => { s.setShared(null); window.history.replaceState(null, '', window.location.pathname); }}>Ignore</button> <small>Opening replaces your canvas, and you can undo it.</small></div>}
      {s.shared?.kind === 'other-question' && <div className="banner info" role="status">This link is for a different question. <button onClick={() => switchQuestion((s.shared as { questionId: string }).questionId)}>Switch question</button> <button onClick={() => s.setShared(null)}>Ignore</button></div>}
      {s.shared?.kind === 'error' && <div className="banner" role="alert">{s.shared.message} <button onClick={() => s.setShared(null)}>Dismiss</button></div>}
      <main className="workspace" id="workspace">{s.leftOpen && <><LeftSidebar /><ResizeHandle side="left" /></>}<ArchitectureCanvas />{s.rightOpen && <><ResizeHandle side="right" /><RightInspector /></>}</main>
      <div className="toast-region" role="status" aria-live="polite">{s.toast && <div className="toast">{s.toast}</div>}</div>
    </div>
  );
}
