import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument } from '../architecture/architecture.types';
import { analyzeCapacity, SAFE_UTILIZATION, type CapacityAnalysis, type CapacityRow, type Scenario, type Workload } from './capacity';
import { analyzeRateLimiter } from './rlCapacity';
import { estimateRedirectLatency, type LatencyEstimate } from './latency';
import type { QuestionMetricsDefinition } from './evaluationPackage';

export interface QuestionMetricsInput {
  spec: QuestionSpec;
  doc: ArchitectureDocument;
  definition: QuestionMetricsDefinition;
  workload: Workload;
  scenario: Scenario;
}

export interface QuestionMetricsResult {
  modelId: string;
  capacity: CapacityAnalysis;
  latency: LatencyEstimate | null;
  trafficLabel: string;
  outageLabel: string;
  lostInstancesLabel: string;
  showCreateRate: boolean;
  secondaryTrafficLabel?: string;
}

type MetricsProvider = (input: QuestionMetricsInput) => Pick<QuestionMetricsResult, 'capacity' | 'latency'>;

function urlShortenerMetrics({ spec, doc, workload, scenario }: QuestionMetricsInput) {
  const capacity = analyzeCapacity(spec, doc, workload, scenario);
  const app = doc.nodes.find((node) => node.componentType === 'application-server' &&
    doc.edges.some((edge) => edge.source === node.id && edge.connectionTypeId === 'EDGE-DB-READ'))
    ?? doc.nodes.find((node) => node.componentType === 'application-server');
  return { capacity, latency: app ? estimateRedirectLatency(spec, doc, app.id) : null };
}

function rateLimiterMetrics({ spec, doc, workload, scenario }: QuestionMetricsInput) {
  return { capacity: analyzeRateLimiter(spec, doc, workload, scenario), latency: null };
}

const POLL_COMPONENTS = {
  api: 'COMP-APP-SERVER',
  database: 'COMP-SQL-DATABASE',
  queue: 'COMP-QUEUE',
  worker: 'COMP-WORKER',
  counter: 'COMP-COUNTER-STORE',
} as const;

function finiteConfig(node: ArchitectureDocument['nodes'][number] | undefined, key: string): number | null {
  const value = node?.config[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function pollCapacityRow(
  id: string,
  label: string,
  node: ArchitectureDocument['nodes'][number],
  load: number | null,
  capacity: number | null,
  note: string,
): CapacityRow {
  const utilization = load !== null && capacity !== null && capacity > 0 ? load / capacity : null;
  const status = utilization === null ? 'not-modeled' : utilization > 1 ? 'over' : utilization > SAFE_UTILIZATION ? 'high' : 'ok';
  return { id, label, nodeId: node.id, load, capacity, utilization, status, note };
}

function votingPollMetrics({ spec, doc, workload, scenario }: QuestionMetricsInput) {
  const nodes = doc.nodes;
  const find = (componentId: string) => nodes.find((node) => node.componentId === componentId);
  const api = find(POLL_COMPONENTS.api);
  const database = find(POLL_COMPONENTS.database);
  const queue = find(POLL_COMPONENTS.queue);
  const worker = find(POLL_COMPONENTS.worker);
  const counter = find(POLL_COMPONENTS.counter);

  const voteRps = workload.redirectRps * workload.multiplier;
  const resultTarget = (spec.requirements as any)?.nonFunctional?.find((requirement: any) => requirement.id === 'NFR-02')?.target?.resultQueriesPerSecond;
  const resultQueryRps = typeof resultTarget === 'number' && Number.isFinite(resultTarget) ? resultTarget : null;
  const combinedApiLoad = resultQueryRps === null ? null : voteRps + resultQueryRps;
  const rows: CapacityRow[] = [];

  if (api) {
    const instances = finiteConfig(api, 'instances');
    const perInstance = finiteConfig(api, 'capacityPerInstanceRps');
    const capacity = instances !== null && perInstance !== null ? instances * perInstance : null;
    rows.push(pollCapacityRow('poll-api', api.name, api, combinedApiLoad, capacity,
      resultQueryRps === null
        ? 'Result-query target is not defined; shared API load cannot be calculated.'
        : `Shared API load: vote submissions (${voteRps.toLocaleString()} /s) + result queries (${resultQueryRps.toLocaleString()} /s).`));
  }

  if (database) {
    rows.push(pollCapacityRow('poll-db-writes', `${database.name} (durable writes)`, database, voteRps,
      finiteConfig(database, 'writeCapacityRps'),
      'One durable database write per accepted vote. Does not model replication overhead.'));
  }

  if (queue) {
    rows.push(pollCapacityRow('poll-queue-ingress', `${queue.name} (publish ingress)`, queue, voteRps,
      finiteConfig(queue, 'publishCapacityPerSecond'),
      'Maximum modeled event-publish ingress. Arrival rate is workload, not queue capacity.'));
    rows.push(pollCapacityRow('poll-queue-processing', `${queue.name} (processing)`, queue, voteRps,
      finiteConfig(queue, 'processingCapacityPerSecond'),
      'Maximum modeled queue processing throughput, separate from publish ingress.'));
  }

  if (worker) {
    const configuredInstances = finiteConfig(worker, 'instances');
    const perInstance = finiteConfig(worker, 'capacityPerInstancePerSecond');
    const remainingInstances = configuredInstances === null ? null : Math.max(0, configuredInstances - scenario.lostInstances);
    const capacity = remainingInstances !== null && perInstance !== null ? remainingInstances * perInstance : null;
    rows.push(pollCapacityRow('poll-workers', worker.name, worker, voteRps, capacity,
      `${remainingInstances ?? 'Unknown'} worker instance(s) × ${perInstance ?? 'unknown'} votes/s per instance.${scenario.lostInstances ? ` ${scenario.lostInstances} worker instance(s) lost.` : ''}`));
  }

  if (counter) {
    if (scenario.cacheDown || counter.config.available === false) {
      rows.push(pollCapacityRow('poll-counter', `${counter.name} (reads + aggregation writes)`, counter, null, null,
        'Counter store is unavailable. Result reads and derived counter updates cannot be served; availability and recovery are not simulated.'));
    } else {
      const load = resultQueryRps === null ? null : voteRps + resultQueryRps;
      rows.push(pollCapacityRow('poll-counter', `${counter.name} (reads + aggregation writes)`, counter, load,
        finiteConfig(counter, 'opsCapacityRps'),
        resultQueryRps === null
          ? 'Result-query target is not defined; total counter operations cannot be calculated.'
          : `Modeled result reads (${resultQueryRps.toLocaleString()} /s) plus aggregation updates (${voteRps.toLocaleString()} /s).`));
    }
  }

  const ranked = rows.filter((row) => row.utilization !== null).sort((a, b) => (b.utilization ?? 0) - (a.utilization ?? 0));
  const capacity: CapacityAnalysis = {
    rows,
    bottleneckNodeId: ranked[0]?.nodeId,
    redirectRps: voteRps,
    createRps: resultQueryRps ?? 0,
    safeTarget: SAFE_UTILIZATION,
  };
  return { capacity, latency: null };
}

/**
 * Shared metrics runtime. Question packages select a stable provider key;
 * providers return one portable result shape consumed by the Metrics UI.
 */
export const questionMetricsProviders: Readonly<Record<string, MetricsProvider>> = Object.freeze({
  'url-shortener-v1': urlShortenerMetrics,
  'rate-limiter-v1': rateLimiterMetrics,
  'voting-poll-v1': votingPollMetrics,
});

export function runQuestionMetrics(input: QuestionMetricsInput): QuestionMetricsResult {
  const provider = questionMetricsProviders[input.definition.modelId];
  if (!provider) throw new Error(`No metrics provider registered for model "${input.definition.modelId}".`);
  const result = provider(input);
  return {
    ...result,
    modelId: input.definition.modelId,
    trafficLabel: input.definition.trafficLabel,
    outageLabel: input.definition.outageLabel,
    lostInstancesLabel: input.definition.lostInstancesLabel,
    showCreateRate: input.definition.showCreateRate,
    ...(input.definition.secondaryTrafficLabel ? { secondaryTrafficLabel: input.definition.secondaryTrafficLabel } : {}),
  };
}
