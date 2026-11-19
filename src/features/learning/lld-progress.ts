import { learnerProgressApi } from '../../api/learning/LearnerProgressApi';
import { useAuthStore } from '../auth/authStore';
export interface LLDLessonProgress {
  read: boolean;
  quizPassed: boolean;
  updatedAt: string;
}

const ANONYMOUS_STORAGE_KEY = 'hld-studio:lld-lesson-progress:v1';
function storageKey(): string {
  const learnerId = useAuthStore.getState().learnerUser?.id;
  return learnerId ? `${ANONYMOUS_STORAGE_KEY}:account:${learnerId}` : ANONYMOUS_STORAGE_KEY;
}
const CHANGE_EVENT = 'hld-studio:lld-progress-change';
type ProgressMap = Record<string, LLDLessonProgress>;

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readLLDProgress(): ProgressMap {
  if (!storageAvailable()) return {};
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return {};
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as ProgressMap : {};
  } catch {
    return {};
  }
}

function save(next: ProgressMap): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Keep the current session usable when browser storage is unavailable.
  }
}

export function getLLDLessonProgress(id: string): LLDLessonProgress {
  return readLLDProgress()[id] ?? { read: false, quizPassed: false, updatedAt: '' };
}

export function markLLDLessonRead(id: string): LLDLessonProgress {
  const all = readLLDProgress();
  const next = { ...(all[id] ?? { read: false, quizPassed: false, updatedAt: '' }), read: true, updatedAt: new Date().toISOString() };
  save({ ...all, [id]: next });
  void learnerProgressApi.record('lld', { nodeId: id, type: 'lesson_read' }).catch(() => undefined);
  return next;
}

export function markLLDQuizPassed(id: string): LLDLessonProgress {
  const all = readLLDProgress();
  const next = { ...(all[id] ?? { read: false, quizPassed: false, updatedAt: '' }), quizPassed: true, updatedAt: new Date().toISOString() };
  save({ ...all, [id]: next });
  void learnerProgressApi.record('lld', { nodeId: id, type: 'quiz_passed', score: 100 }).catch(() => undefined);
  return next;
}

export async function syncLLDProgressFromAccount(): Promise<void> {
  await learnerProgressApi.restoreSession();
  if (!learnerProgressApi.isSignedIn()) return;
  const events = await learnerProgressApi.get('lld');
  const next: ProgressMap = {};
  for (const event of events) {
    const current = next[event.nodeId] ?? { read: false, quizPassed: false, updatedAt: event.at };
    if (event.type === 'lesson_read') current.read = true;
    if (event.type === 'quiz_passed') current.quizPassed = true;
    current.updatedAt = event.at;
    next[event.nodeId] = current;
  }
  save(next);
}

export function isLLDLessonComplete(progress: LLDLessonProgress): boolean {
  return progress.read && progress.quizPassed;
}

export function lldProgressChangeEvent(): string {
  return CHANGE_EVENT;
}
