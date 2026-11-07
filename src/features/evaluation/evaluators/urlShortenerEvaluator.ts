import type { QuestionSpec } from '../../questions/question.types';
import type { ArchitectureDocument, ArchNode } from '../../architecture/architecture.types';
import { checkConnection } from '../../architecture/connectionRules';
import type { EvaluationReport, Finding, RequirementResult, Workload } from '../evaluation.types';
import { estimateRedirectLatency } from '../latency';
import { dbReadRate, utilization } from '../metrics';

export type { Workload };
export const DEFAULT_WORKLOAD: Workload = { peakRedirectRps: 10000, cacheHitRatio: 0.9 };

export function evaluateUrlShortener(spec: QuestionSpec, doc: ArchitectureDocument, workload: Workload = DEFAULT_WORKLOAD): EvaluationReport {
  const comps = spec.componentCatalogue.components;
  const ops = (n: ArchNode) => comps.find((c) => c.id === n.componentId)?.supportedOperations ?? [];
  const has = (n: ArchNode, op: string) => ops(n).includes(op);
  const findings: Finding[] = [];
  const reqs: RequirementResult[] = [];
  let seq = 0;
  const add = (f: Omit<Finding, 'id' | 'nodeIds' | 'edgeIds'> & { nodeIds?: string[]; edgeIds?: string[] }) => {
    const full: Finding = { nodeIds: [], edgeIds: [], ...f, id: `F-${++seq}` };
    findings.push(full); return full.id;
  };
  const record = (requirementId: string, ids: string[], pass: boolean, na = false, ev: string[] = []) =>
    reqs.push({ requirementId, status: na ? 'not-evaluated' : pass ? 'pass' : 'fail', findingIds: ids, evidenceNodeIds: [...new Set(ev)] });

  // Structural
  const seen = new Set<string>();
  for (const n of doc.nodes) {
    if (seen.has(n.id)) add({ ruleId: 'RULE-STRUCT-01', severity: 'error', title: 'Duplicate node ID', explanation: `Node ID ${n.id} is used more than once.`, nodeIds: [n.id] });
    seen.add(n.id);
    if (!spec.componentCatalogue.allowedComponentIds.includes(n.componentId))
      add({ ruleId: 'RULE-STRUCT-01', severity: 'error', title: 'Unsupported component', explanation: `${n.name} uses unsupported component ${n.componentId}.`, nodeIds: [n.id] });
  }
  for (const e of doc.edges) {
    const r = checkConnection(spec, doc, e.source, e.target, e.connectionTypeId);
    if (!r.ok) add({ ruleId: 'RULE-STRUCT-02', severity: 'error', title: 'Incompatible connection', explanation: r.reason ?? 'Invalid connection.', edgeIds: [e.id], suggestion: 'Change the connection type or reconnect the components.' });
  }

  // Graph helpers over valid edges only
  const valid = doc.edges.filter((e) => checkConnection(spec, doc, e.source, e.target, e.connectionTypeId).ok);
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const pathTo = (pred: (n: ArchNode) => boolean): string[] | undefined => {
    for (const c of doc.nodes.filter((n) => has(n, 'http-response'))) {
      const parent = new Map<string, string>(); const seen = new Set([c.id]); const q = [c.id];
      while (q.length) {
        const cur = q.shift()!;
        if (pred(byId.get(cur)!)) { const p = [cur]; let x = cur; while (parent.has(x)) { x = parent.get(x)!; p.unshift(x); } return p; }
        for (const e of valid) if (e.source === cur && !seen.has(e.target)) { seen.add(e.target); parent.set(e.target, cur); q.push(e.target); }
      }
    }
    return undefined;
  };
  const clientsReaching = (pred: (n: ArchNode) => boolean) => { const p = pathTo(pred); return p ? byId.get(p[p.length - 1]) : undefined; };
  const pathOf = (n?: ArchNode) => (n ? pathTo((x) => x.id === n.id) ?? [] : []);
  const durableTarget = (app: ArchNode, kind: 'EDGE-DB-WRITE' | 'EDGE-DB-READ') =>
    valid.filter((e) => e.source === app.id && e.connectionTypeId === kind).map((e) => byId.get(e.target)!).find((t) => t.config.durable === true && has(t, kind === 'EDGE-DB-WRITE' ? 'durable-write' : 'durable-read'));

  // FR-01 / NFR-05
  const creator = clientsReaching((n) => has(n, 'url-validation') && has(n, 'short-code-generation') && !!durableTarget(n, 'EDGE-DB-WRITE'));
  if (!creator) {
    const f1 = add({ ruleId: 'RULE-FR-01', severity: 'error', requirementId: 'FR-01', title: 'No complete URL creation path', explanation: 'No path from a client reaches a component that validates, generates a code and writes to durable storage.', suggestion: 'Connect Client → Application Server and add a Database Write edge to a durable database.' });
    const f2 = add({ ruleId: 'RULE-NFR-05', severity: 'error', requirementId: 'NFR-05', title: 'The URL creation path does not reach durable storage', explanation: 'Created mappings would not be persisted.' });
    record('FR-01', [f1], false); record('NFR-05', [f2], false);
  } else { const ev = [...pathOf(creator), durableTarget(creator, 'EDGE-DB-WRITE')!.id]; record('FR-01', [], true, false, ev); record('NFR-05', [], true, false, ev); }

  // FR-02
  const resolver = clientsReaching((n) => has(n, 'mapping-lookup') && has(n, 'redirect-response') && !!durableTarget(n, 'EDGE-DB-READ'));
  if (!resolver) { const f = add({ ruleId: 'RULE-FR-02', severity: 'error', requirementId: 'FR-02', title: 'The redirect path has no valid mapping lookup', explanation: 'No client-reachable application has a Database Read edge to a durable store.', suggestion: 'Add a Database Read connection from the Application Server to a database.' }); record('FR-02', [f], false); }
  else record('FR-02', [], true, false, [...pathOf(resolver), ...valid.filter((e) => e.source === resolver.id && (e.connectionTypeId === 'EDGE-CACHE-READ' || e.connectionTypeId === 'EDGE-DB-READ')).map((e) => e.target)]);

  // FR-03 / NFR-03
  const writeStore = creator ? durableTarget(creator, 'EDGE-DB-WRITE') : undefined;
  const unique = !!writeStore && (writeStore.config.uniqueConstraintSupported === true);
  if (!unique) {
    const f = add({ ruleId: 'RULE-FR-03', severity: 'error', requirementId: 'FR-03', title: 'The short-code uniqueness strategy has not been established', explanation: 'No durable store on the creation path enforces uniqueness atomically.', suggestion: 'Write to a database that supports unique constraints or conditional writes.' });
    const g = add({ ruleId: 'RULE-NFR-03', severity: 'error', requirementId: 'NFR-03', title: 'Mapping integrity not enforceable', explanation: 'See FR-03.' });
    record('FR-03', [f], false); record('NFR-03', [g], false);
  } else { record('FR-03', [], true, false, [writeStore!.id]); record('NFR-03', [], true, false, [writeStore!.id]); }

  // FR-04: only verifiable when the learner declares the behaviour on the resolver
  if (resolver && resolver.config.notFoundBehavior === 'return-404') record('FR-04', [], true, false, [resolver.id]);
  else {
    const f4 = add({ ruleId: 'RULE-FR-04', severity: 'not-evaluated', requirementId: 'FR-04', title: 'Unknown-code handling not declared', explanation: 'A diagram cannot show application logic. The not-found response is unverified until you declare it.', nodeIds: resolver ? [resolver.id] : [], suggestion: 'Select the Application Server and set “notFoundBehavior” to return-404.' });
    record('FR-04', [f4], false, true);
  }

  // FR-06
  const validator = clientsReaching((n) => has(n, 'url-validation'));
  if (!validator) { const f = add({ ruleId: 'RULE-FR-06', severity: 'warning', requirementId: 'FR-06', title: 'No URL validation component on the request path', explanation: 'Submitted URLs are not validated by any reachable component.' }); record('FR-06', [f], false); }
  else record('FR-06', [], true, false, pathOf(validator));

  // FR-05 / NFR-02 (capacity model)
  if (resolver) {
    const cache = valid.filter((e) => e.source === resolver.id && e.connectionTypeId === 'EDGE-CACHE-READ').map((e) => byId.get(e.target)!)[0];
    const db = durableTarget(resolver, 'EDGE-DB-READ')!;
    const ratio = cache ? Number(cache.config.hitRatio ?? workload.cacheHitRatio) : 0;
    const dbLoad = dbReadRate(workload.peakRedirectRps, ratio);
    const dbCap = Number(db.config.readCapacityRps);
    const appUtil = utilization(workload.peakRedirectRps, Number(resolver.config.instances), Number(resolver.config.capacityPerInstanceRps));
    const ids: string[] = [];
    if (appUtil === null || appUtil > 1) ids.push(add({ ruleId: 'RULE-NFR-02', severity: 'warning', requirementId: 'NFR-02', title: 'Application capacity exceeded', explanation: `Modeled load ${workload.peakRedirectRps} req/s exceeds configured application capacity.`, nodeIds: [resolver.id], suggestion: 'Increase instances or capacity per instance.' }));
    if (dbLoad > dbCap) ids.push(add({ ruleId: 'RULE-NFR-02', severity: 'warning', requirementId: 'NFR-02', title: 'Database read capacity exceeded', explanation: `Modeled database reads ${dbLoad.toFixed(0)}/s exceed capacity ${dbCap}/s.${cache ? '' : ' No cache is connected.'}`, nodeIds: [db.id], suggestion: 'Add a cache or use a store with higher read capacity.' }));
    const cacheMode = cache ? String(cache.config.onUnavailable ?? 'undeclared') : '';
    if (cache && cacheMode === 'undeclared') add({ ruleId: 'RULE-FR-05', severity: 'info', requirementId: 'FR-05', title: 'Cache failure behaviour not declared', explanation: 'It is unclear whether requests bypass the cache or fail when it is unavailable.', nodeIds: [cache.id], suggestion: 'Set the cache “onUnavailable” to bypass-to-database or fail-request.' });
    if (cache && cacheMode !== 'fail-request' && cache.config.available === true && dbReadRate(workload.peakRedirectRps, ratio, false) > dbCap)
      add({ ruleId: 'RULE-NFR-02', severity: 'warning', requirementId: 'NFR-02', title: 'Cache failure may increase database load beyond capacity', explanation: `If the cache fails, all ${workload.peakRedirectRps} req/s reach a database rated for ${dbCap}/s.`, nodeIds: [cache.id, db.id] });
    const ev = [resolver.id, db.id, ...(cache ? [cache.id] : [])]; record('FR-05', ids, ids.length === 0, false, ev); record('NFR-02', ids, ids.length === 0, false, ev);
  } else { record('FR-05', [], false, true); record('NFR-02', [], false, true); }

  // NFR-04
  const app = resolver ?? creator;
  if (app) {
    const ok = Number(app.config.instances) >= 2;
    const ids = ok ? [] : [add({ ruleId: 'RULE-NFR-04', severity: 'warning', requirementId: 'NFR-04', title: 'Single application instance', explanation: 'Losing the only instance leaves no viable path.', nodeIds: [app.id] })];
    record('NFR-04', ids, ok, false, [app.id]);
  } else record('NFR-04', [], false, true);

  // NFR-01: modeled latency (never presented as a measured percentile)
  const nfr1 = (spec.requirements as { nonFunctional?: { id: string; target?: { value?: number } }[] } | undefined)?.nonFunctional?.find((r) => r.id === 'NFR-01');
  const targetMs = nfr1?.target?.value ?? 200;
  const lat = resolver ? estimateRedirectLatency(spec, doc, resolver.id) : null;
  if (!lat) {
    const f = add({ ruleId: 'RULE-NFR-01', severity: 'not-evaluated', requirementId: 'NFR-01', title: 'Latency not evaluated: no redirect path', explanation: 'The request path cannot be determined, so no latency can be modeled.' });
    record('NFR-01', [f], false, true);
  } else if (lat.expectedMs === null) {
    const f = add({ ruleId: 'RULE-NFR-01', severity: 'not-evaluated', requirementId: 'NFR-01', title: 'Latency not evaluated: inputs missing', explanation: `No valid latency value for: ${lat.unknowns.join(', ')}.`, nodeIds: lat.pathNodeIds, suggestion: 'Set a non-negative average latency on those components.' });
    record('NFR-01', [f], false, true, lat.pathNodeIds);
  } else {
    const ok = lat.expectedMs < targetMs;
    const extra = lat.missMs !== null && lat.missMs >= targetMs && ok ? ` The cache-miss path alone models ${lat.missMs.toFixed(0)} ms.` : '';
    const id = add({ ruleId: 'RULE-NFR-01', severity: ok ? 'info' : 'warning', requirementId: 'NFR-01', nodeIds: lat.pathNodeIds,
      title: ok ? `Modeled redirect latency ≈ ${lat.expectedMs.toFixed(0)} ms (target < ${targetMs} ms)` : `Modeled redirect latency ≈ ${lat.expectedMs.toFixed(0)} ms exceeds ${targetMs} ms`,
      explanation: `Sum of configured average latencies along the path, weighted by the cache hit ratio.${extra} This is a modeled estimate, not a measured p95; queueing, network and tail latency are not modeled.`,
      suggestion: ok ? undefined : 'Reduce latency on the slowest stage (see the Metrics tab) or add a cache.' });
    record('NFR-01', ok ? [] : [id], ok, false, lat.pathNodeIds);
  }

  return { findings, requirements: reqs, limitations: ['Checks use component capabilities and configured values only.', 'Application logic (e.g. 404 handling) cannot be verified from a diagram.', 'Capacity checks are simplified and not production predictions.'] };
}
