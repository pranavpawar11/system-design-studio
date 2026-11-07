import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument, ArchNode } from '../architecture/architecture.types';
import { MetricInputError, dbReadRate, utilization } from './metrics';

export interface Workload { redirectRps: number; multiplier: number }
export interface Scenario { cacheDown: boolean; lostInstances: number }
export type RowStatus = 'ok' | 'high' | 'over' | 'not-modeled';
export interface CapacityRow { id: string; label: string; nodeId?: string; load: number | null; capacity: number | null; utilization: number | null; status: RowStatus; note: string }
export interface CapacityAnalysis { rows: CapacityRow[]; bottleneckNodeId?: string; redirectRps: number; createRps: number; safeTarget: number }

export const SAFE_UTILIZATION = 0.7; // explicit modelling assumption, shown to the learner

const status = (u: number | null): RowStatus => (u === null ? 'not-modeled' : u > 1 ? 'over' : u > SAFE_UTILIZATION ? 'high' : 'ok');

export function analyzeCapacity(q: QuestionSpec, doc: ArchitectureDocument, w: Workload, sc: Scenario): CapacityAnalysis {
  if (!Number.isFinite(w.redirectRps) || w.redirectRps < 0) throw new MetricInputError('Redirect load must be a non-negative number.');
  if (!Number.isFinite(w.multiplier) || w.multiplier < 1) throw new MetricInputError('Traffic multiplier must be at least 1.');
  if (!Number.isInteger(sc.lostInstances) || sc.lostInstances < 0) throw new MetricInputError('Lost instances must be a whole number ≥ 0.');
  const redirectRps = w.redirectRps * w.multiplier;
  const inputs = q.capacityEstimation.defaultInputs;
  const perDay = (id: string) => inputs.find((i) => i.id === id)?.value ?? 0;
  const ratio = perDay('CAP-IN-01') > 0 ? perDay('CAP-IN-02') / perDay('CAP-IN-01') : 10;
  const createRps = redirectRps / (ratio > 0 ? ratio : 10);

  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const out = (src: string, type: string): ArchNode[] => doc.edges.filter((e) => e.source === src && e.connectionTypeId === type).map((e) => byId.get(e.target)).filter((n): n is ArchNode => !!n);
  const apps = doc.nodes.filter((n) => n.componentType === 'application-server');
  const app = apps.find((a) => out(a.id, 'EDGE-DB-READ').length) ?? apps[0];
  const rows: CapacityRow[] = [];
  if (!app) return { rows, redirectRps, createRps, safeTarget: SAFE_UTILIZATION };

  const instances = Math.max(0, Number(app.config.instances) - sc.lostInstances);
  const appCap = instances * Number(app.config.capacityPerInstanceRps);
  const appLoad = redirectRps + createRps;
  const au = utilization(appLoad, instances, Number(app.config.capacityPerInstanceRps));
  rows.push({ id: 'app', label: app.name, nodeId: app.id, load: appLoad, capacity: appCap, utilization: au, status: status(au),
    note: `${instances} instance(s) × ${app.config.capacityPerInstanceRps} req/s, assuming perfectly balanced traffic.${sc.lostInstances ? ` ${sc.lostInstances} instance(s) lost.` : ''}` });

  const cache = out(app.id, 'EDGE-CACHE-READ')[0];
  const cacheUsable = !!cache && !sc.cacheDown && cache.config.available === true;
  const hit = cache ? Number(cache.config.hitRatio) : 0;
  const failMode = !!cache && sc.cacheDown && cache.config.onUnavailable === 'fail-request';
  if (cache) rows.push({ id: 'cache', label: cache.name, nodeId: cache.id, load: redirectRps, capacity: null, utilization: null, status: 'not-modeled',
    note: sc.cacheDown ? `Cache is down (${String(cache.config.onUnavailable ?? 'undeclared')}).` : `Capacity not modeled. Hit ratio ${hit} is an assumption, not a measurement.` });

  const db = out(app.id, 'EDGE-DB-READ')[0];
  if (db) {
    const load = failMode ? 0 : dbReadRate(redirectRps, hit, cacheUsable);
    const u = utilization(load, 1, Number(db.config.readCapacityRps));
    rows.push({ id: 'dbread', label: `${db.name} (reads)`, nodeId: db.id, load, capacity: Number(db.config.readCapacityRps) || null, utilization: u, status: status(u),
      note: failMode ? 'Requests fail instead of reaching the database: no overload, but redirects are unavailable.' : cacheUsable ? `Cache misses only: ${redirectRps.toFixed(0)} × (1 − ${hit}).` : 'No usable cache: every redirect reads the database.' });
  }
  const wr = out(app.id, 'EDGE-DB-WRITE')[0];
  if (wr) {
    const u = utilization(createRps, 1, Number(wr.config.writeCapacityRps));
    rows.push({ id: 'dbwrite', label: `${wr.name} (writes)`, nodeId: wr.id, load: createRps, capacity: Number(wr.config.writeCapacityRps) || null, utilization: u, status: status(u), note: `Creation rate = redirects ÷ ${ratio} (read:write ratio).` });
  }
  const ranked = rows.filter((r) => r.utilization !== null).sort((a, b) => (b.utilization ?? 0) - (a.utilization ?? 0));
  return { rows, bottleneckNodeId: ranked[0]?.nodeId, redirectRps, createRps, safeTarget: SAFE_UTILIZATION };
}
