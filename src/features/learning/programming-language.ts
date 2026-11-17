/**
 * Backwards-compatible language preference facade.
 * New application code should use the preferences domain directly.
 */
import { usePreferencesStore } from '../preferences/preferences.store';
import {
  DEFAULT_PROGRAMMING_LANGUAGE,
  PROGRAMMING_LANGUAGES,
  type ProgrammingLanguage,
} from '../preferences/preferences.types';

export {
  DEFAULT_PROGRAMMING_LANGUAGE,
  PROGRAMMING_LANGUAGES,
  type ProgrammingLanguage,
} from '../preferences/preferences.types';
export { PREFERENCES_STORAGE_KEY as PROGRAMMING_LANGUAGE_STORAGE_KEY } from '../preferences/preferences.store';

/** Read the global language preference. Java remains the default for existing learners. */
export function getProgrammingLanguage(): ProgrammingLanguage {
  return usePreferencesStore.getState().globalProgrammingLanguage ?? DEFAULT_PROGRAMMING_LANGUAGE;
}

/** Save the global preference without touching lesson, quiz, or exercise progress. */
export function setProgrammingLanguage(language: ProgrammingLanguage): void {
  usePreferencesStore.getState().setGlobalProgrammingLanguage(language);
}

/** Reactive compatibility hook used by existing Learn pages. */
export function useProgrammingLanguage(): ProgrammingLanguage {
  return usePreferencesStore((state) => state.globalProgrammingLanguage);
}
