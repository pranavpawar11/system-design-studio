import { create } from 'zustand';

export interface EditorSessionState {
  exerciseId: string | null;
  activeFilePath: string | null;
  cursor: { line: number; column: number };
  focused: boolean;
  openExercise(exerciseId: string, activeFilePath: string): void;
  setActiveFile(path: string): void;
  setCursor(line: number, column: number): void;
  setFocused(focused: boolean): void;
  close(): void;
}

/** Ephemeral editor UI state only. Source files and saved drafts belong to the practice domain. */
export const useEditorStore = create<EditorSessionState>((set) => ({
  exerciseId: null,
  activeFilePath: null,
  cursor: { line: 1, column: 1 },
  focused: false,
  openExercise(exerciseId, activeFilePath) { set({ exerciseId, activeFilePath, cursor: { line: 1, column: 1 }, focused: false }); },
  setActiveFile(activeFilePath) { set({ activeFilePath, cursor: { line: 1, column: 1 } }); },
  setCursor(line, column) { set({ cursor: { line: Math.max(1, line), column: Math.max(1, column) } }); },
  setFocused(focused) { set({ focused }); },
  close() { set({ exerciseId: null, activeFilePath: null, cursor: { line: 1, column: 1 }, focused: false }); },
}));
