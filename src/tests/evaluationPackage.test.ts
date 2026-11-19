import { describe, expect, it } from 'vitest';
import rawSpec from '../data/questions/url-shortener.json';
import { parseQuestion } from '../features/questions/questionLoader';
import {
  evaluateDeclarativePackage,
  validateEvaluationPackage,
  type EvaluationPackage,
} from '../features/evaluation/evaluationPackage';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';

const spec = parseQuestion(rawSpec);
const validPackage: EvaluationPackage = {
  schemaVersion: 1,
  questionId: spec.question.id,
  questionVersion: spec.question.version,
  packageVersion: '1.0.0',
  rules: [{
    id: 'URL-CACHE-REQUIRED',
    title: 'Cache is present',
    description: 'The design should include a cache component.',
    severity: 'warning',
    checks: [{ type: 'component_exists', componentId: 'COMP-CACHE' }],
  }],
};

describe('declarative evaluation packages', () => {
  it('accepts a package whose question and catalogue references match', () => {
    expect(validateEvaluationPackage(spec, validPackage)).toEqual([]);
  });

  it('rejects a package for another question version', () => {
    const invalid = { ...validPackage, questionVersion: spec.question.version + 1 };
    expect(validateEvaluationPackage(spec, invalid).some((issue) => issue.path === 'questionVersion')).toBe(true);
  });

  it('rejects unknown component and connection references and unsupported checks', () => {
    const invalid = {
      ...validPackage,
      rules: [{
        ...validPackage.rules[0],
        checks: [
          { type: 'component_exists', componentId: 'COMP-NOT-IN-CATALOGUE' },
          { type: 'future_magic_rule' },
        ],
      }],
    };
    const issues = validateEvaluationPackage(spec, invalid);
    expect(issues.some((issue) => issue.message.includes('Unknown component'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('Unsupported'))).toBe(true);
  });

  it('executes declarative checks through the shared requirement evaluator', () => {
    const doc: ArchitectureDocument = {
      schemaVersion: 1,
      questionId: spec.question.id,
      questionVersion: spec.question.version,
      nodes: [],
      edges: [],
    };
    const report = evaluateDeclarativePackage(spec, doc, validPackage);
    expect(report.questionId).toBe(spec.question.id);
    expect(report.requirements).toEqual([expect.objectContaining({
      requirementId: 'URL-CACHE-REQUIRED',
      status: 'fail',
    })]);
    expect(report.engineVersion).toBe('declarative-1.0.0');
  });


  it('validates and executes question-owned capacity and failure models', () => {
    const packageWithAnalysis: EvaluationPackage = {
      ...validPackage,
      capacityTargets: [{
        id: 'APP-CAPACITY', title: 'Application throughput', componentId: 'COMP-APP-SERVER',
        model: { kind: 'instances', instancesConfig: 'instances', perInstanceCapacityConfig: 'capacityPerInstanceRps', load: 5000, unit: 'req/s' },
      }],
      failureScenarios: [{
        id: 'APP-OUTAGE', title: 'Application node outage', failedComponentIds: ['COMP-APP-SERVER'],
        probes: [{ id: 'READ-PATH', title: 'Client to database path', sourceComponentId: 'COMP-CLIENT', targetComponentId: 'COMP-SQL-DATABASE' }],
      }],
    };
    expect(validateEvaluationPackage(spec, packageWithAnalysis)).toEqual([]);
    const doc: ArchitectureDocument = {
      schemaVersion: 1, questionId: spec.question.id, questionVersion: spec.question.version,
      nodes: [
        { id: 'client', componentId: 'COMP-CLIENT', componentType: 'client', name: 'Client', position: { x: 0, y: 0 }, config: {} },
        { id: 'app', componentId: 'COMP-APP-SERVER', componentType: 'application-server', name: 'Application Server', position: { x: 1, y: 0 }, config: { instances: 2, capacityPerInstanceRps: 3000 } },
        { id: 'db', componentId: 'COMP-SQL-DATABASE', componentType: 'sql-database', name: 'Database', position: { x: 2, y: 0 }, config: {} },
      ],
      edges: [{ id: 'e1', source: 'client', target: 'app', connectionTypeId: 'EDGE-SYNC' }, { id: 'e2', source: 'app', target: 'db', connectionTypeId: 'EDGE-SYNC' }],
    };
    const report = evaluateDeclarativePackage(spec, doc, packageWithAnalysis);
    expect(report.capacityAnalysis?.rows[0]).toEqual(expect.objectContaining({ status: 'high', load: 5000, capacity: 6000 }));
    expect(report.failureAnalysis?.scenarios).toHaveLength(1);
    expect(report.findings.some((finding) => finding.ruleId === 'CAPACITY-APP-CAPACITY')).toBe(true);
  });

  it('does not execute invalid packages', () => {
    const invalid = { ...validPackage, rules: [] };
    const doc: ArchitectureDocument = {
      schemaVersion: 1,
      questionId: spec.question.id,
      questionVersion: spec.question.version,
      nodes: [],
      edges: [],
    };
    expect(() => evaluateDeclarativePackage(spec, doc, invalid)).toThrow(/Invalid evaluation package/);
  });
});
