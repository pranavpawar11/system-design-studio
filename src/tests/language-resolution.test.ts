import { describe, expect, it } from 'vitest';
import { resolveExerciseLanguage } from '../features/practice/language-resolution';

describe('exercise language resolution', () => {
  const allLanguages = { allowedLanguages: ['java', 'cpp', 'python'] as const, allowOverride: true };

  it('uses the global preference when no local override exists', () => {
    expect(resolveExerciseLanguage('java', undefined, allLanguages)).toEqual({ language: 'java', source: 'global-preference' });
  });

  it('uses a valid local override without changing the global preference', () => {
    expect(resolveExerciseLanguage('java', { languageOverride: 'python' }, allLanguages)).toEqual({ language: 'python', source: 'exercise-override' });
  });

  it('ignores local overrides when the exercise disallows them', () => {
    expect(resolveExerciseLanguage('java', { languageOverride: 'python' }, { ...allLanguages, allowOverride: false })).toEqual({ language: 'java', source: 'global-preference' });
  });

  it('falls back to the exercise default when the global language is unsupported', () => {
    expect(resolveExerciseLanguage('python', undefined, { allowedLanguages: ['java'], defaultLanguage: 'java', allowOverride: true })).toEqual({ language: 'java', source: 'exercise-default' });
  });

  it('uses the first supported language when no explicit default exists', () => {
    expect(resolveExerciseLanguage('python', undefined, { allowedLanguages: ['cpp'], allowOverride: true })).toEqual({ language: 'cpp', source: 'exercise-default' });
  });

  it('falls back to the platform default when the exercise has no language restrictions', () => {
    expect(resolveExerciseLanguage('java', undefined, { allowedLanguages: [], allowOverride: true })).toEqual({ language: 'java', source: 'global-preference' });
  });
});
