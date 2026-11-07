import type { QuestionSpec } from '../../questions/question.types';
import type { ArchitectureDocument, ArchNode } from '../../architecture/architecture.types';
import type { EvaluationReport, Finding, RequirementResult, Severity } from '../evaluation.types';
import { createGraphAnalyzer } from './graphAnalyzer';

export type RequirementCheck =
  | { type: 'component_exists'; componentId: string }
  | { type: 'config_equals'; componentId: string; key: string; value: string | number | boolean }
  | { type: 'direct_connection'; sourceComponentId: string; targetComponentId: string; connectionTypeId?: string }
  | { type: 'path_exists'; sourceComponentId: string; targetComponentId: string; connectionTypeIds?: string[] };

export interface RequirementRule {
  id: string;
  title: string;
  description: string;
  severity?: Severity;
  checks: RequirementCheck[];
  /** Optional learner-facing remediation shown when one or more checks fail. */
  suggestion?: string;
}

export interface RequirementEvaluationOptions {
  /** Defaults to error for failed requirements. */
  severity?: Severity;
}

/**
 * Evaluates declarative, diagram-verifiable requirements.
 * All checks in a requirement are ANDed. This deliberately does not infer
 * application behaviour that is not represented in the diagram/configuration.
 */
export function evaluateRequirements(
  spec: QuestionSpec,
  doc: ArchitectureDocument,
  rules: RequirementRule[],
  options: RequirementEvaluationOptions = {},
): EvaluationReport {
  const graph = createGraphAnalyzer(spec, doc);
  const findings: Finding[] = [];
  const requirements: RequirementResult[] = [];
  let findingSequence = 0;

  const nodesFor = (componentId: string): ArchNode[] =>
    graph.findComponents((node) => node.componentId === componentId);

  for (const rule of rules) {
    const evidenceNodes = new Set<string>();
    const evidenceEdges = new Set<string>();
    const failedChecks: string[] = [];

    for (const check of rule.checks) {
      if (check.type === 'component_exists') {
        const matches = nodesFor(check.componentId);
        matches.forEach((node) => evidenceNodes.add(node.id));
        if (matches.length === 0) failedChecks.push(`Required component ${check.componentId} is missing.`);
      } else if (check.type === 'config_equals') {
        const matches = nodesFor(check.componentId);
        const valid = matches.filter((node) => node.config[check.key] === check.value);
        valid.forEach((node) => evidenceNodes.add(node.id));
        if (valid.length === 0) failedChecks.push(
          `No ${check.componentId} component declares ${check.key}=${String(check.value)}.`,
        );
      } else if (check.type === 'direct_connection') {
        const sources = nodesFor(check.sourceComponentId);
        const targets = new Set(nodesFor(check.targetComponentId).map((node) => node.id));
        const match = sources.flatMap((source) => graph.findConnections((edge) =>
          edge.source === source.id && targets.has(edge.target) &&
          (!check.connectionTypeId || edge.connectionTypeId === check.connectionTypeId) &&
          graph.hasDirectConnection(edge.source, edge.target, edge.connectionTypeId),
        ));
        match.forEach((edge) => {
          evidenceEdges.add(edge.id);
          evidenceNodes.add(edge.source);
          evidenceNodes.add(edge.target);
        });
        if (match.length === 0) failedChecks.push(
          `No valid directed connection exists from ${check.sourceComponentId} to ${check.targetComponentId}.`,
        );
      } else {
        const sources = nodesFor(check.sourceComponentId);
        const targets = new Set(nodesFor(check.targetComponentId).map((node) => node.id));
        let found: { nodeIds: string[]; edgeIds: string[] } | undefined;
        for (const source of sources) {
          found = graph.findPath(source.id, (node) => targets.has(node.id), check.connectionTypeIds);
          if (found) break;
        }
        if (found) {
          found.nodeIds.forEach((id) => evidenceNodes.add(id));
          found.edgeIds.forEach((id) => evidenceEdges.add(id));
        } else {
          failedChecks.push(`No valid directed path exists from ${check.sourceComponentId} to ${check.targetComponentId}.`);
        }
      }
    }

    if (failedChecks.length === 0) {
      requirements.push({
        requirementId: rule.id,
        status: 'pass',
        findingIds: [],
        evidenceNodeIds: [...evidenceNodes],
      });
      continue;
    }

    const findingId = `REQ-${++findingSequence}`;
    const finding: Finding = {
      id: findingId,
      ruleId: `RULE-${rule.id}`,
      requirementId: rule.id,
      severity: rule.severity ?? options.severity ?? 'error',
      title: rule.title,
      explanation: `${rule.description} ${failedChecks.join(' ')}`,
      nodeIds: [...evidenceNodes],
      edgeIds: [...evidenceEdges],
      suggestion: rule.suggestion,
    };
    findings.push(finding);
    requirements.push({
      requirementId: rule.id,
      status: 'fail',
      findingIds: [findingId],
      evidenceNodeIds: [...evidenceNodes],
    });
  }

  return { findings, requirements, limitations: [
    'Only declared diagram structure and component configuration are evaluated.',
    'Application-level behaviour, data correctness, and operational guarantees require explicit modelling or manual review.',
  ] };
}
