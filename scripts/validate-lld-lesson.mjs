#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPPORTED = new Set(['java', 'cpp', 'python']);
const BLOCK_TYPES = new Set(['paragraph', 'heading', 'example', 'list', 'callout', 'formula']);

function fail(errors, message) { errors.push(message); }
function validateBlocks(blocks, label, errors) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    fail(errors, `${label} must be a non-empty array`);
    return;
  }
  blocks.forEach((block, index) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      fail(errors, `${label}[${index}] must be an object`);
      return;
    }
    if (!BLOCK_TYPES.has(block.type)) fail(errors, `${label}[${index}] has unsupported block type: ${String(block.type)}`);
    if (['paragraph', 'heading', 'example', 'callout'].includes(block.type) && typeof block.text !== 'string') {
      fail(errors, `${label}[${index}] (${block.type}) requires text`);
    }
    if (block.type === 'heading' && block.level !== undefined && ![2, 3].includes(block.level)) fail(errors, `${label}[${index}] heading level must be 2 or 3`);
    if (block.type === 'example' && typeof block.title !== 'string') fail(errors, `${label}[${index}] example requires title`);
    if (block.type === 'callout' && !['info', 'tip', 'warning'].includes(block.tone)) fail(errors, `${label}[${index}] callout tone must be info, tip, or warning`);
    if (block.type === 'formula' && typeof block.expression !== 'string') fail(errors, `${label}[${index}] formula requires expression`);
    if (block.type === 'list' && (!Array.isArray(block.items) || block.items.some((item) => typeof item !== 'string'))) {
      fail(errors, `${label}[${index}] list requires string items`);
    }
  });
}

export function validateLesson(lesson) {
  const errors = [];
  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) return ['lesson must be a JSON object'];
  for (const key of ['id', 'title', 'summary']) if (typeof lesson[key] !== 'string' || !lesson[key].trim()) fail(errors, `${key} must be a non-empty string`);
  if (typeof lesson.minutes !== 'number' || lesson.minutes <= 0) fail(errors, 'minutes must be a positive number');
  validateBlocks(lesson.blocks, 'blocks', errors);

  if (lesson.quiz !== undefined) {
    if (!lesson.quiz || !Array.isArray(lesson.quiz.questions)) fail(errors, 'quiz.questions must be an array');
    else {
      const questionIds = new Set();
      lesson.quiz.questions.forEach((q, index) => {
        if (!q || typeof q !== 'object') return fail(errors, `quiz.questions[${index}] must be an object`);
        if (typeof q.id !== 'string' || !q.id) fail(errors, `quiz.questions[${index}] requires id`);
        else if (questionIds.has(q.id)) fail(errors, `duplicate quiz question id: ${q.id}`);
        else questionIds.add(q.id);
        if (typeof q.prompt !== 'string' || !q.prompt) fail(errors, `quiz.questions[${index}] requires prompt`);
        if (!Array.isArray(q.options) || q.options.length < 2) fail(errors, `quiz.questions[${index}] requires at least two options`);
        else {
          const optionIds = new Set(q.options.map((option) => option?.id));
          if (optionIds.size !== q.options.length || optionIds.has(undefined)) fail(errors, `quiz.questions[${index}] option IDs must be present and unique`);
          if (!q.options.some((option) => option.id === q.correct)) fail(errors, `quiz.questions[${index}] correct must match an option id`);
        }
      });
    }
  }

  if (lesson.languageVariants !== undefined) {
    if (!lesson.languageVariants || typeof lesson.languageVariants !== 'object' || Array.isArray(lesson.languageVariants)) {
      fail(errors, 'languageVariants must be an object keyed by language');
    } else {
      for (const [language, variant] of Object.entries(lesson.languageVariants)) {
        if (!SUPPORTED.has(language)) fail(errors, `unsupported language variant: ${language}`);
        if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
          fail(errors, `languageVariants.${language} must be an object`);
          continue;
        }
        if (variant.summary !== undefined && typeof variant.summary !== 'string') fail(errors, `${language}.summary must be a string`);
        if (variant.blocks !== undefined) validateBlocks(variant.blocks, `${language}.blocks`, errors);
        if (variant.blockOverrides !== undefined) {
          if (!variant.blockOverrides || typeof variant.blockOverrides !== 'object' || Array.isArray(variant.blockOverrides)) {
            fail(errors, `${language}.blockOverrides must be an object keyed by shared block index`);
          } else {
            for (const [indexText, block] of Object.entries(variant.blockOverrides)) {
              const index = Number(indexText);
              if (!Number.isInteger(index) || index < 0 || index >= (lesson.blocks?.length ?? 0)) {
                fail(errors, `${language}.blockOverrides key ${indexText} is outside shared blocks`);
                continue;
              }
              validateBlocks([block], `${language}.blockOverrides.${indexText}`, errors);
            }
          }
        }
        if (variant.implementationNotes !== undefined) {
          if (!Array.isArray(variant.implementationNotes)) fail(errors, `${language}.implementationNotes must be an array`);
          else if (variant.implementationNotes.length > 0) validateBlocks(variant.implementationNotes, `${language}.implementationNotes`, errors);
        }
      }
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/validate-lld-lesson.mjs <lesson.json>');
    process.exit(2);
  }
  try {
    const lesson = JSON.parse(fs.readFileSync(file, 'utf8'));
    const errors = validateLesson(lesson);
    if (errors.length) {
      console.error(`Invalid LLD lesson: ${file}`);
      errors.forEach((error) => console.error(`- ${error}`));
      process.exit(1);
    }
    console.log(`Valid LLD lesson: ${file}`);
  } catch (error) {
    console.error(`Unable to validate ${file}: ${error.message}`);
    process.exit(1);
  }
}
