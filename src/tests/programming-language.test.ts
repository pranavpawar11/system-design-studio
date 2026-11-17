import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PROGRAMMING_LANGUAGE,
  PROGRAMMING_LANGUAGE_STORAGE_KEY,
  getProgrammingLanguage,
  setProgrammingLanguage,
} from '../features/learning/programming-language';
import { usePreferencesStore } from '../features/preferences/preferences.store';
import { getLessonLanguageContent } from '../features/learning/lesson-language';
import type { Lesson } from '../features/learning/types';

const lesson: Lesson = {
  id: 'sample',
  title: 'Sample lesson',
  summary: 'Shared summary',
  minutes: 5,
  blocks: [{ type: 'paragraph', text: 'Shared explanation' }],
  languageVariants: {
    cpp: {
      summary: 'C++ summary',
      blocks: [{ type: 'example', title: 'C++ example', text: 'int main() {}' }],
    },
  },
};

afterEach(() => {
  window.localStorage.clear();
  usePreferencesStore.setState({ globalProgrammingLanguage: DEFAULT_PROGRAMMING_LANGUAGE });
  vi.restoreAllMocks();
});

describe('programming language preference', () => {
  it('defaults to Java for existing learners', () => {
    expect(getProgrammingLanguage()).toBe(DEFAULT_PROGRAMMING_LANGUAGE);
  });

  it('persists a valid language selection', () => {
    setProgrammingLanguage('python');
    expect(JSON.parse(window.localStorage.getItem(PROGRAMMING_LANGUAGE_STORAGE_KEY) ?? '{}')).toEqual({ globalProgrammingLanguage: 'python' });
    expect(getProgrammingLanguage()).toBe('python');
  });

  it('exposes the platform default after preferences are reset', () => {
    usePreferencesStore.getState().setGlobalProgrammingLanguage('python');
    usePreferencesStore.getState().resetPreferences();
    expect(getProgrammingLanguage()).toBe(DEFAULT_PROGRAMMING_LANGUAGE);
  });

  it('notifies subscribers when the selection changes', () => {
    const listener = vi.fn();
    window.addEventListener('hld-studio:programming-language-change', listener);
    setProgrammingLanguage('cpp');
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('hld-studio:programming-language-change', listener);
  });
});

describe('lesson language content', () => {
  it('uses the selected language variant when available', () => {
    const content = getLessonLanguageContent(lesson, 'cpp');
    expect(content.summary).toBe('C++ summary');
    expect(content.blocks[0]).toMatchObject({ type: 'example', title: 'C++ example' });
  });

  it('falls back to shared content when a variant is not authored yet', () => {
    const content = getLessonLanguageContent(lesson, 'python');
    expect(content.summary).toBe('Shared summary');
    expect(content.blocks).toEqual(lesson.blocks);
    expect(content.implementationNotes).toEqual([]);
  });
});
