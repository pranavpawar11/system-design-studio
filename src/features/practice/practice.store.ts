import { create } from 'zustand';
import { practiceRepository, type PracticeRepository } from './practice.repository';
import type { PracticeAttempt, PracticeCodeFile, PracticeDraft, PracticeStateSnapshot } from './practice.types';
import type { ProgrammingLanguage } from '../preferences/preferences.types';

export interface PracticeStoreState extends PracticeStateSnapshot {
  selectExercise(id: string | null): void;
  setLanguageOverride(exerciseId: string, language: ProgrammingLanguage | undefined): void;
  saveDraft(exerciseId: string, input: { files: PracticeCodeFile[]; activeFilePath: string }): void;
  clearDraft(exerciseId: string): void;
  addAttempt(attempt: PracticeAttempt): void;
  clearAttempts(exerciseId: string): void;
}

export function createPracticeStore(repository: PracticeRepository = practiceRepository) {
  const initial = repository.load();
  const persist = (snapshot: PracticeStateSnapshot) => repository.save(snapshot);
  return create<PracticeStoreState>((set, get) => ({
    ...initial,
    selectExercise(id) {
      if (id === get().selectedExerciseId) return;
      const next = { ...get(), selectedExerciseId: id };
      set({ selectedExerciseId: id });
      persist({ version: 1, selectedExerciseId: id, drafts: next.drafts, attempts: next.attempts });
    },
    setLanguageOverride(exerciseId, language) {
      const state = get();
      const existing = state.drafts[exerciseId] ?? { exerciseId, activeFilePath: '', files: [], updatedAt: new Date().toISOString() };
      const draft: PracticeDraft = { ...existing, ...(language ? { languageOverride: language } : { languageOverride: undefined }), updatedAt: new Date().toISOString() };
      const drafts = { ...state.drafts, [exerciseId]: draft };
      set({ drafts });
      persist({ version: 1, selectedExerciseId: state.selectedExerciseId, drafts, attempts: state.attempts });
    },
    saveDraft(exerciseId, input) {
      const state = get();
      const existing = state.drafts[exerciseId];
      const draft: PracticeDraft = {
        exerciseId,
        ...(existing?.languageOverride ? { languageOverride: existing.languageOverride } : {}),
        activeFilePath: input.files.some((file) => file.path === input.activeFilePath) ? input.activeFilePath : (input.files[0]?.path ?? ''),
        files: input.files,
        updatedAt: new Date().toISOString(),
      };
      const drafts = { ...state.drafts, [exerciseId]: draft };
      set({ drafts });
      persist({ version: 1, selectedExerciseId: state.selectedExerciseId, drafts, attempts: state.attempts });
    },
    clearDraft(exerciseId) {
      const state = get(); const drafts = { ...state.drafts }; delete drafts[exerciseId];
      set({ drafts }); persist({ version: 1, selectedExerciseId: state.selectedExerciseId, drafts, attempts: state.attempts });
    },
    addAttempt(attempt) {
      const state = get(); const attempts = { ...state.attempts, [attempt.exerciseId]: [...(state.attempts[attempt.exerciseId] ?? []), attempt] };
      set({ attempts }); persist({ version: 1, selectedExerciseId: state.selectedExerciseId, drafts: state.drafts, attempts });
    },
    clearAttempts(exerciseId) {
      const state = get(); const attempts = { ...state.attempts }; delete attempts[exerciseId];
      set({ attempts }); persist({ version: 1, selectedExerciseId: state.selectedExerciseId, drafts: state.drafts, attempts });
    },
  }));
}

export const usePracticeStore = createPracticeStore();
