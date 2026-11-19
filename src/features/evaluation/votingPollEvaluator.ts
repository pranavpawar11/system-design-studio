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

  // NFR-01: the full vote-submission path must sustain peak vote traffic.
  // The Poll API is shared by vote submissions and result reads, so its load is combined.
  const targetVotes = Number((spec.requirements as any)?.nonFunctional?.find((r: any) => r.id === 'NFR-01')?.target?.votesPerSecond ?? 5000);
  const targetReads = Number((spec.requirements as any)?.nonFunctional?.find((r: any) => r.id === 'NFR-02')?.target?.resultQueriesPerSecond ?? 10000);
  const apiInstances = Number(api?.config.instances);
  const apiPerInstance = Number(api?.config.capacityPerInstanceRps);
  const apiCapacity = Number.isFinite(apiInstances) && apiInstances > 0 && Number.isFinite(apiPerInstance) && apiPerInstance > 0
    ? apiInstances * apiPerInstance : null;
  const dbWriteCapacity = Number(db?.config.writeCapacityRps);
  const queueIngressCapacity = Number(queue?.config.publishCapacityPerSecond);
  const queueProcessingCapacity = Number(queue?.config.processingCapacityPerSecond);
  const workerCapacity = Number(worker?.config.instances) * Number(worker?.config.capacityPerInstancePerSecond);
  const combinedApiLoad = targetVotes + targetReads;

  const nfr01Checks = [
    { label: 'Poll API', node: api, load: combinedApiLoad, capacity: apiCapacity, reason: 'shared vote submissions and result queries' },
    { label: 'Durable vote database', node: db, load: targetVotes, capacity: dbWriteCapacity, reason: 'durable vote writes' },
    { label: 'Queue ingress', node: queue, load: targetVotes, capacity: queueIngressCapacity, reason: 'event publishing/ingress' },
    { label: 'Queue processing', node: queue, load: targetVotes, capacity: queueProcessingCapacity, reason: 'event processing throughput' },
    { label: 'Aggregation workers', node: worker, load: targetVotes, capacity: workerCapacity, reason: 'vote aggregation throughput' },
  ];
  const nfr01KnownBottlenecks = nfr01Checks.filter((check) =>
    !!check.node && Number.isFinite(check.capacity) && (check.capacity as number) < check.load);
  const nfr01Unknown = nfr01Checks.filter((check) => !check.node || !Number.isFinite(check.capacity));
  if (nfr01KnownBottlenecks.length > 0) {
    const id = add({
      ruleId: 'RULE-POLL-NFR-01',
      severity: 'warning',
      requirementId: 'NFR-01',
      title: 'Vote submission path capacity is below target',
      explanation: [
        ...nfr01KnownBottlenecks.map((check) =>
          `${check.label}: ${Number(check.capacity).toLocaleString()} req/s capacity is below ${check.load.toLocaleString()} req/s required for ${check.reason}.`
        ),
        ...(nfr01Unknown.length ? [`Not evaluated: capacity is not declared for ${nfr01Unknown.map((check) => check.label).join(', ')}.`] : []),
      ].join(' '),
      nodeIds: [...new Set(nfr01KnownBottlenecks.map((check) => check.node!.id))],
      suggestion: 'Increase the capacity of each limiting component. The Poll API must cover vote submissions plus result queries because both share its configured capacity.',
    });
    record('NFR-01', 'fail', [id], [...new Set(nfr01Checks.filter((check) => check.node).map((check) => check.node!.id))]);
  } else if (nfr01Unknown.length > 0) {
    record('NFR-01', 'not-evaluated');
  } else {
    record('NFR-01', 'pass', [], [...new Set(nfr01Checks.map((check) => check.node!.id))]);
  }

  // NFR-02: result reads traverse the API and counter store. Both share capacity
  // with vote submissions / aggregation updates, so combined load is checked.
  const counterCapacity = Number(counter?.config.opsCapacityRps);
  const counterLoad = targetReads + targetVotes;
  const nfr02Checks = [
    { label: 'Poll API', node: api, load: combinedApiLoad, capacity: apiCapacity },
    { label: 'Poll Option Counters', node: counter, load: counterLoad, capacity: counterCapacity },
  ];
  const nfr02KnownBottlenecks = nfr02Checks.filter((check) =>
    !!check.node && Number.isFinite(check.capacity) && (check.capacity as number) < check.load);
  const nfr02Unknown = nfr02Checks.filter((check) => !check.node || !Number.isFinite(check.capacity));
  if (nfr02KnownBottlenecks.length > 0) {
    const id = add({
      ruleId: 'RULE-POLL-NFR-02',
      severity: 'warning',
      requirementId: 'NFR-02',
      title: 'Poll result serving path capacity is below target',
      explanation: nfr02KnownBottlenecks.map((check) =>
        `${check.label}: ${Number(check.capacity).toLocaleString()} ops/sec capacity is below ${check.load.toLocaleString()} ops/sec combined load.`
      ).join(' '),
      nodeIds: [...new Set(nfr02KnownBottlenecks.map((check) => check.node!.id))],
      suggestion: 'Increase Poll API capacity for combined vote and result traffic, and increase counter-store operations capacity for result reads plus aggregation updates.',
    });
    record('NFR-02', 'fail', [id], [...new Set(nfr02Checks.filter((check) => check.node).map((check) => check.node!.id))]);
  } else if (nfr02Unknown.length > 0) {
    record('NFR-02', 'not-evaluated');
  } else {
    record('NFR-02', 'pass', [], [...new Set(nfr02Checks.map((check) => check.node!.id))]);
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
