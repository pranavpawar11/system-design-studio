import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LocalApi } from '../api/local/LocalApi';
import { lintQuestion } from '../features/authoring/lintQuestion';
import { evaluate, hasEvaluator } from '../features/evaluation/evaluator';
import { parseQuestion, normalizeDifficulty } from '../features/questions/questionLoader';
import { registerCatalogue, categoryOf, iconOf } from '../components/layout/componentMeta';

const T = (f: string) => join(process.cwd(), 'docs/question-authoring/templates', f);
const json = (f: string) => JSON.parse(readFileSync(T(f), 'utf8'));
const stripComments = (src: string) => src.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => { let ins = false, out = ''; for (let i = 0; i < l.length; i++) { if (l[i] === '"' && l[i - 1] !== '\\') ins = !ins; if (!ins && l.slice(i, i + 2) === '//') break; out += l[i]; } return out; }).join('\n');
const errors = (spec: unknown, learning: unknown = null, publish = false) => lintQuestion(spec, learning, { publish }).filter((i) => i.level === 'error').map((i) => `${i.where}: ${i.message}`);
const clone = <T,>(x: T): T => structuredClone(x);

describe('every bundled question meets the publish standard it teaches', () => {
  it('has a brief, scope, objectives, 5 hints and a learning file (evaluator and TODO rules aside)', async () => {
    const api = new LocalApi();
    for (const { id } of await api.listQuestions()) {
      const e = lintQuestion(await api.getQuestion(id), await api.getLearning(id), { publish: true }).filter((i) => i.level === 'error').map((i) => i.message);
      expect(e, id).toEqual([]);
    }
  });
});

describe('every bundled question passes the linter', () => {
  it('has no errors', async () => {
    const api = new LocalApi();
    for (const { id } of await api.listQuestions()) {
      expect(errors(await api.getQuestion(id), await api.getLearning(id)), id).toEqual([]);
    }
  });
});

describe('templates', () => {
  it('the commented .jsonc and the plain .json hold identical data', () => {
    for (const n of ['question', 'learning']) expect(JSON.parse(stripComments(readFileSync(T(`${n}.template.jsonc`), 'utf8')))).toEqual(json(`${n}.template.json`));
  });
  it('the question and learning templates are valid starting points', () => {
    expect(errors(json('question.template.json'), json('learning.template.json'))).toEqual([]);
  });
  it('publish mode refuses a template that still says TODO and has no evaluator', () => {
    const e = errors(json('question.template.json'), json('learning.template.json'), true).join('\n');
    expect(e).toMatch(/TODO/); expect(e).toMatch(/No evaluator is registered/);
    expect(e).not.toMatch(/at least 3 functional|5 hints|follow-up|reference solution/); // the template already meets the structural counts
  });
  it('every reusable component and connection in the library is itself valid', () => {
    const lib = json('catalogue-library.json'); const spec = clone(json('question.template.json'));
    const comps = lib.components.filter((c: { id: string }) => !c.id.includes('--'));
    spec.componentCatalogue = { allowedComponentIds: comps.map((c: { id: string }) => c.id), components: comps };
    spec.connectionTypes = lib.connectionTypes.filter((c: { id: string }) => !c.id.includes('--'));
    expect(errors(spec)).toEqual([]);
  });
});

describe('the linter catches the mistakes authors actually make', () => {
  const base = () => clone(json('question.template.json'));
  it('duplicate requirement ids', () => { const s = base(); s.requirements.functional[1].id = 'FR-01'; expect(errors(s).join()).toMatch(/FR-01 is used twice/); });
  it('a connection type no component can ever use', () => { const s = base(); s.connectionTypes[0].compatibleTargetOperations = ['teleport']; expect(errors(s).join()).toMatch(/“teleport” is supported by no component/); });
  it('a component allowed but never defined', () => { const s = base(); s.componentCatalogue.allowedComponentIds.push('COMP-GHOST'); expect(errors(s).join()).toMatch(/COMP-GHOST is allowed but never defined/); });
  it('hints out of order', () => { const s = base(); s.hints[2].level = 1; expect(errors(s).join()).toMatch(/Hint levels must increase/); });
  it('a config rule with no default, and a default that breaks its own rule', () => {
    const s = base(); const app = s.componentCatalogue.components[2];
    app.configSchema.ghost = { type: 'number' }; app.defaultConfig.instances = 0;
    const e = errors(s).join('\n'); expect(e).toMatch(/“ghost”/); expect(e).toMatch(/below its minimum/);
  });
  it('malformed ids and an unknown difficulty fail the schema', () => {
    const s = base(); s.question.id = 'My Question'; s.question.difficulty = 'impossible';
    expect(errors(s).length).toBeGreaterThan(0);
  });
  it('a reference design that breaks the connection rules, and advice about an unknown requirement', () => {
    const l = clone(json('learning.template.json'));
    l.referenceSolutions[0].architecture.edges[0].connectionTypeId = 'EDGE-DB-WRITE'; l.revisionRecommendations[0].requirementIds = ['FR-99'];
    const e = errors(base(), l).join('\n'); expect(e).toMatch(/reference REF-01/); expect(e).toMatch(/unknown requirement FR-99/);
  });
});

describe('questions without an evaluator are handled honestly', () => {
  it('reports every requirement as not evaluated instead of judging by another question’s rules', () => {
    const spec = parseQuestion(json('question.template.json'));
    expect(hasEvaluator(spec.question.id)).toBe(false);
    const r = evaluate(spec, json('learning.template.json').referenceSolutions[0].architecture);
    expect(r.requirements).toHaveLength(5);
    expect(r.requirements.every((x) => x.status === 'not-evaluated')).toBe(true);
    expect(r.findings[0].title).toMatch(/No automatic checks/);
  });
});

describe('difficulty vocabulary', () => {
  it('accepts easy, medium, hard and converts the older words', () => {
    expect(['easy', 'medium', 'hard'].map(normalizeDifficulty)).toEqual(['easy', 'medium', 'hard']);
    expect(['beginner', 'Intermediate', 'ADVANCED'].map(normalizeDifficulty)).toEqual(['easy', 'medium', 'hard']);
    const s = json('question.template.json'); s.question.difficulty = 'beginner';
    expect(parseQuestion(s).question.difficulty).toBe('easy');
    s.question.difficulty = 'impossible'; expect(() => parseQuestion(s)).toThrow(/easy, medium or hard/);
  });
});

describe('new component types need no code', () => {
  it('take their colour group and a sensible icon from the category in the question file', () => {
    expect(categoryOf('object-storage')).toBe('Compute');           // unknown before registration
    registerCatalogue([{ type: 'object-storage', category: 'Storage' }]);
    expect(categoryOf('object-storage')).toBe('Storage');
    expect(iconOf('object-storage')).toBe(iconOf('sql-database'));   // storage fallback icon
  });
});

import { evaluateYourTopic } from '../../docs/question-authoring/templates/evaluator.template';
describe('evaluator template', () => {
  const spec = parseQuestion(json('question.template.json'));
  const ref = json('learning.template.json').referenceSolutions[0].architecture;
  const status = (r: ReturnType<typeof evaluateYourTopic>, id: string) => r.requirements.find((x) => x.requirementId === id)?.status;
  it('works on the template question and its reference design', () => {
    const r = evaluateYourTopic(spec, ref);
    expect(['FR-01', 'FR-02', 'NFR-01', 'NFR-02'].map((id) => status(r, id))).toEqual(['pass', 'pass', 'pass', 'pass']);
    expect(status(r, 'FR-03')).toBe('not-evaluated');   // declaration pattern: unverified until the learner declares it
    const rq = json('question.template.json').requirements as { functional: { id: string }[]; nonFunctional: { id: string }[] };
    expect(r.requirements.map((x) => x.requirementId).sort()).toEqual([...rq.functional, ...rq.nonFunctional].map((x) => x.id).sort());
  });
  it('fails the right requirements when the design is broken', () => {
    const broken = structuredClone(ref); broken.edges = broken.edges.filter((e: { connectionTypeId: string }) => e.connectionTypeId !== 'EDGE-DB-WRITE');
    const r = evaluateYourTopic(spec, broken);
    expect(status(r, 'FR-02')).toBe('fail'); expect(status(r, 'NFR-02')).toBe('fail'); expect(status(r, 'FR-01')).toBe('pass');
  });
});
