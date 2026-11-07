import { describe, it, expect } from 'vitest';
import spec from '../data/questions/url-shortener.json';
import solved from './fixtures/url-shortener-solved.json';
import { parseQuestion } from '../features/questions/questionLoader';
import { validateDocument } from '../features/architecture/architecture.utils';
import { evaluate } from '../features/evaluation/evaluator';

describe('solved URL shortener design', () => {
  const q = parseQuestion(spec);
  it('imports cleanly and passes every evaluable requirement', () => {
    const r = validateDocument(solved, q);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rep = evaluate(q, r.doc);
    console.log(rep.requirements.map((x) => `${x.requirementId}:${x.status}`).join(' '));
    console.log(rep.findings.map((f) => `${f.severity}:${f.title}`).join('\n'));
    expect(rep.requirements.filter((x) => x.status === 'fail')).toEqual([]);
  });
});

import solved2 from './fixtures/url-shortener-solved-v2.json';
describe('full production-style design', () => {
  const q = parseQuestion(spec);
  it('is valid with replicas, queue/worker analytics, ID allocation and telemetry', () => {
    const r = validateDocument(solved2, q);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rep = evaluate(q, r.doc);
    expect(rep.requirements.filter((x) => x.status === 'fail')).toEqual([]);
    expect(rep.findings.filter((f) => f.severity === 'error' || f.severity === 'warning')).toEqual([]);
  });
});
