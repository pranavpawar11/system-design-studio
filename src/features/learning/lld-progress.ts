export interface LLDLessonProgress {
  read: boolean;
  quizPassed: boolean;
  updatedAt: string;
}

const STORAGE_KEY = 'hld-studio:lld-lesson-progress:v1';
const CHANGE_EVENT = 'hld-studio:lld-progress-change';
type ProgressMap = Record<string, LLDLessonProgress>;

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readLLDProgress(): ProgressMap {
  if (!storageAvailable()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
  return next;
}

export function markLLDQuizPassed(id: string): LLDLessonProgress {
  const all = readLLDProgress();
  const next = { ...(all[id] ?? { read: false, quizPassed: false, updatedAt: '' }), quizPassed: true, updatedAt: new Date().toISOString() };
  save({ ...all, [id]: next });
  return next;
}

export function isLLDLessonComplete(progress: LLDLessonProgress): boolean {
  return progress.read && progress.quizPassed;
}

export function lldProgressChangeEvent(): string {
  return CHANGE_EVENT;
}
