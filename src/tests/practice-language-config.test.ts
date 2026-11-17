import { describe, expect, it } from 'vitest';
import { getExerciseLanguageConfig } from '../features/practice/practice-language-config';

describe('exercise language capabilities', () => {
  it('keeps legacy Java catalogue entries Java-only until variants are authored', () => {
    expect(getExerciseLanguageConfig({ language: 'Java' })).toEqual({
      allowedLanguages: ['java'], defaultLanguage: 'java', allowOverride: false,
    });
  });

  it('enables local overrides only when multiple language variants are declared', () => {
    expect(getExerciseLanguageConfig({
      language: 'Java', supportedLanguages: ['java', 'cpp', 'python'], allowLanguageOverride: true,
    })).toEqual({
      allowedLanguages: ['java', 'cpp', 'python'], defaultLanguage: 'java', allowOverride: true,
    });
  });

  it('does not enable an override for a single supported language', () => {
    expect(getExerciseLanguageConfig({
      supportedLanguages: ['python'], allowLanguageOverride: true,
    }).allowOverride).toBe(false);
  });
});
