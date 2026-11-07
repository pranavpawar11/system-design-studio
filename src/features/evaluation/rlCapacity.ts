import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument } from '../architecture/architecture.types';
import { MetricInputError, utilization } from './metrics';
import { SAFE_UTILIZATION, type CapacityAnalysis, type CapacityRow, type RowStatus, type Scenario, type Workload } from './capacity';

const status = (u: number | null): RowStatus => (u === null ? 'not-modeled' : u > 1 ? 'over' : u > SAFE_UTILIZATION ? 'high' : 'ok');

export function analyzeRateLimiter(_q: QuestionSpec, doc: ArchitectureDocument, w: Workload, sc: Scenario): CapacityAnalysis {
  if (!Number.isFinite(w.redirectRps) || w.redirectRps < 0) throw new MetricInputError('Request load must be a non-negative number.');
  if (!Number.isFinite(w.multiplier) || w.multiplier < 1) throw new MetricInputError('Traffic multiplier must be at least 1.');
  if (!Number.isInteger(sc.lostInstances) || sc.lostInstances < 0) throw new MetricInputError('Lost servers must be a whole number ≥ 0.');
  const rps = w.redirectRps * w.multiplier; const rows: CapacityRow[] = [];
  const limiter = doc.nodes.find((n) => n.componentType === 'rate-limiter');
  if (!limiter) return { rows, redirectRps: rps, createRps: 0, safeTarget: SAFE_UTILIZATION };
  const inst = Math.max(0, Number(limiter.config.instances) - sc.lostInstances);
  const u = utilization(rps, inst, Number(limiter.config.capacityPerInstanceRps));
  rows.push({ id: 'limiter', label: limiter.name, nodeId: limiter.id, load: rps, capacity: inst * Number(limiter.config.capacityPerInstanceRps), utilization: u, status: status(u), note: `${inst} server(s) × ${limiter.config.capacityPerInstanceRps} req/s. Every request is checked.` });
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const store = doc.edges.filter((e) => e.source === limiter.id && e.connectionTypeId === 'EDGE-COUNTER').map((e) => byId.get(e.target)).find(Boolean);
  if (store) {
    if (sc.cacheDown) {
      const b = String(limiter.config.onStoreUnavailable);
      rows.push({ id: 'store', label: store.name, nodeId: store.id, load: rps, capacity: null, utilization: null, status: 'not-modeled',
        note: b === 'fail-open' ? 'Store is down: requests are let through, so limits are not enforced.' : b === 'fail-closed' ? 'Store is down: every request is rejected.' : 'Store is down and the behaviour is undeclared.' });
    } else {
      const cap = Number(store.config.opsCapacityRps); const su = utilization(rps, 1, cap);
      rows.push({ id: 'store', label: store.name, nodeId: store.id, load: rps, capacity: cap || null, utilization: su, status: status(su), note: 'One counter operation per request.' });
    }
  }
  const app = doc.nodes.find((n) => n.componentType === 'application-server');
  if (app) {
    const au = utilization(rps, Number(app.config.instances), Number(app.config.capacityPerInstanceRps));
    rows.push({ id: 'app', label: app.name, nodeId: app.id, load: rps, capacity: Number(app.config.instances) * Number(app.config.capacityPerInstanceRps), utilization: au, status: status(au), note: 'Worst case: every request is allowed through. Rejected requests reduce this.' });
  }
  const ranked = rows.filter((r) => r.utilization !== null).sort((a, b) => (b.utilization ?? 0) - (a.utilization ?? 0));
  return { rows, bottleneckNodeId: ranked[0]?.nodeId, redirectRps: rps, createRps: 0, safeTarget: SAFE_UTILIZATION };
}
