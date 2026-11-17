import { create } from 'zustand';
import { browserStorage, type KeyValueStorage } from '../../platform/storage/key-value-storage';
import {
  DEFAULT_USER_PREFERENCES,
  isProgrammingLanguage,
  type ProgrammingLanguage,
  type UserPreferences,
} from './preferences.types';

export const PREFERENCES_STORAGE_KEY = 'hld-studio:user-preferences:v1';
const LEGACY_PROGRAMMING_LANGUAGE_STORAGE_KEY = 'hld-studio:programming-language:v1';
export const PREFERENCES_CHANGE_EVENT = 'hld-studio:preferences-change';
/** Legacy event retained for existing language-aware components and integrations. */
export const PROGRAMMING_LANGUAGE_CHANGE_EVENT = 'hld-studio:programming-language-change';

export interface PreferencesState extends UserPreferences {
  setGlobalProgrammingLanguage(language: ProgrammingLanguage): void;
  resetPreferences(): void;
}

function readPreferences(storage: KeyValueStorage): UserPreferences {
  const raw = storage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) {
    // Migrate existing learners' saved language without resetting their preference.
    const legacyLanguage = storage.getItem(LEGACY_PROGRAMMING_LANGUAGE_STORAGE_KEY);
    const migrated = isProgrammingLanguage(legacyLanguage)
      ? { globalProgrammingLanguage: legacyLanguage }
      : { ...DEFAULT_USER_PREFERENCES };
    persistPreferences(migrated, storage);
    storage.removeItem(LEGACY_PROGRAMMING_LANGUAGE_STORAGE_KEY);
    return migrated;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_USER_PREFERENCES };
    const language = (parsed as Record<string, unknown>).globalProgrammingLanguage;
    return { globalProgrammingLanguage: isProgrammingLanguage(language) ? language : DEFAULT_USER_PREFERENCES.globalProgrammingLanguage };
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

function persistPreferences(preferences: UserPreferences, storage: KeyValueStorage): void {
  storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

function dispatchPreferenceEvents(languageChanged: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PREFERENCES_CHANGE_EVENT));
  if (languageChanged) window.dispatchEvent(new Event(PROGRAMMING_LANGUAGE_CHANGE_EVENT));
}

/** Factory is exported to make persistence behavior testable with an isolated storage adapter. */
export function createPreferencesStore(storage: KeyValueStorage = browserStorage) {
  return create<PreferencesState>((set, get) => ({
    ...readPreferences(storage),
    setGlobalProgrammingLanguage(language) {
      if (!isProgrammingLanguage(language) || language === get().globalProgrammingLanguage) return;
      const next = { globalProgrammingLanguage: language };
      persistPreferences(next, storage);
      set(next);
      dispatchPreferenceEvents(true);
    },
    resetPreferences() {
      const languageChanged = get().globalProgrammingLanguage !== DEFAULT_USER_PREFERENCES.globalProgrammingLanguage;
      const next = { ...DEFAULT_USER_PREFERENCES };
      persistPreferences(next, storage);
      set(next);
      dispatchPreferenceEvents(languageChanged);
    },
  }));
}

export const usePreferencesStore = createPreferencesStore();

/** Apply changes made in another browser tab to this tab's in-memory store. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== PREFERENCES_STORAGE_KEY) return;
    const next = readPreferences(browserStorage);
    usePreferencesStore.setState(next);
    window.dispatchEvent(new Event(PREFERENCES_CHANGE_EVENT));
    window.dispatchEvent(new Event(PROGRAMMING_LANGUAGE_CHANGE_EVENT));
  });
}
