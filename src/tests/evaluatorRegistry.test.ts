import { describe, expect, it } from 'vitest';
import urlSpecRaw from '../data/questions/url-shortener.json';
import rateSpecRaw from '../data/questions/rate-limiter.json';
import pollSpecRaw from '../data/questions/voting-poll.json';
import pollSolved from './fixtures/voting-poll-solved.json';
import { parseQuestion } from '../features/questions/questionLoader';
import { evaluate } from '../features/evaluation/evaluator';
import { getEvaluator } from '../features/evaluation/evaluatorRegistry';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';

const urlSpec = parseQuestion(urlSpecRaw);
const rateSpec = parseQuestion(rateSpecRaw);
const pollSpec = parseQuestion(pollSpecRaw);
const pollDoc = pollSolved as ArchitectureDocument;

describe('question evaluator registry', () => {
  it('registers only explicit question evaluators', () => {
    expect(getEvaluator('hld-url-shortener-001')).toBeTypeOf('function');
    expect(getEvaluator('hld-rate-limiter-001')).toBeTypeOf('function');
    expect(getEvaluator('hld-polls-001')).toBeTypeOf('function');
    expect(getEvaluator('hld-video-on-demand-001')).toBeUndefined();
  });

  it('evaluates Voting / Poll with its own requirements and no URL Shortener findings', () => {
    const report = evaluate(pollSpec, pollDoc);
    expect(report.requirements.map((r) => r.requirementId)).toEqual(['FR-01', 'FR-02', 'FR-03', 'FR-04', 'NFR-01', 'NFR-02', 'NFR-03']);
    expect(report.requirements.every((r) => r.status === 'pass')).toBe(true);
    expect(report.findings.some((f) => /URL|redirect|short.?code|mapping/i.test(`${f.title} ${f.explanation}`))).toBe(false);
  });

  it('detects a broken Poll async path as a Poll-specific failure', () => {
    const broken: ArchitectureDocument = { ...pollDoc, edges: pollDoc.edges.filter((e) => e.connectionTypeId !== 'EDGE-ASYNC-PUBLISH') };
    const report = evaluate(pollSpec, broken);
    expect(report.requirements.find((r) => r.requirementId === 'FR-02')?.status).toBe('fail');
    expect(report.findings.some((f) => f.ruleId === 'RULE-POLL-FR-02')).toBe(true);
    expect(report.findings.some((f) => f.ruleId === 'RULE-FR-01')).toBe(false);
  });

  it('keeps URL Shortener and Rate Limiter dispatch explicit', () => {
    const emptyDoc: ArchitectureDocument = { schemaVersion: 1, questionId: urlSpec.question.id, questionVersion: 1, nodes: [], edges: [] };
    expect(evaluate(urlSpec, emptyDoc).findings.some((f) => f.ruleId === 'RULE-FR-01')).toBe(true);
    const rateDoc = { ...emptyDoc, questionId: rateSpec.question.id };
    expect(evaluate(rateSpec, rateDoc).findings.some((f) => f.ruleId.startsWith('RULE-RL-'))).toBe(true);
  });

  it('does not fall back to URL Shortener for an unregistered question', () => {
    const unknown = { ...urlSpec, question: { ...urlSpec.question, id: 'hld-unregistered-999' } };
    const report = evaluate(unknown, { ...pollDoc, questionId: 'hld-unregistered-999' });
    expect(report.requirements).toHaveLength(0);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].ruleId).toBe('RULE-EVALUATOR-UNSUPPORTED');
    expect(report.findings[0].severity).toBe('not-evaluated');
  });
});
