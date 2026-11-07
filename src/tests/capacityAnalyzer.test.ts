import { describe, expect, it } from 'vitest';
import { analyzeCapacityTargets, type CapacityTarget } from '../features/evaluation/core/capacityAnalyzer';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';

const makeDoc = (config: Record<string, number | string | boolean>): ArchitectureDocument => ({
  schemaVersion: 1,
  questionId: 'capacity-test',
  questionVersion: 1,
  nodes: [{
    id: 'api-1', componentId: 'COMP-APP', componentType: 'application-server',
    name: 'API', position: { x: 0, y: 0 }, config,
  }],
  edges: [],
});

describe('analyzeCapacityTargets', () => {
  it('calculates aggregate instance capacity and utilization', () => {
    const targets: CapacityTarget[] = [{
      id: 'api-capacity', title: 'API capacity', componentId: 'COMP-APP',
      model: { kind: 'instances', instancesConfig: 'instances', perInstanceCapacityConfig: 'capacityPerInstanceRps', load: 1200, unit: 'req/s' },
    }];
    const result = analyzeCapacityTargets(makeDoc({ instances: 2, capacityPerInstanceRps: 1000 }), targets);
    expect(result.rows[0]).toMatchObject({ load: 1200, capacity: 2000, utilization: 0.6, status: 'ok' });
    expect(result.bottleneckNodeId).toBe('api-1');
  });

  it('marks utilization above the safe threshold as high and above capacity as over', () => {
    const target: CapacityTarget = {
      id: 'api', title: 'API', componentId: 'COMP-APP',
      model: { kind: 'single', capacityConfig: 'capacityRps', load: 800, unit: 'req/s', safeUtilization: 0.7 },
    };
    expect(analyzeCapacityTargets(makeDoc({ capacityRps: 1000 }), [target]).rows[0].status).toBe('high');
    const overloaded = analyzeCapacityTargets(makeDoc({ capacityRps: 500 }), [target]);
    expect(overloaded.rows[0].status).toBe('over');
  });

  it('checks queue arrival rate against processing rate', () => {
    const target: CapacityTarget = {
      id: 'queue', title: 'Queue stability', componentId: 'COMP-QUEUE',
      model: { kind: 'queue', arrivalRateConfig: 'arrivalRps', processingRateConfig: 'processingRps', unit: 'messages/s' },
    };
    const doc = makeDoc({ arrivalRps: 900, processingRps: 1000 });
    doc.nodes[0].componentId = 'COMP-QUEUE';
    const result = analyzeCapacityTargets(doc, [target]);
    expect(result.rows[0]).toMatchObject({ utilization: 0.9, status: 'high' });
  });

  it('does not invent capacity when configuration is missing', () => {
    const target: CapacityTarget = {
      id: 'api', title: 'API', componentId: 'COMP-APP',
      model: { kind: 'single', capacityConfig: 'capacityRps', load: 100, unit: 'req/s' },
    };
    const result = analyzeCapacityTargets(makeDoc({}), [target]);
    expect(result.rows[0]).toMatchObject({ load: 100, capacity: null, utilization: null, status: 'not-modeled' });
  });

  it('does not create rows for components that are absent', () => {
    const target: CapacityTarget = {
      id: 'db', title: 'Database', componentId: 'COMP-DB',
      model: { kind: 'single', capacityConfig: 'readCapacityRps', load: 50, unit: 'reads/s' },
    };
    expect(analyzeCapacityTargets(makeDoc({}), [target]).rows).toHaveLength(0);
  });

  it('rejects invalid safe utilization thresholds', () => {
    const target: CapacityTarget = {
      id: 'api', title: 'API', componentId: 'COMP-APP',
      model: { kind: 'single', capacityConfig: 'capacityRps', load: 10, unit: 'req/s', safeUtilization: 1.2 },
    };
    expect(() => analyzeCapacityTargets(makeDoc({ capacityRps: 100 }), [target])).toThrow(/safeUtilization/);
  });
});
