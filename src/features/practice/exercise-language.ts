import { usePreferencesStore } from '../preferences/preferences.store';
import type { ProgrammingLanguage } from '../preferences/preferences.types';
import { resolveExerciseLanguage, type ExerciseLanguageConfig, type ExerciseLanguageSelection } from './language-resolution';
import { usePracticeStore } from './practice.store';

export function getEffectiveExerciseLanguage(exerciseId: string, config: ExerciseLanguageConfig) {
  const globalLanguage = usePreferencesStore.getState().globalProgrammingLanguage;
  const draft = usePracticeStore.getState().drafts[exerciseId];
  const selection: ExerciseLanguageSelection | undefined = draft?.languageOverride
    ? { languageOverride: draft.languageOverride }
    : undefined;
  return resolveExerciseLanguage(globalLanguage, selection, config);
}

export function setExerciseLanguageOverride(exerciseId: string, language: ProgrammingLanguage | undefined, config: ExerciseLanguageConfig): void {
  if (language && (!config.allowOverride || (config.allowedLanguages.length > 0 && !config.allowedLanguages.includes(language)))) return;
  usePracticeStore.getState().setLanguageOverride(exerciseId, language);
}
