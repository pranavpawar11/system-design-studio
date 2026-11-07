import { describe, expect, it } from 'vitest';
import raw from '../data/questions/url-shortener.json';
import { parseQuestion } from '../features/questions/questionLoader';
import { analyzeFailureScenarios, type FailureScenario } from '../features/evaluation/core/failureScenarioAnalyzer';
import type { ArchitectureDocument, ArchNode } from '../features/architecture/architecture.types';

const spec = parseQuestion(raw);
const component = (id: string, componentId: string): ArchNode => {
  const definition = spec.componentCatalogue.components.find((item) => item.id === componentId)!;
  return { id, componentId, componentType: definition.type, name: definition.displayName, position: { x: 0, y: 0 }, config: { ...definition.defaultConfig } };
};
const makeDoc = (): ArchitectureDocument => ({
  schemaVersion: 1, questionId: spec.question.id, questionVersion: 1,
  nodes: [
    component('client', 'COMP-CLIENT'),
    component('api-a', 'COMP-APP-SERVER'),
    component('api-b', 'COMP-APP-SERVER'),
    component('db', 'COMP-SQL-DATABASE'),
  ],
  edges: [
    { id: 'e1', source: 'client', target: 'api-a', connectionTypeId: 'EDGE-SYNC-HTTP' },
    { id: 'e2', source: 'client', target: 'api-b', connectionTypeId: 'EDGE-SYNC-HTTP' },
    { id: 'e3', source: 'api-a', target: 'db', connectionTypeId: 'EDGE-DB-WRITE' },
    { id: 'e4', source: 'api-b', target: 'db', connectionTypeId: 'EDGE-DB-WRITE' },
  ],
});
const scenario: FailureScenario = {
  id: 'api-instance-loss', title: 'One API instance fails',
  failedComponentIds: ['COMP-APP-SERVER'],
  probes: [{ id: 'client-to-db', title: 'Client can still reach durable storage', sourceComponentId: 'COMP-CLIENT', targetComponentId: 'COMP-SQL-DATABASE', connectionTypeIds: ['EDGE-SYNC-HTTP', 'EDGE-DB-WRITE'] }],
};

describe('analyzeFailureScenarios', () => {
  it('reports disruption when all matching API nodes are removed', () => {
    const result = analyzeFailureScenarios(spec, makeDoc(), [scenario]);
    expect(result.scenarios[0].failedNodeIds).toEqual(['api-a', 'api-b']);
    expect(result.scenarios[0].probes[0].status).toBe('disrupted');
    expect(result.scenarios[0].impactedProbeCount).toBe(1);
  });

  it('distinguishes a path that was already missing before failure', () => {
    const doc = makeDoc();
    doc.edges = doc.edges.filter((edge) => edge.id !== 'e1' && edge.id !== 'e2');
    const result = analyzeFailureScenarios(spec, doc, [scenario]);
    expect(result.scenarios[0].probes[0].status).toBe('not-available-before-failure');
    expect(result.scenarios[0].impactedProbeCount).toBe(0);
  });

  it('does not mutate the input architecture', () => {
    const doc = makeDoc();
    const before = JSON.stringify(doc);
    analyzeFailureScenarios(spec, doc, [scenario]);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('returns no impact when an unrelated component fails', () => {
    const result = analyzeFailureScenarios(spec, makeDoc(), [{
      id: 'cache-loss', title: 'Cache loss', failedComponentIds: ['COMP-CACHE'],
      probes: scenario.probes,
    }]);
    expect(result.scenarios[0].probes[0].status).toBe('survives');
    expect(result.scenarios[0].impactedProbeCount).toBe(0);
  });
});
