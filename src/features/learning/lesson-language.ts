import type { Lesson } from './types';
import type { ProgrammingLanguage } from './programming-language';

/** Resolve language-specific material while retaining shared concept content. */
export function getLessonLanguageContent(lesson: Lesson, language: ProgrammingLanguage) {
  const variant = lesson.languageVariants?.[language];
  const blocks = variant?.blocks
    ? variant.blocks
    : lesson.blocks.map((block, index) => variant?.blockOverrides?.[index] ?? block);
  return {
    summary: variant?.summary ?? lesson.summary,
    blocks,
    implementationNotes: variant?.implementationNotes ?? [],
  };
}
