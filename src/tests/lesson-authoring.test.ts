import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { lintLesson } from '../features/authoring/lintLesson';
import type { Roadmap } from '../features/learning/types';

const root = process.cwd();
const roadmap = JSON.parse(readFileSync(join(root, 'src/data/learning/roadmap.json'), 'utf8')) as Roadmap;
const T = (f: string) => join(root, 'docs/learning-authoring/templates', f);
const stripComments = (src: string) => src.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => { let ins = false, out = ''; for (let i = 0; i < l.length; i++) { if (l[i] === '"' && l[i - 1] !== '\\') ins = !ins; if (!ins && l.slice(i, i + 2) === '//') break; out += l[i]; } return out; }).join('\n');
const template = () => JSON.parse(readFileSync(T('lesson.template.json'), 'utf8'));
const errors = (l: unknown, ctx = {}) => lintLesson(l, ctx).filter((i) => i.level === 'error').map((i) => `${i.where}: ${i.message}`).join('\n');
const questionIds = ['hld-url-shortener-001', 'hld-rate-limiter-001'];

describe('every shipped lesson meets the publish standard', () => {
  const dir = join(root, 'src/data/learning/lessons');
  for (const f of readdirSync(dir)) it(f, () => {
    const issues = lintLesson(JSON.parse(readFileSync(join(dir, f), 'utf8')), { roadmap, questionIds, publish: true });
    expect(issues.filter((i) => i.level === 'error').map((i) => i.message)).toEqual([]);
    expect(issues.filter((i) => i.level === 'warning').map((i) => i.message)).toEqual([]);   // shipped lessons have no warnings either
  });
});

describe('lesson template', () => {
  it('the commented and plain versions hold the same data', () => { expect(JSON.parse(stripComments(readFileSync(T('lesson.template.jsonc'), 'utf8')))).toEqual(template()); });
  it('is a valid starting point, but publish mode refuses it while TODO remains', () => {
    expect(errors(template(), { questionIds })).toBe('');
    expect(errors(template(), { publish: true })).toMatch(/TODO/);
  });
});

describe('the linter catches the mistakes authors actually make', () => {
  const t = () => template();
  it('a misspelt name in a lab formula', () => { const l = t(); l.lab.derived[0].formula = 'round(load / capacty * 1000) / 1000'; expect(errors(l)).toMatch(/unknown name "capacty"/); });
  it('a task nobody can complete', () => { const l = t(); l.lab.tasks[0].check = 'utilization > 99'; expect(errors(l)).toMatch(/lab task t1.*No setting/); });
  it('a quiz whose correct answer is not an option', () => { const l = t(); l.quiz.questions[0].correct = 'z'; expect(errors(l)).toMatch(/not one of the options/); });
  it('a typo in a field name, and a block of the wrong shape', () => {
    const a = t(); a.block = a.blocks; delete a.blocks; expect(errors(a)).toMatch(/blocks|block/);
    const b = t(); b.blocks[0] = { type: 'paragraph', txt: 'oops' }; expect(errors(b).length).toBeGreaterThan(0);
  });
  it('text that repeats a unit the value already shows', () => {
    const l = t(); l.lab.derived.push({ id: 'lost', label: 'Lost', unit: 'requests', formula: 'load', format: 'integer' }); l.lab.narrative[1].text = 'Working, but {lost} requests are lost, with {lost} a day.';
    const w = lintLesson(l).filter((i) => i.level === 'warning').map((i) => i.message).join('\n');
    expect(w).toMatch(/"\{lost\}" already shows its unit/);
    const ok = t(); ok.lab.narrative[2].text = 'Healthy at {utilization} with {load} going through.'; expect(lintLesson(ok).map((i) => i.message).join()).not.toMatch(/already shows its unit/);
  });
  it('a lesson that disagrees with the roadmap', () => {
    const l = t(); l.id = 'cache-basics'; expect(errors(l, { roadmap })).toMatch(/hasLab is false but the lesson has lab/);
    const l2 = t(); expect(errors(l2, { roadmap })).toMatch(/not on the roadmap/);
    const l3 = t(); l3.id = 'cache-aside'; expect(errors(l3, { roadmap })).toMatch(/still lists "cache-aside" as planned/);
  });
  it('a practice link to a question that does not exist', () => { const l = t(); l.practice[0].questionId = 'hld-ghost-001'; expect(errors(l, { questionIds })).toMatch(/Unknown Studio question/); });
  it('warns about a giveaway quiz answer, an overlong paragraph and a wrong time estimate, without failing', () => {
    const l = t(); l.quiz.questions[0].options[0].text = 'TODO: '.padEnd(120, 'x'); l.blocks[0].text = 'y'.repeat(800); l.minutes = 55;
    const issues = lintLesson(l); expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    const w = issues.map((i) => i.message).join('\n'); expect(w).toMatch(/gives it away/); expect(w).toMatch(/paragraph is long/); expect(w).toMatch(/minutes looks off/);
  });
});
