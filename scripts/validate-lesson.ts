/* Usage: npm run validate:lesson -- src/data/learning/lessons/<id>.json [--publish] [--no-roadmap] */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lintLesson } from '../src/features/authoring/lintLesson';

const args = process.argv.slice(2); const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('Usage: npm run validate:lesson -- <lesson.json> [--publish] [--no-roadmap]'); process.exit(2); }
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
let lesson: unknown; try { lesson = read(file); } catch (e) { console.error(`✗ ${file} is not valid JSON: ${(e as Error).message}`); process.exit(1); }
const roadmapPath = join('src/data/learning/roadmap.json');
const roadmap = args.includes('--no-roadmap') || !existsSync(roadmapPath) ? undefined : read(roadmapPath);
const qdir = 'src/data/questions';
const questionIds = readdirSync(qdir).filter((f) => /^(?!.*\.(learning|extensions)\.json$).*\.json$/.test(f)).map((f) => read(join(qdir, f))?.question?.id).filter(Boolean);

const issues = lintLesson(lesson, { roadmap, questionIds, publish: args.includes('--publish') });
console.log(`Checked ${file}${roadmap ? ' against the roadmap' : ''}${args.includes('--publish') ? ' [publish mode]' : ''}`);
for (const i of issues) console.log(`${i.level === 'error' ? '✗ error  ' : '⚠ warning'}  ${i.where}: ${i.message}`);
const errors = issues.filter((i) => i.level === 'error').length;
console.log(errors ? `\n${errors} error(s), ${issues.length - errors} warning(s).` : `\n✓ No errors${issues.length ? `, ${issues.length} warning(s)` : ''}.`);
process.exit(errors ? 1 : 0);
