import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument, ArchNode, ArchEdge } from '../architecture/architecture.types';
import { checkConnection } from '../architecture/connectionRules';
import type { EvaluationReport, Finding, RequirementResult } from './evaluation.types';

const COMPONENT = {
  client: 'COMP-CLIENT', loadBalancer: 'COMP-LOAD-BALANCER', api: 'COMP-APP-SERVER',
  database: 'COMP-SQL-DATABASE', queue: 'COMP-QUEUE', worker: 'COMP-WORKER', counter: 'COMP-COUNTER-STORE',
} as const;
const EDGE = {
  http: 'EDGE-SYNC-HTTP', dbWrite: 'EDGE-DB-WRITE', dbRead: 'EDGE-DB-READ',
  publish: 'EDGE-ASYNC-PUBLISH', consume: 'EDGE-ASYNC-CONSUME', cacheWrite: 'EDGE-CACHE-WRITE', cacheRead: 'EDGE-CACHE-READ',
} as const;

/** Question-specific checks for hld-polls-001. All graph evidence is validated against this question's catalogue. */
export function evaluateVotingPoll(spec: QuestionSpec, doc: ArchitectureDocument): EvaluationReport {
  const findings: Finding[] = [];
  const requirements: RequirementResult[] = [];
  let seq = 0;
  const add = (input: Omit<Finding, 'id' | 'nodeIds' | 'edgeIds'> & { nodeIds?: string[]; edgeIds?: string[] }) => {
    const finding: Finding = { id: `POLL-${++seq}`, nodeIds: [], edgeIds: [], ...input };
    findings.push(finding);
    return finding.id;
  };
  const record = (requirementId: string, status: RequirementResult['status'], findingIds: string[] = [], evidenceNodeIds: string[] = []) => {
    requirements.push({ requirementId, status, findingIds, evidenceNodeIds: [...new Set(evidenceNodeIds)] });
  };

  const nodes = doc.nodes ?? [];
  const edges = doc.edges ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const component = (id: string) => nodes.find((n) => n.componentId === id);
  const client = component(COMPONENT.client);
  const lb = component(COMPONENT.loadBalancer);
  const api = component(COMPONENT.api);
  const db = component(COMPONENT.database);
  const queue = component(COMPONENT.queue);
  const worker = component(COMPONENT.worker);
  const counter = component(COMPONENT.counter);
  const validEdges = edges.filter((e) => checkConnection(spec, doc, e.source, e.target, e.connectionTypeId).ok);
  const edge = (source: ArchNode | undefined, target: ArchNode | undefined, type: string): ArchEdge | undefined =>
    source && target ? validEdges.find((e) => e.source === source.id && e.target === target.id && e.connectionTypeId === type) : undefined;
  const hasOp = (node: ArchNode | undefined, operation: string) => !!node &&
    (spec.componentCatalogue.components.find((c) => c.id === node.componentId)?.supportedOperations.includes(operation) ?? false);
  const httpPath = !!client && !!api && (
    !!edge(client, api, EDGE.http) || (!!lb && !!edge(client, lb, EDGE.http) && !!edge(lb, api, EDGE.http))
  );
  const voteWrite = edge(api, db, EDGE.dbWrite);
  const queuePublish = edge(api, queue, EDGE.publish);
  const queueConsume = edge(queue, worker, EDGE.consume);
  const counterUpdate = edge(worker, counter, EDGE.cacheWrite);
  const resultRead = edge(api, counter, EDGE.cacheRead);
  const reconciliationRead = edge(worker, db, EDGE.dbRead);

  // Structural errors are shared, question-agnostic checks—not URL Shortener business rules.
  for (const e of edges) {
    const check = checkConnection(spec, doc, e.source, e.target, e.connectionTypeId);
    if (!check.ok) add({ ruleId: 'RULE-STRUCT-02', severity: 'error', title: 'Incompatible connection', explanation: check.reason ?? 'Invalid connection.', edgeIds: [e.id] });
  }

  // FR-01: durable vote write with a database-enforced unique key.
  const uniqueVote = !!db && db.config.durable === true && db.config.uniqueConstraintSupported === true &&
    db.config.uniqueKey === 'poll_id,user_id' && hasOp(api, 'durable-write') && hasOp(db, 'durable-write');
  if (httpPath && voteWrite && uniqueVote) record('FR-01', 'pass', [], [client!.id, ...(lb ? [lb.id] : []), api!.id, db!.id]);
  else {
    const id = add({ ruleId: 'RULE-POLL-FR-01', severity: 'error', requirementId: 'FR-01', title: 'Vote uniqueness or durable write path is incomplete',
      explanation: 'Accepting one vote per user per poll requires a client-reachable API, a durable vote write, and an atomic unique constraint on (poll_id, user_id).',
      nodeIds: [client, lb, api, db].filter(Boolean).map((n) => n!.id), edgeIds: [voteWrite].filter(Boolean).map((e) => e!.id),
      suggestion: 'Connect Client → (Load Balancer) → Poll API → durable SQL database, and enforce a unique poll_id,user_id key.' });
    record('FR-01', 'fail', [id]);
  }

  // FR-02: publish only after commit, consume asynchronously, then update counters.
  const asyncReady = !!queuePublish && !!queueConsume && !!counterUpdate && api?.config.publishOnlyAfterVoteCommit === true &&
    hasOp(api, 'publish-message') && hasOp(queue, 'buffer-work') && hasOp(worker, 'consume-message') && hasOp(worker, 'cache-write');
  if (asyncReady) record('FR-02', 'pass', [], [api!.id, queue!.id, worker!.id, counter!.id]);
  else {
    const id = add({ ruleId: 'RULE-POLL-FR-02', severity: 'error', requirementId: 'FR-02', title: 'Asynchronous vote aggregation path is incomplete',
      explanation: 'The API must publish an event after the durable vote commit; a queue must deliver it to a worker that updates the counter store.',
      nodeIds: [api, queue, worker, counter].filter(Boolean).map((n) => n!.id),
      suggestion: 'Connect Poll API → Queue → Aggregation Worker → Counter Store and declare publishOnlyAfterVoteCommit=true.' });
    record('FR-02', 'fail', [id]);
  }

  // FR-03: results must be read from derived counters, not by scanning vote rows.
  if (httpPath && resultRead && api?.config.resultReadSource === 'counter-store') record('FR-03', 'pass', [], [client!.id, api!.id, counter!.id]);
  else {
    const id = add({ ruleId: 'RULE-POLL-FR-03', severity: 'error', requirementId: 'FR-03', title: 'Poll results do not use the counter store',
      explanation: 'The client must reach the API, and the API must read aggregated poll results from the counter store.',
      nodeIds: [client, api, counter].filter(Boolean).map((n) => n!.id), suggestion: 'Add an API → Counter Store cache-read edge and set resultReadSource to counter-store.' });
    record('FR-03', 'fail', [id]);
  }

  // FR-04: idempotent consumer plus durable source for reconciliation.
  const idempotentWorker = worker?.config.idempotent === true && worker.config.deduplicationStrategy === 'event-id-marker-in-counter-store';
  const atomicDedup = counter?.config.deduplicationSupported === true && counter.config.atomicIncrement === true;
  if (idempotentWorker && atomicDedup && reconciliationRead && db?.config.durable === true) record('FR-04', 'pass', [], [worker!.id, counter!.id, db!.id]);
  else {
    const id = add({ ruleId: 'RULE-POLL-FR-04', severity: 'error', requirementId: 'FR-04', title: 'Duplicate delivery or count recovery is not protected',
      explanation: 'At-least-once delivery needs idempotent workers, atomic deduplicate-and-increment support, and a read path from durable vote records for reconciliation.',
      nodeIds: [worker, counter, db].filter(Boolean).map((n) => n!.id), suggestion: 'Enable worker event deduplication, atomic counter updates, and Worker → Database read for reconciliation.' });
    record('FR-04', 'fail', [id]);
  }

  // NFR-01: 5,000 vote submissions/second across database, queue, and worker pool.
  const targetVotes = Number((spec.requirements as any)?.nonFunctional?.find((r: any) => r.id === 'NFR-01')?.target?.votesPerSecond ?? 5000);
  const workerCapacity = Number(worker?.config.instances) * Number(worker?.config.capacityPerInstancePerSecond);
  const voteCapacityKnown = !!db && !!queue && !!worker && [db.config.writeCapacityRps, queue.config.arrivalRatePerSecond, workerCapacity].every((v) => Number.isFinite(Number(v)));
  if (!voteCapacityKnown) record('NFR-01', 'not-evaluated');
  else if (Number(db!.config.writeCapacityRps) >= targetVotes && Number(queue!.config.arrivalRatePerSecond) >= targetVotes && workerCapacity >= targetVotes)
    record('NFR-01', 'pass', [], [db!.id, queue!.id, worker!.id]);
  else {
    const id = add({ ruleId: 'RULE-POLL-NFR-01', severity: 'warning', requirementId: 'NFR-01', title: 'Vote submission capacity is below target',
      explanation: `Database writes, queue ingress, and aggregate worker capacity must each sustain ${targetVotes.toLocaleString()} votes/sec.`,
      nodeIds: [db, queue, worker].filter(Boolean).map((n) => n!.id), suggestion: 'Increase the capacity of the limiting database, queue, or worker pool.' });
    record('NFR-01', 'fail', [id]);
  }

  // NFR-02: result query load is served by the counter store.
  const targetReads = Number((spec.requirements as any)?.nonFunctional?.find((r: any) => r.id === 'NFR-02')?.target?.resultQueriesPerSecond ?? 10000);
  const counterCapacity = Number(counter?.config.opsCapacityRps);
  if (!counter || !Number.isFinite(counterCapacity)) record('NFR-02', 'not-evaluated');
  else if (counterCapacity >= targetReads) record('NFR-02', 'pass', [], [counter.id]);
  else {
    const id = add({ ruleId: 'RULE-POLL-NFR-02', severity: 'warning', requirementId: 'NFR-02', title: 'Counter-store capacity is below result traffic target',
      explanation: `The counter store is configured for ${counterCapacity.toLocaleString()} ops/sec; the target is ${targetReads.toLocaleString()} result queries/sec.`,
      nodeIds: [counter.id], suggestion: 'Increase counter-store throughput or partition the counters.' });
    record('NFR-02', 'fail', [id]);
  }

  // NFR-03: same capabilities that make FR-04 safe under at-least-once delivery.
  if (idempotentWorker && atomicDedup) record('NFR-03', 'pass', [], [worker!.id, counter!.id]);
  else {
    const id = add({ ruleId: 'RULE-POLL-NFR-03', severity: 'error', requirementId: 'NFR-03', title: 'Duplicate events can affect vote totals more than once',
      explanation: 'The worker must deduplicate events and the counter store must atomically combine deduplication with increment.',
      nodeIds: [worker, counter].filter(Boolean).map((n) => n!.id), suggestion: 'Use an idempotent worker and an atomic deduplicate-plus-increment operation.' });
    record('NFR-03', 'fail', [id]);
  }

  return { findings, requirements, limitations: [
    'Checks validate declared component capabilities, graph connections, and configured capacity values; they do not execute application code.',
    'The unique constraint and atomic deduplication are treated as declared database/store capabilities, not independently verified implementation details.',
    'Capacity checks compare configured throughput with the question targets; they are not production load-test results.',
  ] };
}
