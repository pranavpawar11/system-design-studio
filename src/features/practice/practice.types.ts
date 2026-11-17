import type { ProgrammingLanguage } from '../preferences/preferences.types';

export type PracticeMode = 'guided-design' | 'independent-design' | 'machine-coding' | 'change-request';
export type PracticeAttemptStatus = 'draft' | 'submitted' | 'evaluated';

export interface PracticeExerciseConfig {
  id: string;
  allowedLanguages: ProgrammingLanguage[];
  defaultLanguage?: ProgrammingLanguage;
  allowLanguageOverride: boolean;
  execution: {
    mode: 'not-required' | 'required';
    providerKey?: string;
  };
}

export interface PracticeCodeFile {
  path: string;
  content: string;
  language: ProgrammingLanguage;
  updatedAt: string;
}

export interface PracticeDraft {
  exerciseId: string;
  languageOverride?: ProgrammingLanguage;
  activeFilePath: string;
  files: PracticeCodeFile[];
  updatedAt: string;
}

export interface PracticeAttempt {
  id: string;
  exerciseId: string;
  language: ProgrammingLanguage;
  status: PracticeAttemptStatus;
  createdAt: string;
  submittedAt?: string;
  sourceSnapshot: PracticeCodeFile[];
  executionId?: string;
}

export interface PracticeStateSnapshot {
  version: 1;
  selectedExerciseId: string | null;
  drafts: Record<string, PracticeDraft>;
  attempts: Record<string, PracticeAttempt[]>;
}

export const PRACTICE_STORAGE_KEY = 'hld-studio:practice-state:v1';
