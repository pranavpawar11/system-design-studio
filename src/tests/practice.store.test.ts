import { describe, expect, it } from 'vitest';
import { createPracticeRepository } from '../features/practice/practice.repository';
import { createPracticeStore } from '../features/practice/practice.store';
import type { KeyValueStorage } from '../platform/storage/key-value-storage';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: KeyValueStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  return { storage, values };
}

describe('practice domain persistence', () => {
  it('persists selected exercise and exercise-local language override', () => {
    const { storage, values } = memoryStorage();
    const store = createPracticeStore(createPracticeRepository(storage));
    store.getState().selectExercise('rate-limiter');
    store.getState().setLanguageOverride('rate-limiter', 'python');
    const saved = JSON.parse(values.get('hld-studio:practice-state:v1') ?? '{}');
    expect(saved.selectedExerciseId).toBe('rate-limiter');
    expect(saved.drafts['rate-limiter'].languageOverride).toBe('python');
  });

  it('keeps the override when a code draft is saved', () => {
    const { storage } = memoryStorage();
    const store = createPracticeStore(createPracticeRepository(storage));
    store.getState().setLanguageOverride('exercise-a', 'cpp');
    store.getState().saveDraft('exercise-a', {
      activeFilePath: 'main.cpp',
      files: [{ path: 'main.cpp', content: 'int main() {}', language: 'cpp', updatedAt: '2026-01-01T00:00:00.000Z' }],
    });
    expect(store.getState().drafts['exercise-a'].languageOverride).toBe('cpp');
    expect(store.getState().drafts['exercise-a'].files[0].content).toBe('int main() {}');
  });

  it('stores attempts independently for each exercise', () => {
    const { storage } = memoryStorage();
    const store = createPracticeStore(createPracticeRepository(storage));
    store.getState().addAttempt({
      id: 'attempt-1', exerciseId: 'exercise-a', language: 'java', status: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z', sourceSnapshot: [],
    });
    expect(store.getState().attempts['exercise-a']).toHaveLength(1);
    expect(store.getState().attempts['exercise-b']).toBeUndefined();
  });

  it('ignores malformed persisted records', () => {
    const { storage } = memoryStorage({ 'hld-studio:practice-state:v1': JSON.stringify({
      version: 1, selectedExerciseId: 42, drafts: { bad: { exerciseId: 'other', files: 'nope' } }, attempts: { bad: [null] },
    }) });
    const store = createPracticeStore(createPracticeRepository(storage));
    expect(store.getState().selectedExerciseId).toBeNull();
    expect(store.getState().drafts).toEqual({});
    expect(store.getState().attempts).toEqual({});
  });
});
