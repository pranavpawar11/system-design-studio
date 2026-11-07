import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument } from '../architecture/architecture.types';
import type { Interview, Snapshot } from '../architecture/session.types';
import { validateDocument } from '../architecture/architecture.utils';

const key = (q: QuestionSpec) => `hld-studio:draft:${q.question.id}:v1`;
export interface Answer { text: string; covered: number[]; revealed: boolean }
export type Answers = Record<string, Answer>;
export type DraftResult = { status: 'none' } | { status: 'ok'; doc: ArchitectureDocument; hints: string[]; answers: Answers } | { status: 'corrupt'; errors: string[] };

export function loadDraft(q: QuestionSpec): DraftResult {
  try {
    const text = localStorage.getItem(key(q));
    if (!text) return { status: 'none' };
    const raw = JSON.parse(text);
    const v = validateDocument(raw?.doc, q);
    if (!v.ok) return { status: 'corrupt', errors: v.errors };
    return { status: 'ok', doc: v.doc, hints: Array.isArray(raw.hints) ? raw.hints.filter((h: unknown) => typeof h === 'string') : [], answers: raw.answers && typeof raw.answers === 'object' ? (raw.answers as Answers) : {} };
  } catch (e) {
    return localStorage === undefined ? { status: 'none' } : { status: 'corrupt', errors: [String(e)] };
  }
}
export function saveDraft(q: QuestionSpec, doc: ArchitectureDocument, hints: string[], answers: Answers = {}): boolean {
  try { localStorage.setItem(key(q), JSON.stringify({ draftVersion: 1, questionVersion: q.question.version, savedAt: new Date().toISOString(), doc, hints, answers })); return true; }
  catch { return false; }
}
const snapKey = (q: QuestionSpec) => `hld-studio:snapshots:${q.question.id}:v1`;
const ivKey = (q: QuestionSpec) => `hld-studio:interview:${q.question.id}:v1`;
export function loadSnapshots(q: QuestionSpec): Snapshot[] {
  try {
    const raw = JSON.parse(localStorage.getItem(snapKey(q)) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string' && validateDocument(s.doc, q).ok);
  } catch { return []; }
}
export function saveSnapshots(q: QuestionSpec, list: Snapshot[]): boolean { try { localStorage.setItem(snapKey(q), JSON.stringify(list)); return true; } catch { return false; } }
export function loadInterview(q: QuestionSpec): Interview | null {
  try { const r = JSON.parse(localStorage.getItem(ivKey(q)) ?? 'null'); return r && Number.isFinite(r.startedAt) && Number.isFinite(r.durationMs) ? { startedAt: r.startedAt, durationMs: r.durationMs, endedAt: Number.isFinite(r.endedAt) ? r.endedAt : undefined, validations: Number(r.validations) || 0 } : null; } catch { return null; }
}
export function saveInterview(q: QuestionSpec, iv: Interview | null) { try { if (iv) localStorage.setItem(ivKey(q), JSON.stringify(iv)); else localStorage.removeItem(ivKey(q)); } catch { /* ignore */ } }
export function clearDraft(q: QuestionSpec) { try { localStorage.removeItem(key(q)); } catch { /* ignore */ } }
