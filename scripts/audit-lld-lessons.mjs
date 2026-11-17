#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLesson } from './validate-lld-lesson.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDir = path.resolve(here, '../src/data/learning/lld/lessons');
const dir = path.resolve(process.argv[2] ?? defaultDir);
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort() : [];
if (!files.length) {
  console.error(`No lesson JSON files found in ${dir}`);
  process.exit(2);
}
const stats = { total: files.length, invalid: 0, sharedOnly: 0, javaOnly: 0, partial: 0, fullyMultilingual: 0, placeholders: 0 };
const invalidFiles = [];
const rows = [];
for (const name of files) {
  const full = path.join(dir, name);
  let lesson;
  try { lesson = JSON.parse(fs.readFileSync(full, 'utf8')); }
  catch (error) { stats.invalid++; invalidFiles.push(`${name}: JSON parse error: ${error.message}`); continue; }
  const errors = validateLesson(lesson);
  if (errors.length) { stats.invalid++; invalidFiles.push(`${name}: ${errors.join('; ')}`); }
  const variants = lesson.languageVariants ?? {};
  const meaningful = ['java', 'cpp', 'python'].filter((lang) => {
    const v = variants[lang];
    return v && (Boolean(v.summary) || Boolean(v.blocks?.length) || Object.keys(v.blockOverrides ?? {}).length > 0 || Boolean(v.implementationNotes?.length));
  });
  if (meaningful.length === 0) stats.sharedOnly++;
  else if (meaningful.length === 1 && meaningful[0] === 'java') stats.javaOnly++;
  else if (meaningful.length === 3) stats.fullyMultilingual++;
  else stats.partial++;
  const serialized = JSON.stringify(lesson);
  if (/TODO:|<Lesson title>|<Language-independent/i.test(serialized)) stats.placeholders++;
  rows.push({ file: name, id: lesson.id ?? '', variants: meaningful.join(',') || 'none', placeholder: /TODO:|<Lesson title>|<Language-independent/i.test(serialized) });
}
const report = [
  '# LLD lesson dataset audit', '',
  'Source directory: `src/data/learning/lld/lessons` (resolved from the supplied audit input)',
  `Files scanned: **${stats.total}**`, '',
  '| Measure | Count |', '|---|---:|',
  `| Invalid JSON/schema | ${stats.invalid} |`,
  `| Shared-only (no meaningful variants) | ${stats.sharedOnly} |`,
  `| Java-only | ${stats.javaOnly} |`,
  `| Partially multilingual | ${stats.partial} |`,
  `| Fully multilingual (Java, C++, Python) | ${stats.fullyMultilingual} |`,
  `| Contains starter placeholders | ${stats.placeholders} |`, '',
  '## Interpretation', '',
  '- Shared-only is not automatically a defect: a concept can be language-independent.',
  '- A placeholder lesson is not considered authored or language-covered, even if it contains empty language keys.',
  '- This report classifies the files in the supplied LLD curriculum starter pack; published lessons stored elsewhere must be audited separately.',
  '', '## File-level results', '',
  '| File | Lesson ID | Meaningful variants | Starter placeholder |', '|---|---|---|---|',
  ...rows.map((row) => `| ${row.file} | ${row.id} | ${row.variants} | ${row.placeholder ? 'yes' : 'no'} |`),
  '', '## Validation errors', '',
  ...(invalidFiles.length ? invalidFiles.map((item) => `- ${item}`) : ['None.']), ''
].join('\n');
const output = path.resolve(here, '../docs/lld/LLD_DATASET_AUDIT.md');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, report);
console.log(`Scanned ${stats.total} lessons; ${stats.invalid} invalid; ${stats.placeholders} contain starter placeholders.`);
console.log(`Audit written to ${output}`);
if (stats.invalid) process.exitCode = 1;
