import { describe, expect, it } from 'vitest';
import raw from '../data/questions/url-shortener.json';
import { parseQuestion } from '../features/questions/questionLoader';
import { evaluateRequirements, type RequirementRule } from '../features/evaluation/core/requirementEvaluator';
import type { ArchitectureDocument, ArchNode } from '../features/architecture/architecture.types';

const spec = parseQuestion(raw);
const node = (id: string, componentId: string): ArchNode => {
  const c = spec.componentCatalogue.components.find((x) => x.id === componentId)!;
  return { id, componentId, componentType: c.type, name: c.displayName, position: { x: 0, y: 0 }, config: { ...c.defaultConfig } };
};
const doc = (edges: ArchitectureDocument['edges'] = []): ArchitectureDocument => ({
  schemaVersion: 1, questionId: spec.question.id, questionVersion: 1,
  nodes: [node('client', 'COMP-CLIENT'), node('api', 'COMP-APP-SERVER'), node('db', 'COMP-SQL-DATABASE')],
  edges,
});
const rules: RequirementRule[] = [
  { id: 'R1', title: 'API exists', description: 'The API is required.', checks: [{ type: 'component_exists', componentId: 'COMP-APP-SERVER' }] },
  { id: 'R2', title: 'Durable write path', description: 'The API must write to storage.', checks: [{ type: 'path_exists', sourceComponentId: 'COMP-APP-SERVER', targetComponentId: 'COMP-SQL-DATABASE', connectionTypeIds: ['EDGE-DB-WRITE'] }] },
  { id: 'R3', title: 'Unique mapping', description: 'The database must enforce uniqueness.', checks: [{ type: 'config_equals', componentId: 'COMP-SQL-DATABASE', key: 'uniqueConstraintSupported', value: true }] },
];

describe('evaluateRequirements', () => {
  it('passes requirements with component, path, and config evidence', () => {
    const d = doc([{ id: 'e1', source: 'api', target: 'db', connectionTypeId: 'EDGE-DB-WRITE' }]);
    d.nodes.find((n) => n.id === 'db')!.config.uniqueConstraintSupported = true;
    const result = evaluateRequirements(spec, d, rules);
    expect(result.requirements.map((r) => r.status)).toEqual(['pass', 'pass', 'pass']);
    expect(result.findings).toHaveLength(0);
  });

  it('fails only the unmet requirement and returns actionable evidence', () => {
    const d = doc();
    d.nodes.find((n) => n.id === 'db')!.config.uniqueConstraintSupported = false;
    const result = evaluateRequirements(spec, d, rules);
    expect(result.requirements.map((r) => r.status)).toEqual(['pass', 'fail', 'fail']);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].requirementId).toBe('R2');
    expect(result.findings[0].explanation).toContain('No valid directed path');
  });

  it('rejects an incompatible edge as path evidence', () => {
    const result = evaluateRequirements(spec, doc([
      { id: 'bad', source: 'api', target: 'db', connectionTypeId: 'EDGE-SYNC-HTTP' },
    ]), [rules[1]]);
    expect(result.requirements[0].status).toBe('fail');
    expect(result.findings[0].edgeIds).toEqual([]);
  });

  it('does not mutate the architecture document', () => {
    const d = doc();
    const before = JSON.stringify(d);
    evaluateRequirements(spec, d, rules);
    expect(JSON.stringify(d)).toBe(before);
  });
});
