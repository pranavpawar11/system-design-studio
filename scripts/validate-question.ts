/* Usage: npm run validate:question -- src/data/questions/my-question.json [--learning file] [--ext file] [--publish] */
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { lintQuestion } from '../src/features/authoring/lintQuestion';
import { mergeExtensions, parseQuestion } from '../src/features/questions/questionLoader';

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const file = args.find((a, i) => !a.startsWith('--') && !['--learning', '--ext'].includes(args[i - 1] ?? ''));
if (!file) { console.error('Usage: npm run validate:question -- <question.json> [--learning f] [--ext f] [--publish]'); process.exit(2); }

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8').replace(/^\s*```json\s*|\s*```\s*$/g, ''));
const stem = join(dirname(file), basename(file, '.json'));
const learningPath = flag('--learning') ?? (existsSync(`${stem}.learning.json`) ? `${stem}.learning.json` : null);
const extPath = flag('--ext') ?? (existsSync(`${stem}.extensions.json`) ? `${stem}.extensions.json` : null);

let spec: unknown;
try { spec = read(file); } catch (e) { console.error(`✗ ${file} is not valid JSON: ${(e as Error).message}`); process.exit(1); }
try { spec = extPath ? mergeExtensions(parseQuestion(spec), read(extPath)) : spec; } catch (e) { console.error(`✗ ${(e as Error).message}`); process.exit(1); }
const issues = lintQuestion(spec, learningPath ? read(learningPath) : null, { publish: args.includes('--publish') });

console.log(`Checked ${file}${learningPath ? ` + ${learningPath}` : ' (no learning file)'}${extPath ? ` + ${extPath}` : ''}${args.includes('--publish') ? ' [publish mode]' : ''}`);
for (const i of issues) console.log(`${i.level === 'error' ? '✗ error  ' : '⚠ warning'}  ${i.where}: ${i.message}`);
const errors = issues.filter((i) => i.level === 'error').length;
console.log(errors ? `\n${errors} error(s), ${issues.length - errors} warning(s). Fix the errors before adding this question.` : `\n✓ No errors${issues.length ? `, ${issues.length} warning(s)` : ''}.`);
process.exit(errors ? 1 : 0);
