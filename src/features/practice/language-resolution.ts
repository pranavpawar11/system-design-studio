import {
  DEFAULT_PROGRAMMING_LANGUAGE,
  type ProgrammingLanguage,
} from '../preferences/preferences.types';

/** Language capabilities declared by one coding exercise. */
export interface ExerciseLanguageConfig {
  allowedLanguages: readonly ProgrammingLanguage[];
  /** Used only when the global preference is not supported by this exercise. */
  defaultLanguage?: ProgrammingLanguage;
  allowOverride: boolean;
}

export interface ExerciseLanguageSelection {
  /** Persist this on the exercise attempt/progress record, never in global preferences. */
  languageOverride?: ProgrammingLanguage;
}

export interface ResolvedExerciseLanguage {
  language: ProgrammingLanguage;
  source: 'exercise-override' | 'global-preference' | 'exercise-default' | 'platform-default';
}

/**
 * Resolve the effective language in a deterministic order:
 * valid local override -> supported global preference -> supported exercise default
 * -> first supported language -> platform default.
 */
export function resolveExerciseLanguage(
  globalLanguage: ProgrammingLanguage,
  selection: ExerciseLanguageSelection | undefined,
  config: ExerciseLanguageConfig,
): ResolvedExerciseLanguage {
  const allowed = config.allowedLanguages;
  const supports = (language: ProgrammingLanguage) => allowed.length === 0 || allowed.includes(language);

  if (config.allowOverride && selection?.languageOverride && supports(selection.languageOverride)) {
    return { language: selection.languageOverride, source: 'exercise-override' };
  }
  if (supports(globalLanguage)) return { language: globalLanguage, source: 'global-preference' };
  if (config.defaultLanguage && supports(config.defaultLanguage)) {
    return { language: config.defaultLanguage, source: 'exercise-default' };
  }
  if (allowed.length > 0) return { language: allowed[0], source: 'exercise-default' };
  return { language: DEFAULT_PROGRAMMING_LANGUAGE, source: 'platform-default' };
}
