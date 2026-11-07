import type { Draft, DraftResult, Interview, Snapshot, QuestionSpec } from '../contracts';
import { validateDocument } from '../../features/architecture/architecture.utils';

/** Browser-storage persistence used by LocalApi only. Keys are versioned per question. */
const draftKey = (q: QuestionSpec) => `hld-studio:draft:${q.question.id}:v1`;
const snapKey = (q: QuestionSpec) => `hld-studio:snapshots:${q.question.id}:v1`;
const ivKey = (q: QuestionSpec) => `hld-studio:interview:${q.question.id}:v1`;

export function readDraft(q: QuestionSpec): DraftResult {
  try {
    const text = localStorage.getItem(draftKey(q));
    if (!text) return { status: 'none' };
    const raw = JSON.parse(text);
    const v = validateDocument(raw?.doc, q);
    if (!v.ok) return { status: 'corrupt', errors: v.errors };
    return { status: 'ok', draft: { doc: v.doc, hints: Array.isArray(raw.hints) ? raw.hints.filter((h: unknown) => typeof h === 'string') : [], answers: raw.answers && typeof raw.answers === 'object' ? raw.answers : {}, savedAt: raw.savedAt } };
  } catch (e) { return { status: 'corrupt', errors: [String(e)] }; }
}
/** Throws when storage is unavailable or full, so callers can report a failed save. */
export function writeDraft(q: QuestionSpec, d: Draft) {
  localStorage.setItem(draftKey(q), JSON.stringify({ draftVersion: 1, questionVersion: q.question.version, savedAt: new Date().toISOString(), doc: d.doc, hints: d.hints, answers: d.answers }));
}
export const removeDraft = (q: QuestionSpec) => { try { localStorage.removeItem(draftKey(q)); } catch { /* ignore */ } };

export function readSnapshots(q: QuestionSpec): Snapshot[] {
  try {
    const raw = JSON.parse(localStorage.getItem(snapKey(q)) ?? '[]');
    return Array.isArray(raw) ? raw.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string' && validateDocument(s.doc, q).ok) : [];
  } catch { return []; }
}
export const writeSnapshots = (q: QuestionSpec, list: Snapshot[]) => localStorage.setItem(snapKey(q), JSON.stringify(list));

export function readInterview(q: QuestionSpec): Interview | null {
  try {
    const r = JSON.parse(localStorage.getItem(ivKey(q)) ?? 'null');
    return r && Number.isFinite(r.startedAt) && Number.isFinite(r.durationMs) ? { startedAt: r.startedAt, durationMs: r.durationMs, endedAt: Number.isFinite(r.endedAt) ? r.endedAt : undefined, validations: Number(r.validations) || 0 } : null;
  } catch { return null; }
}
export const writeInterview = (q: QuestionSpec, iv: Interview) => localStorage.setItem(ivKey(q), JSON.stringify(iv));
export const removeInterview = (q: QuestionSpec) => { try { localStorage.removeItem(ivKey(q)); } catch { /* ignore */ } };
