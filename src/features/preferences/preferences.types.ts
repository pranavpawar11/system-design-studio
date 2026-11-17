/** Programming languages supported by language-aware learning and practice surfaces. */
export type ProgrammingLanguage = 'cpp' | 'java' | 'python';

export interface ProgrammingLanguageOption {
  id: ProgrammingLanguage;
  label: string;
  shortLabel: string;
  fileExtension: string;
}

/** Persisted, account/device-level preferences. Keep exercise overrides out of this model. */
export interface UserPreferences {
  globalProgrammingLanguage: ProgrammingLanguage;
}

export const DEFAULT_PROGRAMMING_LANGUAGE: ProgrammingLanguage = 'java';
export const DEFAULT_USER_PREFERENCES: Readonly<UserPreferences> = {
  globalProgrammingLanguage: DEFAULT_PROGRAMMING_LANGUAGE,
};

export const PROGRAMMING_LANGUAGES: ReadonlyArray<ProgrammingLanguageOption> = [
  { id: 'cpp', label: 'C++', shortLabel: 'C++', fileExtension: 'cpp' },
  { id: 'java', label: 'Java', shortLabel: 'Java', fileExtension: 'java' },
  { id: 'python', label: 'Python', shortLabel: 'Python', fileExtension: 'py' },
];

export function isProgrammingLanguage(value: unknown): value is ProgrammingLanguage {
  return value === 'cpp' || value === 'java' || value === 'python';
}
