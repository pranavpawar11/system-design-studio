/**
 * EVALUATOR TEMPLATE
 *
 * An evaluator is a pure function: (question, design) -> report. It decides, for every requirement in your
 * question file, whether the learner's diagram is MET (pass), NOT MET (fail) or UNVERIFIED (not-evaluated).
 *
 * To use it:
 *   1. Copy to src/features/evaluation/<yourTopic>Evaluator.ts and fix the import paths (../questions/..., ./evaluation.types).
 *   2. Rename the function. Replace the requirement ids with yours (they must match your question file).
 *   3. Register it in src/features/evaluation/evaluator.ts:   'hld-your-topic-001': (spec, doc) => evaluateYourTopic(spec, doc),
 *   4. Write tests (see EVALUATOR-GUIDE.md): one solved design that passes, and one broken design per requirement.
 *
 * The three rules that keep feedback trustworthy:
 *   - Pass only what the diagram PROVES (a path exists, a capability is connected, a number is within range).
 *   - Fail only what the diagram DISPROVES. Say what is missing and how to fix it.
 *   - If a diagram cannot show it (application logic such as "returns 404"), do not guess. Make the learner DECLARE it
 *     in a component setting, and report not-evaluated until they do.
 */
import type { QuestionSpec } from '../../../src/features/questions/question.types';
import type { ArchitectureDocument, ArchNode } from '../../../src/features/architecture/architecture.types';
import { checkConnection } from '../../../src/features/architecture/connectionRules';
import type { EvaluationReport, Finding, RequirementResult } from '../../../src/features/evaluation/evaluation.types';

export function evaluateYourTopic(spec: QuestionSpec, doc: ArchitectureDocument, peakRps = 10000): EvaluationReport {
  const findings: Finding[] = [];
  const reqs: RequirementResult[] = [];
  let seq = 0;
  const add = (f: Omit<Finding, 'id' | 'nodeIds' | 'edgeIds'> & { nodeIds?: string[]; edgeIds?: string[] }) => {
    const id = `F-${++seq}`; findings.push({ nodeIds: [], edgeIds: [], ...f, id }); return id;
  };
  /** evidence = node ids shown when the learner clicks the requirement (highlights the path that proves it) */
  const record = (requirementId: string, status: RequirementResult['status'], findingIds: string[] = [], evidence: string[] = []) =>
    reqs.push({ requirementId, status, findingIds, evidenceNodeIds: [...new Set(evidence)] });

  // STEP 1. Structural checks: every question needs these. They report broken diagrams, not unmet requirements.
  const seen = new Set<string>();
  for (const n of doc.nodes) {
    if (seen.has(n.id)) add({ ruleId: 'RULE-STRUCT-01', severity: 'error', title: 'Duplicate node ID', explanation: `Node ID ${n.id} is used more than once.`, nodeIds: [n.id] });
    seen.add(n.id);
    if (!spec.componentCatalogue.allowedComponentIds.includes(n.componentId)) add({ ruleId: 'RULE-STRUCT-01', severity: 'error', title: 'Unsupported component', explanation: `${n.name} is not available in this question.`, nodeIds: [n.id] });
  }
  for (const e of doc.edges) {
    const r = checkConnection(spec, doc, e.source, e.target, e.connectionTypeId);
    if (!r.ok) add({ ruleId: 'RULE-STRUCT-02', severity: 'error', title: 'Incompatible connection', explanation: r.reason ?? 'Invalid connection.', edgeIds: [e.id], suggestion: 'Change the connection type or reconnect the components.' });
  }

  // STEP 2. Graph helpers. Only VALID edges count as evidence.
  const comps = spec.componentCatalogue.components;
  const has = (n: ArchNode, op: string) => (comps.find((c) => c.id === n.componentId)?.supportedOperations ?? []).includes(op);
  const valid = doc.edges.filter((e) => checkConnection(spec, doc, e.source, e.target, e.connectionTypeId).ok);
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const clients = doc.nodes.filter((n) => has(n, 'http-response')); // entry points
  const reachableFromClients = () => {
    const out = new Set(clients.map((c) => c.id)); const queue = [...out];
    while (queue.length) { const cur = queue.pop()!; for (const e of valid) if (e.source === cur && !out.has(e.target)) { out.add(e.target); queue.push(e.target); } }
    return out;
  };
  const targetsOf = (from: string, edgeType: string) => valid.filter((e) => e.source === from && e.connectionTypeId === edgeType).map((e) => byId.get(e.target)).filter((n): n is ArchNode => !!n);

  // STEP 3. One block per requirement.
  const app = doc.nodes.find((n) => n.componentType === 'application-server');
  const reach = reachableFromClients();

  // FR-01 (example: PATH requirement). Can a request get from a client to the app?
  if (app && reach.has(app.id) && clients.length) record('FR-01', 'pass', [], [clients[0].id, app.id]);
  else record('FR-01', 'fail', [add({ ruleId: 'RULE-FR-01', severity: 'error', requirementId: 'FR-01', title: 'No request path to the application', explanation: 'No client is connected, directly or through other components, to an Application Server.', suggestion: 'Connect Client → … → Application Server.' })]);

  // FR-02 (example: CAPABILITY requirement). Is data written to something durable?
  const store = app ? targetsOf(app.id, 'EDGE-DB-WRITE').find((n) => n.config.durable === true) : undefined;
  if (store && app) record('FR-02', 'pass', [], [app.id, store.id]);
  else record('FR-02', 'fail', [add({ ruleId: 'RULE-FR-02', severity: 'error', requirementId: 'FR-02', title: 'Nothing durable receives the data', explanation: 'The application does not write to a durable data store.', nodeIds: app ? [app.id] : [], suggestion: 'Add a database and connect the application to it with a Database Write edge.' })]);

  // FR-03 (example: DECLARATION requirement). A diagram cannot prove application behaviour, so ask the learner to declare it.
  //   To use: add a config key with an enum to a component in your question file, for example
  //   "defaultConfig": { "behaviour": "undeclared" }, "configSchema": { "behaviour": { "type": "string", "enum": ["undeclared", "handled"] } }
  if (app && app.config.behaviour === 'handled') record('FR-03', 'pass', [], [app.id]);
  else record('FR-03', 'not-evaluated', [add({ ruleId: 'RULE-FR-03', severity: 'not-evaluated', requirementId: 'FR-03', title: 'Behaviour not declared', explanation: 'A diagram cannot show application logic.', nodeIds: app ? [app.id] : [], suggestion: 'Select the Application Server and set “behaviour” to handled.' })]);

  // NFR-01 (example: CAPACITY requirement). Compare modeled load with configured capacity. Say it is modeled.
  if (!app) record('NFR-01', 'not-evaluated');
  else {
    const capacity = Number(app.config.instances) * Number(app.config.capacityPerInstanceRps);
    if (capacity >= peakRps) record('NFR-01', 'pass', [], [app.id]);
    else record('NFR-01', 'fail', [add({ ruleId: 'RULE-NFR-01', severity: 'warning', requirementId: 'NFR-01', title: 'Application capacity too low', explanation: `Configured capacity ${capacity} req/s is below the ${peakRps} req/s peak.`, nodeIds: [app.id], suggestion: 'Add instances or raise capacity per instance.' })], [app.id]);
  }

  // NFR-02 (example: DURABILITY requirement). Reuses the store found above.
  if (store && app) record('NFR-02', 'pass', [], [store.id]);
  else record('NFR-02', 'fail', [add({ ruleId: 'RULE-NFR-02', severity: 'error', requirementId: 'NFR-02', title: 'Data would be lost on restart', explanation: 'No durable store is on the write path.' })]);

  return {
    findings, requirements: reqs,
    limitations: ['Checks use component capabilities and the values you configured.', 'Application behaviour must be declared; it cannot be seen in a diagram.', 'Capacity figures are modeled, not measured.'],
  };
}
