import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument, ArchNode } from '../architecture/architecture.types';
import { checkConnection } from '../architecture/connectionRules';
import type { EvaluationReport, Finding, RequirementResult } from './evaluation.types';

const ALGORITHMS = ['token-bucket', 'sliding-window', 'fixed-window', 'leaky-bucket'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

export function evaluateRateLimiter(spec: QuestionSpec, doc: ArchitectureDocument, peakRps = 10000): EvaluationReport {
  const comps = spec.componentCatalogue.components;
  const has = (n: ArchNode, op: string) => (comps.find((c) => c.id === n.componentId)?.supportedOperations ?? []).includes(op);
  const findings: Finding[] = []; const reqs: RequirementResult[] = []; let seq = 0;
  const add = (f: Omit<Finding, 'id' | 'nodeIds' | 'edgeIds'> & { nodeIds?: string[]; edgeIds?: string[] }) => { const id = `F-${++seq}`; findings.push({ nodeIds: [], edgeIds: [], ...f, id }); return id; };
  const rec = (requirementId: string, ids: string[], status: RequirementResult['status'], ev: string[] = []) => reqs.push({ requirementId, status, findingIds: ids, evidenceNodeIds: [...new Set(ev)] });

  const seen = new Set<string>();
  for (const n of doc.nodes) {
    if (seen.has(n.id)) add({ ruleId: 'RULE-STRUCT-01', severity: 'error', title: 'Duplicate node ID', explanation: `Node ID ${n.id} is used more than once.`, nodeIds: [n.id] });
    seen.add(n.id);
    if (!spec.componentCatalogue.allowedComponentIds.includes(n.componentId)) add({ ruleId: 'RULE-STRUCT-01', severity: 'error', title: 'Unsupported component', explanation: `${n.name} uses unsupported component ${n.componentId}.`, nodeIds: [n.id] });
  }
  for (const e of doc.edges) {
    const r = checkConnection(spec, doc, e.source, e.target, e.connectionTypeId);
    if (!r.ok) add({ ruleId: 'RULE-STRUCT-02', severity: 'error', title: 'Incompatible connection', explanation: r.reason ?? 'Invalid connection.', edgeIds: [e.id], suggestion: 'Change the connection type or reconnect the components.' });
  }
  const valid = doc.edges.filter((e) => checkConnection(spec, doc, e.source, e.target, e.connectionTypeId).ok);
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const clients = doc.nodes.filter((n) => has(n, 'http-response'));
  const limiter = doc.nodes.find((n) => n.componentType === 'rate-limiter');
  const app = doc.nodes.find((n) => n.componentType === 'application-server');
  const reach = (block?: string) => {
    const out = new Set<string>(); const q = clients.map((c) => c.id); q.forEach((i) => out.add(i));
    while (q.length) { const c = q.pop()!; for (const e of valid) if (e.source === c && e.target !== block && !out.has(e.target)) { out.add(e.target); q.push(e.target); } }
    return out;
  };
  const store = limiter ? valid.filter((e) => e.source === limiter.id && e.connectionTypeId === 'EDGE-COUNTER').map((e) => byId.get(e.target)!).find((n) => has(n, 'atomic-increment')) : undefined;
  const lid = limiter ? [limiter.id] : [];

  // RL-FR-01: every request is checked
  if (!limiter) rec('RL-FR-01', [add({ ruleId: 'RULE-RL-01', severity: 'error', requirementId: 'RL-FR-01', title: 'No rate limiter in the design', explanation: 'Nothing checks request rates before they reach the service.', suggestion: 'Add a Rate Limiter between the clients and the Application Server.' })], 'fail');
  else if (!app) rec('RL-FR-01', [add({ ruleId: 'RULE-RL-01', severity: 'error', requirementId: 'RL-FR-01', title: 'No application server to protect', explanation: 'The limiter has no service behind it.', nodeIds: lid })], 'fail');
  else if (!reach().has(limiter.id) || !reach().has(app.id)) rec('RL-FR-01', [add({ ruleId: 'RULE-RL-01', severity: 'error', requirementId: 'RL-FR-01', title: 'Requests do not flow through the limiter', explanation: 'No client path reaches both the limiter and the application server.', nodeIds: [limiter.id, app.id], suggestion: 'Connect Client → … → Rate Limiter → Application Server.' })], 'fail');
  else if (reach(limiter.id).has(app.id)) rec('RL-FR-01', [add({ ruleId: 'RULE-RL-01', severity: 'error', requirementId: 'RL-FR-01', title: 'Requests can bypass the limiter', explanation: 'There is a path from a client to the application server that does not go through the rate limiter.', nodeIds: [limiter.id, app.id], suggestion: 'Remove the direct path so the limiter is the only way in.' })], 'fail');
  else rec('RL-FR-01', [], 'pass', [clients[0].id, limiter.id, app.id]);

  // RL-FR-02: consistent counts
  if (!limiter) rec('RL-FR-02', [], 'not-evaluated');
  else if (store) rec('RL-FR-02', [], 'pass', [limiter.id, store.id]);
  else if (Number(limiter.config.instances) > 1) rec('RL-FR-02', [add({ ruleId: 'RULE-RL-02', severity: 'error', requirementId: 'RL-FR-02', title: 'Limiter servers count separately', explanation: `${limiter.config.instances} limiter servers have no shared counter store, so each sees only part of a client’s traffic and a client can exceed the limit.`, nodeIds: lid, suggestion: 'Add a Counter Store and connect the limiter to it with a Counter Update edge.' })], 'fail');
  else { rec('RL-FR-02', [], 'pass', lid); add({ ruleId: 'RULE-RL-02', severity: 'info', requirementId: 'RL-FR-02', title: 'Counts are local to one server', explanation: 'This works with a single limiter server. A second server would need a shared counter store.', nodeIds: lid }); }

  // RL-FR-03: 429
  if (limiter && limiter.config.rejectBehavior === 'return-429') rec('RL-FR-03', [], 'pass', lid);
  else rec('RL-FR-03', [add({ ruleId: 'RULE-RL-03', severity: 'not-evaluated', requirementId: 'RL-FR-03', title: 'Rejection response not declared', explanation: 'A diagram cannot show what a rejected caller receives.', nodeIds: lid, suggestion: 'Select the Rate Limiter and set “rejectBehavior” to return-429.' })], 'not-evaluated');

  // RL-FR-04: algorithm
  const algo = limiter ? String(limiter.config.algorithm) : '';
  if (limiter && ALGORITHMS.includes(algo)) {
    rec('RL-FR-04', [], 'pass', lid);
    if (algo === 'fixed-window') add({ ruleId: 'RULE-RL-04', severity: 'info', requirementId: 'RL-FR-04', title: 'Fixed windows allow boundary bursts', explanation: 'A client can send a full limit at the end of one window and again at the start of the next.', nodeIds: lid });
  } else rec('RL-FR-04', limiter ? [add({ ruleId: 'RULE-RL-04', severity: 'error', requirementId: 'RL-FR-04', title: 'No valid limiting algorithm', explanation: `“${algo}” is not a supported algorithm.`, nodeIds: lid })] : [], limiter ? 'fail' : 'not-evaluated');

  // RL-NFR-01: capacity
  if (!limiter) rec('RL-NFR-01', [], 'not-evaluated');
  else {
    const ids: string[] = [];
    const cap = Number(limiter.config.instances) * Number(limiter.config.capacityPerInstanceRps);
    if (!(cap >= peakRps)) ids.push(add({ ruleId: 'RULE-RL-05', severity: 'warning', requirementId: 'RL-NFR-01', title: 'Limiter capacity too low', explanation: `Limiter capacity ${cap} req/s is below the ${peakRps} req/s peak.`, nodeIds: lid, suggestion: 'Add limiter instances or raise capacity per instance.' }));
    if (store && !(Number(store.config.opsCapacityRps) >= peakRps)) ids.push(add({ ruleId: 'RULE-RL-05', severity: 'warning', requirementId: 'RL-NFR-01', title: 'Counter store capacity too low', explanation: `Every request performs a counter operation, so ${peakRps} ops/s are needed.`, nodeIds: [store.id], suggestion: 'Use a store with higher throughput or shard the counters.' }));
    rec('RL-NFR-01', ids, ids.length === 0 ? 'pass' : 'fail', [...lid, ...(store ? [store.id] : [])]);
  }

  // RL-NFR-02: modeled delay
  const nfr2 = (spec.requirements as { nonFunctional?: { id: string; target?: { value?: number } }[] } | undefined)?.nonFunctional?.find((r) => r.id === 'RL-NFR-02');
  const goal = nfr2?.target?.value ?? 10;
  const l1 = limiter ? num(limiter.config.averageLatencyMs) : null; const l2 = store ? num(store.config.averageLatencyMs) : 0;
  if (!limiter) rec('RL-NFR-02', [], 'not-evaluated');
  else if (l1 === null || l2 === null) rec('RL-NFR-02', [add({ ruleId: 'RULE-RL-06', severity: 'not-evaluated', requirementId: 'RL-NFR-02', title: 'Delay not evaluated: inputs missing', explanation: 'A valid latency is needed on the limiter and the counter store.', nodeIds: lid })], 'not-evaluated', lid);
  else {
    const total = l1 + l2; const ok = total < goal;
    const id = add({ ruleId: 'RULE-RL-06', severity: ok ? 'info' : 'warning', requirementId: 'RL-NFR-02', title: `Modeled added delay ≈ ${total} ms (goal < ${goal} ms)`, explanation: 'Sum of the limiter and counter-store average latencies. A modeled estimate, not a measured p95.', nodeIds: [...lid, ...(store ? [store.id] : [])] });
    rec('RL-NFR-02', ok ? [] : [id], ok ? 'pass' : 'fail', [...lid, ...(store ? [store.id] : [])]);
  }

  // RL-NFR-03: store failure
  if (!limiter) rec('RL-NFR-03', [], 'not-evaluated');
  else if (!store) rec('RL-NFR-03', [], 'pass', lid);
  else if (['fail-open', 'fail-closed'].includes(String(limiter.config.onStoreUnavailable))) rec('RL-NFR-03', [], 'pass', [limiter.id, store.id]);
  else rec('RL-NFR-03', [add({ ruleId: 'RULE-RL-07', severity: 'not-evaluated', requirementId: 'RL-NFR-03', title: 'Counter-store failure behaviour not declared', explanation: 'It is unclear whether requests are allowed or blocked when the store is down.', nodeIds: [limiter.id, store.id], suggestion: 'Set “onStoreUnavailable” to fail-open or fail-closed.' })], 'not-evaluated');

  return { findings, requirements: reqs, limitations: ['Checks use component capabilities and the values you configured.', 'What a rejected caller receives is application behaviour, so it must be declared.', 'Latency is a modeled sum of averages, not a measured percentile.'] };
}
