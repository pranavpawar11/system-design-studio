import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument, ArchNode } from '../architecture/architecture.types';
import { checkConnection } from '../architecture/connectionRules';

export interface LatencyStage { nodeId: string; label: string; ms: number | null; role: 'path' | 'cache' | 'database' }
export interface LatencyEstimate {
  pathNodeIds: string[]; stages: LatencyStage[]; unknowns: string[]; hasCache: boolean; hitRatio: number;
  hitMs: number | null; missMs: number | null; expectedMs: number | null;
}
const NO_LATENCY = new Set(['client', 'dns']); // not modeled: network and resolution time are outside this model
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/**
 * Modeled, deterministic estimate: sum of configured average latencies on the sequential request path,
 * plus the cache lookup and (on a miss) the database read. It is NOT a measured percentile.
 * Queueing, network variance, concurrency and tail latency are not modeled.
 */
export function estimateRedirectLatency(q: QuestionSpec, doc: ArchitectureDocument, appId: string): LatencyEstimate | null {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const valid = doc.edges.filter((e) => checkConnection(q, doc, e.source, e.target, e.connectionTypeId).ok);
  const comps = q.componentCatalogue.components;
  const isClient = (n: ArchNode) => (comps.find((c) => c.id === n.componentId)?.supportedOperations ?? []).includes('http-response');

  let path: string[] | undefined;
  for (const c of doc.nodes.filter(isClient)) {
    const parent = new Map<string, string>(); const seen = new Set([c.id]); const queue = [c.id];
    while (queue.length && !path) {
      const cur = queue.shift()!;
      if (cur === appId) { path = [cur]; let x = cur; while (parent.has(x)) { x = parent.get(x)!; path.unshift(x); } break; }
      for (const e of valid) if (e.source === cur && !seen.has(e.target)) { seen.add(e.target); parent.set(e.target, cur); queue.push(e.target); }
    }
    if (path) break;
  }
  if (!path) return null;

  const stages: LatencyStage[] = []; const unknowns: string[] = [];
  const push = (n: ArchNode, ms: number | null, role: LatencyStage['role']) => { stages.push({ nodeId: n.id, label: n.name, ms, role }); if (ms === null) unknowns.push(n.name); };
  for (const id of path) {
    const n = byId.get(id)!;
    if (NO_LATENCY.has(n.componentType)) continue;
    push(n, num(n.config.averageLatencyMs) ?? num(n.config.averageProcessingLatencyMs), 'path');
  }
  const app = byId.get(appId)!;
  const target = (type: string) => valid.filter((e) => e.source === app.id && e.connectionTypeId === type).map((e) => byId.get(e.target)!)[0];
  const cache = target('EDGE-CACHE-READ'); const db = target('EDGE-DB-READ');
  if (cache) push(cache, num(cache.config.averageLatencyMs), 'cache');
  if (db) push(db, num(db.config.averageReadLatencyMs), 'database');
  if (!db) unknowns.push('a database read target');

  const hitRatio = cache ? num(cache.config.hitRatio) ?? 0 : 0;
  const pathNodeIds = [...path, ...(cache ? [cache.id] : []), ...(db ? [db.id] : [])];
  if (unknowns.length) return { pathNodeIds, stages, unknowns, hasCache: !!cache, hitRatio, hitMs: null, missMs: null, expectedMs: null };

  const sum = (r: LatencyStage['role'][]) => stages.filter((s) => r.includes(s.role)).reduce((a, s) => a + (s.ms ?? 0), 0);
  const base = sum(['path']); const c = sum(['cache']); const d = sum(['database']);
  const hitMs = cache ? base + c : null;
  const missMs = base + c + d;
  const expectedMs = cache ? base + c + (1 - hitRatio) * d : missMs;
  return { pathNodeIds, stages, unknowns, hasCache: !!cache, hitRatio, hitMs, missMs, expectedMs };
}
