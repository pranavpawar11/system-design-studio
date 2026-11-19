import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, LoaderCircle, RefreshCw } from 'lucide-react';
import { adminApi, type ImportPreview, type ImportResult, type ImportHistoryBatch, type ImportBatchStatus } from './adminApi';
import './admin-import.css';

export default function QuestionImportPanel({ token }: { token: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [previewId, setPreviewId] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<ImportHistoryBatch[]>([]);
  const [historyStatus, setHistoryStatus] = useState<ImportBatchStatus | ''>('');
  const [expandedBatch, setExpandedBatch] = useState<string>('');
  const [historyError, setHistoryError] = useState('');

  const loadHistory = async () => {
    try {
      const response = await adminApi.listImportHistory(token, { page: 1, pageSize: 25, status: historyStatus || undefined });
      setHistory(response.items);
      setHistoryError('');
    } catch (e) { setHistoryError((e as Error).message); }
  };
  useEffect(() => { void loadHistory(); }, [token, historyStatus]);

  const previewFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setError(''); setMessage(''); setPreview(null); setResults(null); setPreviewId('');
    try {
      const content: Record<string, string> = {};
      for (const file of Array.from(files)) {
        const name = file.name;
        if (name.includes('/') || name.includes('\\') || !name.endsWith('.json')) throw new Error('Choose flat-level .json question files and sidecars only.');
        if (file.size > 512 * 1024) throw new Error(`${name} exceeds the 512 KB per-file limit.`);
        content[name] = await file.text();
      }
      const response = await adminApi.previewQuestionImport(token, content);
      setPreviewId(response.previewId); setPreview(response.report);
      setSelected(response.report.items.filter((item) => item.valid).map((item) => item.file));
      setMessage(`Preview ready. It expires in ${Math.round(response.expiresInSeconds / 60)} minutes.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  const apply = async () => {
    if (!previewId || !selected.length) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await adminApi.applyQuestionImport(token, previewId, selected);
      setResults(response.result.results); setMessage(`${response.result.imported} question(s) imported as drafts.`); setPreviewId(''); await loadHistory();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="admin-import">
    <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Import question package</h2><p>Upload the main question JSON files and their matching sidecars together.</p></div><span className="admin-count-pill">DRAFT only</span></div>
      <div className="admin-import-drop"><FileUp size={26}/><strong>Select question JSON files</strong><span>Multiple selection supported · up to 250 files · 8 MB total</span><input ref={input} type="file" accept=".json,application/json" multiple onChange={(e) => void previewFiles(e.target.files)}/><small>Include files such as <code>url-shortener.json</code>, <code>url-shortener.learning.json</code>, and <code>url-shortener.extensions.json</code>.</small></div>
      {busy && <div className="admin-import-message"><LoaderCircle size={16}/> Processing package…</div>}
      {error && <div className="admin-alert error"><AlertTriangle size={16}/>{error}</div>}
      {message && <div className="admin-alert success"><CheckCircle2 size={16}/>{message}</div>}
    </div>
    {preview && <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Validation preview</h2><p>Only valid items can be selected for import.</p></div><button className="admin-secondary-button" onClick={() => setSelected(preview.items.filter((item) => item.valid).map((item) => item.file))}>Select all valid</button></div>
      <div className="admin-import-stats"><div><strong>{preview.total}</strong><span>Total</span></div><div><strong>{preview.valid}</strong><span>Valid</span></div><div><strong>{preview.invalid}</strong><span>Invalid</span></div><div><strong>{preview.warnings}</strong><span>Warnings</span></div></div>
      <div className="admin-import-list">{preview.items.map((item) => <article key={item.file} className="admin-import-item"><label><input type="checkbox" checked={selected.includes(item.file)} disabled={!item.valid || busy} onChange={(e) => setSelected((current) => e.target.checked ? [...current, item.file] : current.filter((name) => name !== item.file))}/><span><strong>{item.file}</strong><small>{item.questionId ?? 'Question ID unavailable'} · {item.slug ?? 'Slug unavailable'} · {item.action}</small></span></label><span className={`admin-import-status ${item.valid ? 'valid' : 'invalid'}`}>{item.valid ? 'Valid' : 'Invalid'}</span>{item.conflicts.length > 0 && <ul>{item.conflicts.map((conflict, index) => <li key={`${conflict.code}-${index}`} className={conflict.severity.toLowerCase()}>{conflict.message}</li>)}</ul>}</article>)}</div>
      <div className="admin-import-footer"><span>{selected.length} valid question(s) selected</span><button className="admin-primary-button" disabled={busy || !selected.length || !previewId} onClick={() => void apply()}>{busy ? 'Importing…' : 'Import selected as drafts'}</button></div>
    </div>}
    <div className="admin-panel admin-import-history">
      <div className="admin-panel-heading"><div><h2>Import history</h2><p>Persistent records of completed package imports.</p></div>
        <div className="admin-panel-heading-actions"><select aria-label="Filter import history" value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value as ImportBatchStatus | '')}><option value="">All statuses</option><option value="COMPLETED">Completed</option><option value="PARTIAL">Partial</option><option value="FAILED">Failed</option></select><button className="admin-secondary-button" onClick={() => void loadHistory()}><RefreshCw size={14}/> Refresh</button></div>
      </div>
      {historyError && <div className="admin-alert error">{historyError}</div>}
      {history.length === 0 ? <div className="admin-empty"><strong>No import history yet</strong><span>Successful and partially successful imports will appear here.</span></div> :
        <div className="admin-import-list">{history.map((batch) => <article className="admin-import-item" key={batch.id}>
          <div className="admin-import-history-head"><div><strong>{new Date(batch.createdAt).toLocaleString()}</strong><small>By {batch.admin.name} · {batch.selected} selected question(s)</small></div><span className={`admin-import-status ${batch.status.toLowerCase()}`}>{batch.status}</span></div>
          <div className="admin-import-history-counts"><span>{batch.imported} imported</span><span>{batch.skipped} skipped</span><span>{batch.failed} failed</span></div>
          <button className="admin-text-button" onClick={async () => { if (expandedBatch === batch.id) { setExpandedBatch(''); return; } setExpandedBatch(batch.id); if (!batch.items) { try { const detail = await adminApi.getImportHistory(token, batch.id); setHistory((items) => items.map((item) => item.id === batch.id ? detail.batch : item)); } catch (e) { setHistoryError((e as Error).message); } } }}>{expandedBatch === batch.id ? 'Hide details' : 'View details'}</button>
          {expandedBatch === batch.id && batch.items && <div className="admin-import-history-items">{batch.items.map((item) => <div key={item.id}><strong>{item.file}</strong><span className={`admin-import-status ${item.status.toLowerCase()}`}>{item.status}</span><small>{item.message}</small></div>)}</div>}
        </article>)}</div>}
    </div>
    {results && <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Import results</h2><p>Review each question's import outcome.</p></div><button className="admin-secondary-button" onClick={() => { setResults(null); setPreview(null); setMessage(''); }}><RefreshCw size={14}/> New import</button></div><div className="admin-import-list">{results.map((result) => <article key={result.file} className="admin-import-item"><strong>{result.file}</strong><span className={`admin-import-status ${result.status.toLowerCase()}`}>{result.status}</span><small>{result.message}</small></article>)}</div></div>}
  </section>;
}
