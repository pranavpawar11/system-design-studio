import { useRef, useState } from 'react';
import { Link2, Timer, ClipboardList, Image as ImageIcon, FileJson, PanelLeft, PanelRight, Undo2, Redo2, ShieldCheck, Save, Upload, RotateCcw, History, GraduationCap, FileText, Layers } from 'lucide-react';
import { question, questions, useStudio } from '../../features/architecture/architecture.store';
import { switchQuestion } from '../../api/preferences';
import { api } from '../../api';
import { bridge } from '../canvas/canvasBridge';
import { validateDocument } from '../../features/architecture/architecture.utils';
import Menu from '../ui/Menu';
import Modal from '../ui/Modal';
import InterviewClock from './InterviewClock';
import SaveStatus from './SaveStatus';
import { links } from '../../app/route';
import SummaryModal from './SummaryModal';
import HistoryDialog from './HistoryDialog';

export default function TopBar() {
  const s = useStudio(); const file = useRef<HTMLInputElement>(null);
  const [dlg, setDlg] = useState<null | 'reset' | 'summary' | 'history' | 'interview'>(null); const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(() => { const m = (question.question as { estimatedMinutes?: number }).estimatedMinutes ?? 45; return [20, 30, 45, 60].includes(m) ? m : 45; });
  const active = !!s.interview && !s.interview.endedAt;

  const exportJson = () => {
    try {
      const blob = new Blob([JSON.stringify({ ...s.doc, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${question.question.id}-design.json`; a.click(); URL.revokeObjectURL(a.href);
      s.notify('Design exported as JSON.');
    } catch (e) { s.notify(`Export failed: ${(e as Error).message}`); }
  };
  const exportImage = async () => {
    if (!s.doc.nodes.length) return s.notify('Add components before exporting an image.');
    if (!bridge.exportPng) return s.notify('Image export is not ready yet.');
    try { await bridge.exportPng(); s.notify('Image downloaded as PNG.'); } catch (e) { s.notify(`Image export failed: ${(e as Error).message}`); }
  };
  const shareLink = async () => {
    if (!s.doc.nodes.length) return s.notify('Add components before sharing.');
    try {
      const { url } = await api.createShareLink(question.question.id, s.doc);
      try { await navigator.clipboard.writeText(url); s.notify(api.kind === 'local' ? 'Share link copied. It contains the whole design; no server is involved.' : 'Share link copied.'); }
      catch { setShareUrl(url); }
    } catch (e) { s.notify((e as Error).message); }
  };
  const importJson = async (f?: File) => {
    if (!f) return;
    try {
      const r = validateDocument(JSON.parse(await f.text()), question);
      if (r.ok) { s.replaceDoc(r.doc); s.notify('Design imported.'); } else s.notify(`Import rejected: ${r.errors.slice(0, 3).join(' ')}`);
    } catch { s.notify('Import failed: file is not valid JSON.'); }
    if (file.current) file.current.value = '';
  };
  const endSession = () => { s.endInterview(); setDlg('summary'); };

  return (
    <header className="topbar">
      <div className="bar-group">
        <button className="icon-btn" aria-label="Toggle left panel" title="Toggle left panel" aria-pressed={s.leftOpen} onClick={() => s.togglePanel('left')}><PanelLeft size={18} aria-hidden /></button>
        <a className="brand studio-brand-link" href={links.home} translate="no"><Layers size={18} aria-hidden /> HLD Studio</a>
        <span className="divider" aria-hidden />
        <select className="qselect" aria-label="Choose question" name="question" value={question.question.id} onChange={(e) => switchQuestion(e.target.value)}>
          {questions.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
        </select>
        <span className="pill">{question.question.difficulty}</span>
        <SaveStatus />
      </div>
      <div className="bar-group">
        {active && <InterviewClock onEnd={endSession} />}
        <button className="icon-btn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!s.past.length} onClick={s.undo}><Undo2 size={18} aria-hidden /></button>
        <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!s.future.length} onClick={s.redo}><Redo2 size={18} aria-hidden /></button>
        <span className="divider" aria-hidden />
        <button aria-label="History" title="Version history: save, compare and restore versions" onClick={() => setDlg('history')}><History size={16} aria-hidden /><span className="btn-label">History</span></button>
        <Menu label="Practice" icon={<GraduationCap size={16} aria-hidden />} items={[
          { label: 'Interview mode…', icon: <Timer size={15} aria-hidden />, disabled: active, onSelect: () => setDlg('interview') },
          { label: 'Learning summary', icon: <ClipboardList size={15} aria-hidden />, onSelect: () => setDlg('summary') },
        ]} />
        <Menu label="File" icon={<FileText size={16} aria-hidden />} items={[
          { label: 'Save now', icon: <Save size={15} aria-hidden />, hint: 'Ctrl+S', onSelect: s.save },
          { label: 'Import design…', icon: <Upload size={15} aria-hidden />, onSelect: () => file.current?.click() },
          { label: 'Export design (JSON)', icon: <FileJson size={15} aria-hidden />, separatorBefore: true, onSelect: exportJson },
          { label: 'Export diagram (PNG)', icon: <ImageIcon size={15} aria-hidden />, onSelect: exportImage },
          { label: 'Copy share link', icon: <Link2 size={15} aria-hidden />, onSelect: shareLink },
          { label: 'Reset design…', icon: <RotateCcw size={15} aria-hidden />, danger: true, separatorBefore: true, onSelect: () => setDlg('reset') },
        ]} />
        <button className="primary" onClick={s.validate} disabled={s.validating} aria-busy={s.validating} aria-label={s.validating ? 'Validating…' : 'Validate'}>
          <ShieldCheck size={16} aria-hidden /><span className="btn-label">{s.validating ? 'Validating…' : 'Validate'}</span>
        </button>
        <button className="icon-btn" aria-label="Toggle right panel" title="Toggle right panel" aria-pressed={s.rightOpen} onClick={() => s.togglePanel('right')}><PanelRight size={18} aria-hidden /></button>
      </div>
      <input ref={file} type="file" accept="application/json,.json" hidden name="import-file" aria-label="Import design JSON" onChange={(e) => importJson(e.target.files?.[0])} />

      {dlg === 'history' && <HistoryDialog onClose={() => setDlg(null)} />}
      {dlg === 'summary' && <SummaryModal onClose={() => setDlg(null)} />}
      {dlg === 'interview' && (
        <Modal label="Start interview session" onClose={() => setDlg(null)}>
          <h2>Start an interview session?</h2>
          <p>A countdown starts now. Hints and reference solutions stay locked until you end the session, and your validations are counted.</p>
          <label className="field"><span>Duration</span><select name="duration" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{[20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
          <div className="modal-actions"><button onClick={() => setDlg(null)}>Cancel</button><button className="primary" onClick={() => { s.startInterview(minutes); setDlg(null); }}>Start session</button></div>
        </Modal>
      )}
      {dlg === 'reset' && (
        <Modal label="Reset design" onClose={() => setDlg(null)}>
          <h2>Reset this design?</h2><p>This removes every component and connection. You can undo it with Ctrl+Z.</p>
          <div className="modal-actions"><button data-autofocus onClick={() => setDlg(null)}>Cancel</button><button className="danger" onClick={() => { s.reset(); setDlg(null); }}>Reset design</button></div>
        </Modal>
      )}
      {shareUrl && (
        <Modal label="Share link" wide onClose={() => setShareUrl(null)}>
          <h2>Copy this link</h2><p className="muted">Your browser blocked automatic copying. Select the text and copy it.</p>
          <label className="sr-only" htmlFor="shareurl">Share link</label>
          <textarea id="shareurl" name="share-link" className="sharebox" readOnly rows={5} value={shareUrl} spellCheck={false} data-autofocus onFocus={(e) => e.currentTarget.select()} />
          <div className="modal-actions"><button className="primary" onClick={() => setShareUrl(null)}>Done</button></div>
        </Modal>
      )}
    </header>
  );
}
