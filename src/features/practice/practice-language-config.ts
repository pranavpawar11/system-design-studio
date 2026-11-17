import type { ProgrammingLanguage } from '../preferences/preferences.types';
import type { ExerciseLanguageConfig } from './language-resolution';

export interface LanguageAwareExercise {
  language?: string;
  supportedLanguages?: ProgrammingLanguage[];
  defaultLanguage?: ProgrammingLanguage;
  allowLanguageOverride?: boolean;
}

/**
 * Derive capabilities from authored exercise metadata. Legacy catalogue entries
 * with `language: "Java"` remain Java-only until C++/Python content is actually supplied.
 */
export function getExerciseLanguageConfig(exercise: LanguageAwareExercise): ExerciseLanguageConfig {
  const legacyLanguage = exercise.language?.toLowerCase();
  const legacySupported: ProgrammingLanguage[] =
    legacyLanguage === 'java' ? ['java'] :
    legacyLanguage === 'c++' || legacyLanguage === 'cpp' ? ['cpp'] :
    legacyLanguage === 'python' ? ['python'] : [];
  const allowedLanguages = exercise.supportedLanguages?.length
    ? [...new Set(exercise.supportedLanguages)]
    : legacySupported;
  const defaultLanguage = exercise.defaultLanguage ??
    (legacySupported[0] ?? allowedLanguages[0]);
  return {
    allowedLanguages,
    ...(defaultLanguage ? { defaultLanguage } : {}),
    allowOverride: exercise.allowLanguageOverride === true && allowedLanguages.length > 1,
  };
}
