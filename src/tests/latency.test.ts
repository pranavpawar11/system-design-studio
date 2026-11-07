import { describe, it, expect } from 'vitest';
import spec from '../data/questions/url-shortener.json';
import ext from '../data/questions/url-shortener.extensions.json';
import solved from './fixtures/url-shortener-solved.json';
import { mergeExtensions, parseQuestion } from '../features/questions/questionLoader';
import { estimateRedirectLatency } from '../features/evaluation/latency';
import { evaluate } from '../features/evaluation/evaluator';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';

const q = mergeExtensions(parseQuestion(spec), ext as never);
const base = () => structuredClone(solved) as unknown as ArchitectureDocument;
const nfr1 = (d: ArchitectureDocument) => evaluate(q, d).requirements.find((r) => r.requirementId === 'NFR-01')!;
const APP = 'node_fix00iegb';

describe('modeled redirect latency', () => {
  it('weights the database read by the cache miss ratio', () => {
    const l = estimateRedirectLatency(q, base(), APP)!;
    expect(l.hitMs).toBe(14);       // LB 2 + app 10 + cache 2
    expect(l.missMs).toBe(24);      // + database read 10
    expect(l.expectedMs).toBeCloseTo(15); // 14 + 0.1 × 10
  });
  it('passes NFR-01 with an info finding that says it is not a p95', () => {
    const r = evaluate(q, base());
    expect(r.requirements.find((x) => x.requirementId === 'NFR-01')!.status).toBe('pass');
    expect(r.findings.find((f) => f.ruleId === 'RULE-NFR-01')!.explanation).toMatch(/not a measured p95/);
  });
  it('is not evaluated when a latency input is missing', () => {
    const d = base(); delete d.nodes.find((n) => n.componentType === 'load-balancer')!.config.averageLatencyMs;
    expect(nfr1(d).status).toBe('not-evaluated');
  });
  it('fails with a warning when modeled latency exceeds the target', () => {
    const d = base(); d.nodes.find((n) => n.componentType === 'nosql-database')!.config.averageReadLatencyMs = 5000;
    d.nodes.find((n) => n.componentType === 'cache')!.config.hitRatio = 0;
    expect(nfr1(d).status).toBe('fail');
  });
  it('without a cache it uses the database path directly', () => {
    const d = base(); d.edges = d.edges.filter((e) => e.connectionTypeId !== 'EDGE-CACHE-READ');
    expect(estimateRedirectLatency(q, d, APP)!.expectedMs).toBe(22);
  });
  it('returns null when no client reaches the app', () => {
    const d = base(); d.edges = d.edges.filter((e) => e.connectionTypeId !== 'EDGE-SYNC-HTTP');
    expect(estimateRedirectLatency(q, d, APP)).toBeNull();
  });
});
