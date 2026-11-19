import { useMemo, useState } from 'react';
import { Eye, EyeOff, Plus, Save, Trash2, X } from 'lucide-react';
import type { LearningVersionDetail } from './adminApi';

type Block = Record<string, unknown> & { type?: string; text?: string; title?: string; level?: number; items?: unknown[] };
type Content = Record<string, unknown> & { id?: string; title?: string; blocks?: Block[] };
type Props = {
  lesson: LearningVersionDetail;
  saving: boolean;
  onClose: () => void;
  onSave: (input: { title: string; summary: string; minutes: number; content: Content }) => Promise<void>;
};
const asContent = (value: unknown): Content => value && typeof value === 'object' && !Array.isArray(value) ? value as Content : {};
const asBlocks = (content: Content): Block[] => Array.isArray(content.blocks) ? content.blocks.map((block) => ({ ...block })) : [];

export default function LearningLessonEditor({ lesson, saving, onClose, onSave }: Props) {
  const initial = useMemo(() => asContent(lesson.content), [lesson.id, lesson.updatedAt]);
  const [title, setTitle] = useState(lesson.title);
  const [summary, setSummary] = useState(lesson.summary);
  const [minutes, setMinutes] = useState(lesson.minutes);
  const [blocks, setBlocks] = useState<Block[]>(() => asBlocks(initial));
  const [preview, setPreview] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initial, null, 2));
  const [jsonError, setJsonError] = useState('');

  const updateBlock = (index: number, patch: Partial<Block>) => setBlocks((current) => current.map((block, i) => i === index ? { ...block, ...patch } : block));
  const updateListItems = (index: number, value: string) => updateBlock(index, { items: value.split('\n').map((item) => item.trim()).filter(Boolean) });
  const addBlock = (type: string) => setBlocks((current) => [...current, type === 'heading' ? { type, text: 'New heading', level: 2 } : type === 'list' ? { type, items: ['First item'], ordered: false } : { type, text: '' }]);

  const buildContent = (): Content => {
    if (advanced) {
      const parsed = JSON.parse(jsonText) as Content;
      return { ...parsed, id: lesson.lesson.lessonKey, title, summary, minutes };
    }
    return { ...initial, id: lesson.lesson.lessonKey, title, summary, minutes, blocks };
  };

  const save = async () => {
    try {
      setJsonError('');
      const content = buildContent();
      if (!Array.isArray(content.blocks)) throw new Error('Lesson content must contain a blocks array.');
      await onSave({ title: title.trim(), summary: summary.trim(), minutes, content });
    } catch (error) { setJsonError((error as Error).message || 'Invalid lesson JSON.'); }
  };

  const previewBlocks = advanced ? (() => { try { return asBlocks(JSON.parse(jsonText) as Content); } catch { return []; } })() : blocks;

  return <div className="admin-modal-backdrop learning-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="learning-editor-modal" role="dialog" aria-modal="true" aria-label="Edit learning lesson">
      <header className="learning-editor-header">
        <div><span>{lesson.lesson.track.key.toUpperCase()} · {lesson.lesson.lessonKey} · VERSION {lesson.version}</span><h2>Edit lesson</h2><p>Changes are saved as a draft. Review and publication remain separate steps.</p></div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close editor"><X size={18}/></button>
      </header>
      <div className="learning-editor-meta"><span className={`learning-status ${lesson.status.toLowerCase()}`}>{lesson.status.replaceAll('_', ' ')}</span><span>{blocks.length} content blocks</span><span>Quiz and language variants are preserved.</span></div>
      <div className="learning-editor-switches">
        <button type="button" className={!preview ? 'active' : ''} onClick={() => setPreview(false)}><EyeOff size={14}/> Editor</button>
        <button type="button" className={preview ? 'active' : ''} onClick={() => setPreview(true)}><Eye size={14}/> Preview</button>
        <button type="button" className={advanced ? 'active' : ''} onClick={() => { try { if (!advanced) { setJsonText(JSON.stringify({ ...initial, id: lesson.lesson.lessonKey, title, summary, minutes, blocks }, null, 2)); setAdvanced(true); } else { const parsed = JSON.parse(jsonText) as Content; setTitle(String(parsed.title ?? title)); setSummary(String(parsed.summary ?? summary)); setMinutes(Number(parsed.minutes ?? minutes)); setBlocks(asBlocks(parsed)); setAdvanced(false); } setJsonError(''); } catch { setJsonError('Cannot switch modes: the advanced JSON is invalid.'); } }} aria-pressed={advanced}> {advanced ? 'Structured editor' : 'Advanced JSON'} </button>
      </div>
      {!preview ? <div className="learning-editor-body">
        <div className="learning-editor-fields">
          <label>Lesson title<input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)}/></label>
          <label>Summary<textarea value={summary} maxLength={2000} rows={3} onChange={(event) => setSummary(event.target.value)}/></label>
          <label>Estimated reading time (minutes)<input type="number" min={1} max={600} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}/></label>
        </div>
        {advanced ? <label className="learning-editor-json">Complete lesson JSON<textarea spellCheck={false} value={jsonText} onChange={(event) => setJsonText(event.target.value)}/></label> : <div className="learning-editor-blocks">
          <div className="learning-editor-section-heading"><div><h3>Content blocks</h3><p>Edit the lesson's learning material in order.</p></div><div className="learning-editor-add"><button type="button" onClick={() => addBlock('paragraph')}><Plus size={13}/> Paragraph</button><button type="button" onClick={() => addBlock('heading')}><Plus size={13}/> Heading</button><button type="button" onClick={() => addBlock('list')}><Plus size={13}/> List</button></div></div>
          {blocks.map((block, index) => <article className="learning-editor-block" key={`${index}-${String(block.type ?? 'block')}`}>
            <div className="learning-editor-block-top"><strong>Block {index + 1}</strong><select aria-label={`Block ${index + 1} type`} value={String(block.type ?? 'paragraph')} onChange={(event) => updateBlock(index, { type: event.target.value })}><option value="paragraph">Paragraph</option><option value="heading">Heading</option><option value="list">List</option><option value="example">Example</option><option value="callout">Callout</option><option value="code">Code</option></select><button type="button" className="learning-editor-icon-danger" onClick={() => setBlocks((current) => current.filter((_, i) => i !== index))} aria-label={`Delete block ${index + 1}`}><Trash2 size={14}/></button></div>
            {(block.type === 'example' || block.type === 'callout') && <label>Block title<input value={String(block.title ?? '')} onChange={(event) => updateBlock(index, { title: event.target.value })}/></label>}
            {block.type === 'heading' && <label>Heading level<select value={Number(block.level ?? 2)} onChange={(event) => updateBlock(index, { level: Number(event.target.value) })}><option value={2}>H2</option><option value={3}>H3</option><option value={4}>H4</option></select></label>}
            {block.type === 'list' ? <label>List items (one per line)<textarea rows={4} value={Array.isArray(block.items) ? block.items.map(String).join('\n') : ''} onChange={(event) => updateListItems(index, event.target.value)}/></label> : <label>{block.type === 'code' ? 'Code / text' : 'Block text'}<textarea rows={block.type === 'paragraph' ? 4 : 5} value={String(block.text ?? '')} onChange={(event) => updateBlock(index, { text: event.target.value })}/></label>}
          </article>)}
          {blocks.length === 0 && <div className="learning-editor-empty">No content blocks yet. Add a paragraph, heading or list to begin.</div>}
        </div>}
      </div> : <div className="learning-lesson-preview"><div className="learning-preview-reading"><span>{lesson.lesson.track.key.toUpperCase()} · {minutes} MIN</span><h1>{title || 'Untitled lesson'}</h1><p className="learning-preview-summary">{summary}</p>{previewBlocks.map((block, index) => <section key={index} className={`learning-preview-block preview-${String(block.type ?? 'paragraph')}`}>{block.type === 'heading' ? <h2>{String(block.text ?? '')}</h2> : block.type === 'list' ? <ul>{(Array.isArray(block.items) ? block.items : []).map((item, itemIndex) => <li key={itemIndex}>{String(item)}</li>)}</ul> : <><h3>{typeof block.title === 'string' ? block.title : ''}</h3><p>{String(block.text ?? '')}</p></>}</section>)}<div className="learning-preview-preserved">Quiz, lab, practice and language-variant data are retained in the lesson JSON.</div></div></div>}
      {jsonError && <div className="admin-alert error learning-editor-error">{jsonError}</div>}
      <footer className="learning-editor-footer"><button type="button" className="admin-secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className="admin-primary-button" onClick={() => void save()} disabled={saving || !title.trim() || !summary.trim() || !Number.isInteger(minutes) || minutes < 1}><Save size={14}/> {saving ? 'Saving…' : 'Save draft'}</button></footer>
    </section>
  </div>;
}
