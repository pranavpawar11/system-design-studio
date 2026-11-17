import { browserStorage, type KeyValueStorage } from '../../platform/storage/key-value-storage';
import type { PracticeStateSnapshot } from './practice.types';
import { PRACTICE_STORAGE_KEY } from './practice.types';

const EMPTY: PracticeStateSnapshot = { version: 1, selectedExerciseId: null, drafts: {}, attempts: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Validates persisted practice state before it is allowed into the store. */
export function normalizePracticeState(raw: unknown): PracticeStateSnapshot {
  if (!isRecord(raw) || raw.version !== 1) return { ...EMPTY, drafts: {}, attempts: {} };
  const drafts: PracticeStateSnapshot['drafts'] = {};
  if (isRecord(raw.drafts)) {
    for (const [id, value] of Object.entries(raw.drafts)) {
      if (!isRecord(value) || value.exerciseId !== id || typeof value.activeFilePath !== 'string' || !Array.isArray(value.files)) continue;
      const files = value.files.filter((file): file is PracticeStateSnapshot['drafts'][string]['files'][number] =>
        isRecord(file) && typeof file.path === 'string' && typeof file.content === 'string' &&
        (file.language === 'java' || file.language === 'cpp' || file.language === 'python') && typeof file.updatedAt === 'string');
      drafts[id] = {
        exerciseId: id,
        ...(value.languageOverride === 'java' || value.languageOverride === 'cpp' || value.languageOverride === 'python' ? { languageOverride: value.languageOverride } : {}),
        activeFilePath: files.some((file) => file.path === value.activeFilePath) ? value.activeFilePath : (files[0]?.path ?? ''),
        files,
        updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
      };
    }
  }
  const attempts: PracticeStateSnapshot['attempts'] = {};
  if (isRecord(raw.attempts)) {
    for (const [id, list] of Object.entries(raw.attempts)) {
      if (!Array.isArray(list)) continue;
      attempts[id] = list.filter((item) => isRecord(item) && typeof item.id === 'string' && item.exerciseId === id &&
        (item.language === 'java' || item.language === 'cpp' || item.language === 'python') &&
        ['draft', 'submitted', 'evaluated'].includes(String(item.status)) && typeof item.createdAt === 'string' &&
        Array.isArray(item.sourceSnapshot)) as PracticeStateSnapshot['attempts'][string];
    }
  }
  return {
    version: 1,
    selectedExerciseId: typeof raw.selectedExerciseId === 'string' ? raw.selectedExerciseId : null,
    drafts,
    attempts,
  };
}

export interface PracticeRepository {
  load(): PracticeStateSnapshot;
  save(snapshot: PracticeStateSnapshot): void;
}

export function createPracticeRepository(storage: KeyValueStorage = browserStorage): PracticeRepository {
  return {
    load() {
      try {
        const text = storage.getItem(PRACTICE_STORAGE_KEY);
        return text ? normalizePracticeState(JSON.parse(text)) : { ...EMPTY, drafts: {}, attempts: {} };
      } catch {
        return { ...EMPTY, drafts: {}, attempts: {} };
      }
    },
    save(snapshot) {
      storage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(snapshot));
    },
  };
}

export const practiceRepository = createPracticeRepository();
