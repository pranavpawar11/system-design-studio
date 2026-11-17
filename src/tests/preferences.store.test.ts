import { describe, expect, it, vi } from 'vitest';
import { createPreferencesStore, PREFERENCES_STORAGE_KEY } from '../features/preferences/preferences.store';
import type { KeyValueStorage } from '../platform/storage/key-value-storage';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: KeyValueStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  return { storage, values };
}

describe('preferences store', () => {
  it('uses Java as the default when no preference is stored', () => {
    const { storage } = createMemoryStorage();
    expect(createPreferencesStore(storage).getState().globalProgrammingLanguage).toBe('java');
  });

  it('persists a global language preference', () => {
    const { storage, values } = createMemoryStorage();
    const store = createPreferencesStore(storage);
    store.getState().setGlobalProgrammingLanguage('python');
    expect(store.getState().globalProgrammingLanguage).toBe('python');
    expect(JSON.parse(values.get(PREFERENCES_STORAGE_KEY) ?? '{}')).toEqual({ globalProgrammingLanguage: 'python' });
  });

  it('migrates the previous language-only storage key', () => {
    const { storage, values } = createMemoryStorage({ 'hld-studio:programming-language:v1': 'cpp' });
    const store = createPreferencesStore(storage);
    expect(store.getState().globalProgrammingLanguage).toBe('cpp');
    expect(JSON.parse(values.get(PREFERENCES_STORAGE_KEY) ?? '{}')).toEqual({ globalProgrammingLanguage: 'cpp' });
  });

  it('falls back to Java for corrupt or unsupported persisted preferences', () => {
    const { storage } = createMemoryStorage({ [PREFERENCES_STORAGE_KEY]: '{bad json' });
    expect(createPreferencesStore(storage).getState().globalProgrammingLanguage).toBe('java');
    const unsupported = createMemoryStorage({ [PREFERENCES_STORAGE_KEY]: JSON.stringify({ globalProgrammingLanguage: 'ruby' }) });
    expect(createPreferencesStore(unsupported.storage).getState().globalProgrammingLanguage).toBe('java');
  });

  it('does not emit a preference update when the selected language is unchanged', () => {
    const { storage } = createMemoryStorage();
    const store = createPreferencesStore(storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.getState().setGlobalProgrammingLanguage('java');
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
