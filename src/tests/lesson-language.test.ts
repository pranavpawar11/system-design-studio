import { describe, expect, it } from 'vitest';
import type { Lesson } from '../features/learning/types';
import { getLessonLanguageContent } from '../features/learning/lesson-language';
import objectLesson from '../data/learning/lld/lessons/what-is-an-object.json';
import classLesson from '../data/learning/lld/lessons/what-is-a-class.json';
import stateLesson from '../data/learning/lld/lessons/state-behavior-and-identity.json';
import lifecycleLesson from '../data/learning/lld/lessons/object-lifecycle.json';
import constructorLesson from '../data/learning/lld/lessons/objects-and-classes-constructors-and-initialization.json';

const lessons = [objectLesson, classLesson, stateLesson, lifecycleLesson, constructorLesson] as unknown as Lesson[];

describe('LLD lesson language variants', () => {
  it('provides language-specific examples for all five published lessons', () => {
    for (const lesson of lessons) {
      for (const language of ['cpp', 'java', 'python'] as const) {
        const content = getLessonLanguageContent(lesson, language);
        expect(content.blocks.length).toBe(lesson.blocks.length);
        expect(content.blocks.some((block) => block.type === 'example')).toBe(true);
      }
    }
  });

  it('keeps shared concept blocks when a language only overrides implementation blocks', () => {
    const lesson = lessons.find((item) => item.id === 'what-is-an-object')!;
    const cpp = getLessonLanguageContent(lesson, 'cpp');
    expect(cpp.blocks[0]).toEqual(lesson.blocks[0]);
    expect(cpp.blocks[6]).not.toEqual(lesson.blocks[6]);
    expect(cpp.blocks[6]).toMatchObject({ type: 'example', title: 'BankAccount.hpp' });
  });

  it('provides implementation notes without changing shared quiz or progress identifiers', () => {
    const lesson = lessons.find((item) => item.id === 'object-lifecycle')!;
    expect(getLessonLanguageContent(lesson, 'cpp').implementationNotes.length).toBeGreaterThan(0);
    expect(getLessonLanguageContent(lesson, 'python').implementationNotes.length).toBeGreaterThan(0);
    expect(getLessonLanguageContent(lesson, 'java').implementationNotes.length).toBeGreaterThan(0);
    expect(lesson.quiz?.questions.map((question) => question.id)).toEqual(['q1', 'q2', 'q3']);
  });

  it('keeps shared lesson content as fallback for languages without a variant', () => {
    const lesson = lessons[0];
    const fallback = getLessonLanguageContent(lesson, 'java');
    expect(fallback.blocks[0]).toEqual(lesson.blocks[0]);
  });
});
