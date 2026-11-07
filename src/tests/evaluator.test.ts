import { describe, it, expect } from 'vitest';
import spec from '../data/questions/url-shortener.json';
import { parseQuestion } from '../features/questions/questionLoader';
import { evaluate } from '../features/evaluation/evaluator';
import { checkConnection } from '../features/architecture/connectionRules';
import type { ArchitectureDocument, ArchNode } from '../features/architecture/architecture.types';

const q = parseQuestion(spec);
const node = (id: string, componentId: string, over: Record<string, number | boolean> = {}): ArchNode => {
  const c = q.componentCatalogue.components.find((x) => x.id === componentId)!;
  return { id, componentId, componentType: c.type, name: c.displayName, position: { x: 0, y: 0 }, config: { ...c.defaultConfig, ...over } };
};
const doc = (nodes: ArchNode[], edges: [string, string, string][]): ArchitectureDocument => ({
  schemaVersion: 1, questionId: q.question.id, questionVersion: 1, nodes,
  edges: edges.map(([source, target, t], i) => ({ id: `e${i}`, source, target, connectionTypeId: t })),
});
const status = (d: ArchitectureDocument, id: string) => evaluate(q, d).requirements.find((r) => r.requirementId === id)?.status;
const minimal = (db = 'COMP-SQL-DATABASE') => doc(
  [node('c', 'COMP-CLIENT'), node('a', 'COMP-APP-SERVER', { instances: 4 }), node('d', db)],
  [['c', 'a', 'EDGE-SYNC-HTTP'], ['a', 'd', 'EDGE-DB-WRITE'], ['a', 'd', 'EDGE-DB-READ']]);

describe('connection rules', () => {
  const d = minimal();
  it('accepts valid', () => expect(checkConnection(q, d, 'a', 'd', 'EDGE-DB-WRITE').ok).toBe(true));
  it('rejects incompatible', () => expect(checkConnection(q, d, 'c', 'd', 'EDGE-DB-WRITE').ok).toBe(false));
  it('rejects missing endpoint', () => expect(checkConnection(q, d, 'a', 'zzz', 'EDGE-DB-WRITE').ok).toBe(false));
  it('rejects unsupported type', () => expect(checkConnection(q, d, 'a', 'd', 'EDGE-NOPE').ok).toBe(false));
});
describe('evaluator', () => {
  it('TEST-01 minimal relational passes', () => {
    for (const r of ['FR-01', 'FR-02', 'FR-03', 'NFR-05']) expect(status(minimal(), r)).toBe('pass');
  });
  it('TEST-02 missing write path fails creation and durability', () => {
    const d = doc(minimal().nodes, [['c', 'a', 'EDGE-SYNC-HTTP'], ['a', 'd', 'EDGE-DB-READ']]);
    expect(status(d, 'FR-01')).toBe('fail'); expect(status(d, 'NFR-05')).toBe('fail');
  });
  it('TEST-03 missing lookup fails redirect', () => {
    const d = doc(minimal().nodes, [['c', 'a', 'EDGE-SYNC-HTTP'], ['a', 'd', 'EDGE-DB-WRITE']]);
    expect(status(d, 'FR-02')).toBe('fail');
  });
  it('TEST-04 NoSQL alternative passes', () => {
    for (const r of ['FR-01', 'FR-02', 'FR-03']) expect(status(minimal('COMP-NOSQL-DATABASE'), r)).toBe('pass');
  });
  it('invalid connections yield findings; FR-04 never auto-passes', () => {
    const d = doc(minimal().nodes, [['c', 'd', 'EDGE-DB-WRITE']]);
    expect(evaluate(q, d).findings.some((f) => f.ruleId === 'RULE-STRUCT-02')).toBe(true);
    expect(status(minimal(), 'FR-04')).toBe('not-evaluated');
  });
  it('uncached 10k rps exceeds SQL read capacity', () => {
    expect(evaluate(q, minimal()).findings.some((f) => f.title === 'Database read capacity exceeded')).toBe(true);
  });
});
