import { describe, expect, it } from 'vitest';
import urlSpecRaw from '../data/questions/url-shortener.json';
import rateSpecRaw from '../data/questions/rate-limiter.json';
import pollSpecRaw from '../data/questions/voting-poll.json';
import pollSolved from './fixtures/voting-poll-solved.json';
import { parseQuestion } from '../features/questions/questionLoader';
import { evaluate } from '../features/evaluation/evaluator';
import { getEvaluator, runQuestionEvaluation } from '../features/evaluation/evaluatorRegistry';
import type { ArchitectureDocument, ConfigValue } from '../features/architecture/architecture.types';
import type { EvaluationPackage } from '../features/evaluation/evaluationPackage';

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

  it('checks Poll API shared capacity for both vote submissions and result queries', () => {
    const undersizedApi: ArchitectureDocument = {
      ...pollDoc,
      nodes: pollDoc.nodes.map((node) => node.id === 'api'
        ? { ...node, config: { ...node.config, instances: 1, capacityPerInstanceRps: 10 } }
        : node),
    };
    const report = evaluate(pollSpec, undersizedApi);
    expect(report.requirements.find((r) => r.requirementId === 'NFR-01')?.status).toBe('fail');
    expect(report.requirements.find((r) => r.requirementId === 'NFR-02')?.status).toBe('fail');
    expect(report.findings.some((f) => f.ruleId === 'RULE-POLL-NFR-01' && /Poll API: 10 req\/s capacity is below 15,000 req\/s/.test(f.explanation))).toBe(true);
    expect(report.findings.some((f) => f.ruleId === 'RULE-POLL-NFR-02' && /Poll API/.test(f.explanation))).toBe(true);
  });

  it('does not mistake queue arrival rate for queue ingress capacity', () => {
    const unknownIngress: ArchitectureDocument = {
      ...pollDoc,
      nodes: pollDoc.nodes.map((node) => {
        if (node.id !== 'queue') return node;
        const config: Record<string, ConfigValue> = { ...node.config, arrivalRatePerSecond: 5000 };
        delete config.publishCapacityPerSecond;
        return { ...node, config };
      }),
    };
    const report = evaluate(pollSpec, unknownIngress);
    expect(report.requirements.find((r) => r.requirementId === 'NFR-01')?.status).toBe('not-evaluated');
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

  it('uses one serializable central input and adds portable report metadata', () => {
    const doc: ArchitectureDocument = { schemaVersion: 1, questionId: pollSpec.question.id, questionVersion: pollSpec.question.version, nodes: [], edges: [] };
    const report = runQuestionEvaluation({ spec: pollSpec, doc });
    expect(report.schemaVersion).toBe(1);
    expect(report.engineVersion).toBeTypeOf('string');
    expect(report.questionId).toBe(pollSpec.question.id);
    expect(report.questionVersion).toBe(pollSpec.question.version);
  });


  it('runs custom and declarative evaluation together for the same question', () => {
    const packageForPoll: EvaluationPackage = {
      schemaVersion: 1,
      questionId: pollSpec.question.id,
      questionVersion: pollSpec.question.version,
      packageVersion: '1.0.0',
      rules: [{
        id: 'POLL-CUSTOM-CACHE-CHECK',
        title: 'Cache is present',
        description: 'A cache component is included in the design.',
        checks: [{ type: 'component_exists', componentId: 'COMP-COUNTER-STORE' }],
      }],
    };
    const report = runQuestionEvaluation({ spec: pollSpec, doc: pollDoc, evaluationPackage: packageForPoll });
    expect(report.requirements.some((item) => item.requirementId === 'custom:FR-01')).toBe(true);
    expect(report.requirements.some((item) => item.requirementId === 'package:POLL-CUSTOM-CACHE-CHECK')).toBe(true);
    expect(report.findings.every((finding, index, all) => all.findIndex((other) => other.id === finding.id) === index)).toBe(true);
  });

  it('does not fall back to URL Shortener for an unregistered question', () => {
    const unknown = { ...urlSpec, question: { ...urlSpec.question, id: 'hld-unregistered-999' } };
    const report = evaluate(unknown, { ...pollDoc, questionId: 'hld-unregistered-999' });
    expect(report.requirements.length).toBeGreaterThan(0);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].ruleId).toBe('RULE-EVALUATOR-UNSUPPORTED');
    expect(report.findings[0].severity).toBe('not-evaluated');
    expect(report.requirements.length).toBeGreaterThan(0);
    expect(report.requirements.every((r) => r.status === 'not-evaluated')).toBe(true);
    expect(report.questionId).toBe('hld-unregistered-999');
  });
});
