import { describe, expect, it } from 'vitest';
import raw from '../data/questions/url-shortener.json';
import { parseQuestion } from '../features/questions/questionLoader';
import { createGraphAnalyzer } from '../features/evaluation/core/graphAnalyzer';
import type { ArchitectureDocument, ArchNode } from '../features/architecture/architecture.types';

const spec = parseQuestion(raw);
const makeNode = (id: string, componentId: string): ArchNode => {
  const c = spec.componentCatalogue.components.find((x) => x.id === componentId)!;
  return { id, componentId, componentType: c.type, name: c.displayName, position: { x: 0, y: 0 }, config: { ...c.defaultConfig } };
};
const doc = (edges: ArchitectureDocument['edges'] = []): ArchitectureDocument => ({
  schemaVersion: 1, questionId: spec.question.id, questionVersion: 1,
  nodes: [makeNode('client', 'COMP-CLIENT'), makeNode('api', 'COMP-APP-SERVER'), makeNode('db', 'COMP-SQL-DATABASE'), makeNode('isolated', 'COMP-CACHE')], edges
});
const edge = (id: string, source: string, target: string, connectionTypeId: string) => ({ id, source, target, connectionTypeId });

describe('createGraphAnalyzer', () => {
  it('finds nodes and edges without mutating the document', () => {
    const d = doc([edge('e1', 'client', 'api', 'EDGE-SYNC-HTTP')]);
    const a = createGraphAnalyzer(spec, d);
    expect(a.findComponents((n) => n.componentType === 'client')).toHaveLength(1);
    expect(a.findConnections((e) => e.id === 'e1')).toHaveLength(1);
    expect(d.nodes).toHaveLength(4);
  });
  it('finds directed paths and returns their node and edge evidence', () => {
    const a = createGraphAnalyzer(spec, doc([edge('e1', 'client', 'api', 'EDGE-SYNC-HTTP'), edge('e2', 'api', 'db', 'EDGE-DB-WRITE')]));
    expect(a.findPath('client', (n) => n.id === 'db')).toEqual({ nodeIds: ['client', 'api', 'db'], edgeIds: ['e1', 'e2'] });
    expect(a.hasPath('client', (n) => n.id === 'db')).toBe(true);
    expect(a.hasPath('db', (n) => n.id === 'client')).toBe(false);
  });
  it('filters traversal by connection type', () => {
    const a = createGraphAnalyzer(spec, doc([edge('e1', 'client', 'api', 'EDGE-SYNC-HTTP'), edge('e2', 'api', 'db', 'EDGE-DB-WRITE')]));
    expect(a.hasPath('client', (n) => n.id === 'db', ['EDGE-SYNC-HTTP'])).toBe(false);
    expect(a.getReachableComponents('client', ['EDGE-SYNC-HTTP']).map((n) => n.id)).toEqual(['api']);
  });
  it('ignores invalid edges during graph traversal', () => {
    const a = createGraphAnalyzer(spec, doc([edge('bad', 'client', 'db', 'EDGE-DB-WRITE')]));
    expect(a.hasDirectConnection('client', 'db', 'EDGE-DB-WRITE')).toBe(false);
    expect(a.hasPath('client', (n) => n.id === 'db')).toBe(false);
  });
  it('handles cycles, disconnected nodes, and missing sources', () => {
    const a = createGraphAnalyzer(spec, doc([edge('e1', 'client', 'api', 'EDGE-SYNC-HTTP'), edge('e2', 'api', 'client', 'EDGE-SYNC-HTTP')]));
    expect(a.getReachableComponents('client').map((n) => n.id)).toEqual(['api']);
    expect(a.findPath('missing', () => true)).toBeUndefined();
    expect(a.getReachableComponents('isolated')).toEqual([]);
  });
});
