import { describe, it, expect } from 'vitest';
import spec from '../data/questions/url-shortener.json';
import ext from '../data/questions/url-shortener.extensions.json';
import solved from './fixtures/url-shortener-solved.json';
import { mergeExtensions, parseQuestion } from '../features/questions/questionLoader';
import { analyzeCapacity } from '../features/evaluation/capacity';
import { evaluate } from '../features/evaluation/evaluator';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';

const q = mergeExtensions(parseQuestion(spec), ext as never);
const doc = solved as unknown as ArchitectureDocument;
const row = (a: ReturnType<typeof analyzeCapacity>, id: string) => a.rows.find((r) => r.id === id)!;

describe('capacity analysis', () => {
  it('default load: cache keeps DB reads at 10%', () => {
    const a = analyzeCapacity(q, doc, { redirectRps: 10000, multiplier: 1 }, { cacheDown: false, lostInstances: 0 });
    expect(row(a, 'dbread').load).toBeCloseTo(1000); expect(row(a, 'dbread').status).toBe('ok');
  });
  it('cache down sends all reads to the database', () => {
    const a = analyzeCapacity(q, doc, { redirectRps: 10000, multiplier: 1 }, { cacheDown: true, lostInstances: 0 });
    expect(row(a, 'dbread').load).toBe(10000);
  });
  it('10x growth overloads the app tier and names it the bottleneck', () => {
    const a = analyzeCapacity(q, doc, { redirectRps: 10000, multiplier: 10 }, { cacheDown: false, lostInstances: 0 });
    expect(row(a, 'app').status).toBe('over'); expect(a.bottleneckNodeId).toBe('node_fix00iegb');
  });
  it('losing instances reduces capacity; invalid input throws', () => {
    const a = analyzeCapacity(q, doc, { redirectRps: 10000, multiplier: 1 }, { cacheDown: false, lostInstances: 2 });
    expect(row(a, 'app').capacity).toBe(6000);
    expect(() => analyzeCapacity(q, doc, { redirectRps: -1, multiplier: 1 }, { cacheDown: false, lostInstances: 0 })).toThrow();
  });
  it('declaring notFoundBehavior makes FR-04 pass; otherwise it stays not-evaluated', () => {
    expect(evaluate(q, doc).requirements.find((r) => r.requirementId === 'FR-04')?.status).toBe('pass');
    const d2 = structuredClone(doc); d2.nodes.forEach((n) => { delete n.config.notFoundBehavior; });
    expect(evaluate(q, d2).requirements.find((r) => r.requirementId === 'FR-04')?.status).toBe('not-evaluated');
  });
});
