import { useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { adminApi, type QuestionDraftInput } from './adminApi';
import './question-editor.css';

type Props = { token: string; versionId: string | null; onClose: () => void; onSaved: () => void };
const empty: QuestionDraftInput = { questionId: '', slug: '', title: '', subtitle: '', category: 'system-design', difficulty: 'intermediate', estimatedMinutes: 45, tags: [], questionSpec: {} };
const jsonText = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

export default function QuestionDraftEditor({ token, versionId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<QuestionDraftInput>(empty);
  const [questionJson, setQuestionJson] = useState('{}');
  const [learningJson, setLearningJson] = useState('');
  const [extensionsJson, setExtensionsJson] = useState('');
  const [evaluationJson, setEvaluationJson] = useState('');
  const [loading, setLoading] = useState(Boolean(versionId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!versionId) return;
    let active = true;
    void adminApi.getVersion(token, versionId).then(({ version }) => {
      if (!active) return;
      setForm({ questionId: version.questionId, slug: version.question.slug, title: version.title, subtitle: version.subtitle, category: version.category, difficulty: version.difficulty, estimatedMinutes: version.estimatedMinutes, tags: version.tags, questionSpec: version.questionSpec, learningContent: version.learningContent, extensions: version.extensions, evaluationData: version.evaluationData, sourceSnapshot: version.sourceSnapshot });
      setQuestionJson(jsonText(version.questionSpec));
      setLearningJson(version.learningContent ? jsonText(version.learningContent) : '');
      setExtensionsJson(version.extensions ? jsonText(version.extensions) : '');
      setEvaluationJson(version.evaluationData ? jsonText(version.evaluationData) : '');
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load question version.')).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, versionId]);

  const parseObject = (raw: string, label: string): Record<string, unknown> | null => {
    if (!raw.trim()) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object.`);
    return parsed as Record<string, unknown>;
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSaving(true);
    try {
      const input: QuestionDraftInput = { ...form, questionSpec: parseObject(questionJson, 'Question specification') ?? {}, learningContent: parseObject(learningJson, 'Learning content'), extensions: parseObject(extensionsJson, 'Extensions'), evaluationData: parseObject(evaluationJson, 'Evaluation data'), tags: (form.tags ?? []).map((tag) => tag.trim()).filter(Boolean) };
      if (versionId) await adminApi.updateDraft(token, versionId, input); else await adminApi.createDraft(token, input);
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save question draft.'); }
    finally { setSaving(false); }
  };
  const field = (key: keyof QuestionDraftInput, value: string | number | null) => setForm((current) => ({ ...current, [key]: value }));

  return <div className="question-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="question-editor" onSubmit={(event) => void save(event)}>
      <header><div><span>QUESTION AUTHORING</span><h2>{versionId ? 'Edit question draft' : 'Create question draft'}</h2><p>Save as a draft first. Submission and publishing remain separate workflow steps.</p></div><button type="button" aria-label="Close editor" onClick={onClose}><X size={18}/></button></header>
      {loading ? <div className="question-editor-loading"><LoaderCircle size={18}/> Loading version…</div> : <>
        {error && <div className="question-editor-error" role="alert">{error}</div>}
        <div className="question-editor-grid">
          <label>Question ID<input required minLength={2} maxLength={160} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*" disabled={Boolean(versionId)} value={form.questionId} onChange={(e) => field('questionId', e.target.value)}/></label>
          <label>Slug<input required minLength={2} maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" disabled={Boolean(versionId)} value={form.slug} onChange={(e) => field('slug', e.target.value)}/></label>
          <label className="wide">Title<input required minLength={3} maxLength={200} value={form.title} onChange={(e) => field('title', e.target.value)}/></label>
          <label className="wide">Subtitle<input maxLength={500} value={form.subtitle ?? ''} onChange={(e) => field('subtitle', e.target.value)}/></label>
          <label>Category<input required value={form.category} onChange={(e) => field('category', e.target.value)}/></label>
          <label>Difficulty<select value={form.difficulty} onChange={(e) => field('difficulty', e.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
          <label>Estimated minutes<input type="number" min={1} max={1440} value={form.estimatedMinutes ?? ''} onChange={(e) => field('estimatedMinutes', e.target.value ? Number(e.target.value) : null)}/></label>
          <label>Tags (comma separated)<input value={(form.tags ?? []).join(', ')} onChange={(e) => setForm((current) => ({ ...current, tags: e.target.value.split(',') }))}/></label>
        </div>
        <label className="question-json-field">Question specification (JSON)<textarea required spellCheck={false} rows={12} value={questionJson} onChange={(e) => setQuestionJson(e.target.value)}/></label>
        <div className="question-json-grid">
          <label>Learning content (JSON, optional)<textarea spellCheck={false} rows={8} value={learningJson} onChange={(e) => setLearningJson(e.target.value)} placeholder="{}"/></label>
          <label>Extensions (JSON, optional)<textarea spellCheck={false} rows={8} value={extensionsJson} onChange={(e) => setExtensionsJson(e.target.value)} placeholder="{}"/></label>
          <label>Evaluation data (JSON, optional)<textarea spellCheck={false} rows={8} value={evaluationJson} onChange={(e) => setEvaluationJson(e.target.value)} placeholder="{}"/></label>
        </div>
        <footer><button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="admin-primary-button" disabled={saving || loading}>{saving ? 'Saving…' : 'Save draft'}</button></footer>
      </>}
    </form>
  </div>;
}
