import { describe, expect, it } from 'vitest';
import urlSpecRaw from '../data/questions/url-shortener.json';
import { parseQuestion } from '../features/questions/questionLoader';
import { runQuestionEvaluation } from '../features/evaluation/evaluatorRegistry';
import type { EvaluationPackage } from '../features/evaluation/evaluationPackage';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';

const urlSpec = parseQuestion(urlSpecRaw);

const declarativePackage = (questionId: string, questionVersion: number): EvaluationPackage => ({
  schemaVersion: 1,
  questionId,
  questionVersion,
  packageVersion: '1.0.0',
  rules: [{
    id: 'CACHE-PRESENT',
    title: 'Cache component is present',
    description: 'The design must contain a cache.',
    checks: [{ type: 'component_exists', componentId: 'COMP-CACHE' }],
  }],
});

const emptyDoc = (questionId: string, questionVersion: number): ArchitectureDocument => ({
  schemaVersion: 1,
  questionId,
  questionVersion,
  nodes: [],
  edges: [],
});

describe('central evaluation runtime with declarative packages', () => {
  it('uses a declarative package when no custom evaluator is registered', () => {
    const spec = {
      ...urlSpec,
      question: { ...urlSpec.question, id: 'hld-declarative-test-001' },
    };
    const report = runQuestionEvaluation({
      spec,
      doc: emptyDoc(spec.question.id, spec.question.version),
      evaluationPackage: declarativePackage(spec.question.id, spec.question.version),
    });

    expect(report.questionId).toBe(spec.question.id);
    expect(report.engineVersion).toBe('declarative-1.0.0');
    expect(report.requirements).toEqual([
      expect.objectContaining({ requirementId: 'CACHE-PRESENT', status: 'fail' }),
    ]);
  });

  it('runs a registered domain-specific plugin alongside an optional declarative package', () => {
    const report = runQuestionEvaluation({
      spec: urlSpec,
      doc: emptyDoc(urlSpec.question.id, urlSpec.question.version),
      evaluationPackage: declarativePackage(urlSpec.question.id, urlSpec.question.version),
    });

    expect(report.engineVersion).toBe('1.0.0');
    expect(report.requirements.some((item) => item.requirementId === 'custom:FR-01')).toBe(true);
    expect(report.requirements.some((item) => item.requirementId === 'package:CACHE-PRESENT')).toBe(true);
  });

  it('rejects a declarative package that belongs to another question', () => {
    const spec = {
      ...urlSpec,
      question: { ...urlSpec.question, id: 'hld-declarative-test-002' },
    };
    expect(() => runQuestionEvaluation({
      spec,
      doc: emptyDoc(spec.question.id, spec.question.version),
      evaluationPackage: declarativePackage('another-question', spec.question.version),
    })).toThrow(/questionId/);
  });

  it('keeps unsupported questions explicitly not evaluated when no package is supplied', () => {
    const spec = {
      ...urlSpec,
      question: { ...urlSpec.question, id: 'hld-no-evaluator-001' },
    };
    const report = runQuestionEvaluation({
      spec,
      doc: emptyDoc(spec.question.id, spec.question.version),
    });
    expect(report.requirements.every((item) => item.status === 'not-evaluated')).toBe(true);
  });
});
