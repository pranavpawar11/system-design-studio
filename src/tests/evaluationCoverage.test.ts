import { describe, expect, it } from 'vitest';
import urlSpecRaw from '../data/questions/url-shortener.json';
import rateSpecRaw from '../data/questions/rate-limiter.json';
import pollSpecRaw from '../data/questions/voting-poll.json';
import urlPackage from '../data/questions/url-shortener.evaluation.json';
import ratePackage from '../data/questions/rate-limiter.evaluation.json';
import pollPackage from '../data/questions/voting-poll.evaluation.json';
import { parseQuestion } from '../features/questions/questionLoader';
import {
  auditEvaluationCatalogue,
  auditQuestionEvaluationCoverage,
  type EvaluationCoverageInput,
} from '../features/evaluation/evaluationCoverage';

const cases: EvaluationCoverageInput[] = [
  { spec: parseQuestion(urlSpecRaw), evaluationPackage: urlPackage, supportDeclaration: { status: 'supported' } },
  { spec: parseQuestion(rateSpecRaw), evaluationPackage: ratePackage, supportDeclaration: { status: 'supported' } },
  { spec: parseQuestion(pollSpecRaw), evaluationPackage: pollPackage, supportDeclaration: { status: 'supported' } },
];
const completeFixtures = { validDesign: true, invalidDesign: true, alternativeValidDesign: true };

describe('catalogue-wide evaluation coverage gate', () => {
  it('marks a question incomplete when any required coverage declaration is missing', () => {
    const result = auditQuestionEvaluationCoverage(cases[0]);
    expect(result.status).toBe('incomplete');
    expect(result.issues.map((issue) => issue.code)).toContain('MISSING_VALID_FIXTURE');
    expect(result.issues.map((issue) => issue.code)).toContain('MISSING_INVALID_FIXTURE');
    expect(result.issues.map((issue) => issue.code)).toContain('MISSING_ALTERNATIVE_FIXTURE');
  });

  it('marks a fully covered supported question ready', () => {
    const result = auditQuestionEvaluationCoverage({ ...cases[0], fixtures: completeFixtures });
    expect(result.status).toBe('ready');
    expect(result.executable).toBe(true);
    expect(result.metrics).toBe('configured');
    expect(result.fixtures).toBe('complete');
    expect(result.issues).toEqual([]);
  });

  it('requires an explicit reason for an unsupported question', () => {
    const result = auditQuestionEvaluationCoverage({
      ...cases[0],
      supportDeclaration: { status: 'not_supported', reason: '' },
    });
    expect(result.status).toBe('not_supported');
    expect(result.issues.map((issue) => issue.code)).toContain('UNSUPPORTED_WITHOUT_REASON');
  });

  it('does not treat a missing package as supported merely because a custom evaluator exists', () => {
    const result = auditQuestionEvaluationCoverage({
      spec: parseQuestion(urlSpecRaw),
      supportDeclaration: { status: 'supported' },
      fixtures: completeFixtures,
    });
    expect(result.status).toBe('incomplete');
    expect(result.executable).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toContain('MISSING_EVALUATION_PACKAGE');
  });

  it('summarizes catalogue readiness without silently dropping questions', () => {
    const report = auditEvaluationCatalogue(cases.map((item) => ({ ...item, fixtures: completeFixtures })));
    expect(report.total).toBe(3);
    expect(report.ready).toBe(3);
    expect(report.incomplete).toBe(0);
    expect(report.notSupported).toBe(0);
  });

  it('flags a metrics model without a registered provider', () => {
    const invalidPackage = { ...(urlPackage as object), metrics: { ...(urlPackage as any).metrics, modelId: 'missing-provider-v1' } };
    const result = auditQuestionEvaluationCoverage({
      ...cases[0],
      evaluationPackage: invalidPackage,
      fixtures: completeFixtures,
    });
    expect(result.issues.map((issue) => issue.code)).toContain('UNKNOWN_METRICS_PROVIDER');
  });
});
