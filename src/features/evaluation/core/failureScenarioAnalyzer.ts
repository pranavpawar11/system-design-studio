import type { QuestionSpec } from '../../questions/question.types';
import type { ArchitectureDocument } from '../../architecture/architecture.types';
import { createGraphAnalyzer } from './graphAnalyzer';

export interface FailureProbe {
  id: string;
  title: string;
  sourceComponentId: string;
  targetComponentId: string;
  /** Optional allowed connection types for the path. */
  connectionTypeIds?: string[];
}

export interface FailureScenario {
  id: string;
  title: string;
  description?: string;
  /** Catalogue component IDs that become unavailable in this scenario. */
  failedComponentIds: string[];
  /** Paths that must remain available after the failure. */
  probes: FailureProbe[];
}

export type FailureProbeStatus = 'survives' | 'disrupted' | 'not-available-before-failure' | 'not-modeled';

export interface FailureProbeResult {
  probeId: string;
  title: string;
  status: FailureProbeStatus;
  baselinePathNodeIds: string[];
  baselinePathEdgeIds: string[];
  survivingPathNodeIds: string[];
  survivingPathEdgeIds: string[];
  explanation: string;
}

export interface FailureScenarioResult {
  scenarioId: string;
  title: string;
  failedNodeIds: string[];
  probes: FailureProbeResult[];
  impactedProbeCount: number;
  survivedProbeCount: number;
  limitations: string[];
}

export interface FailureAnalysis {
  scenarios: FailureScenarioResult[];
  limitations: string[];
}

/**
 * Simulates component outages by removing matching nodes and incident edges
 * from a copy of the architecture document, then re-checking directed paths.
 * This is a topology analysis only; it does not model failover timing, state
 * replication, quorum behaviour, or recovery procedures.
 */
export function analyzeFailureScenarios(
  spec: QuestionSpec,
  doc: ArchitectureDocument,
  scenarios: FailureScenario[],
): FailureAnalysis {
  const baseline = createGraphAnalyzer(spec, doc);
  const results: FailureScenarioResult[] = [];

  for (const scenario of scenarios) {
    const failedIds = new Set(scenario.failedComponentIds);
    const failedNodes = doc.nodes.filter((node) => failedIds.has(node.componentId));
    const failedNodeIds = new Set(failedNodes.map((node) => node.id));

    const degradedDoc: ArchitectureDocument = {
      ...doc,
      nodes: doc.nodes.filter((node) => !failedNodeIds.has(node.id)),
      edges: doc.edges.filter((edge) => !failedNodeIds.has(edge.source) && !failedNodeIds.has(edge.target)),
    };
    const degraded = createGraphAnalyzer(spec, degradedDoc);

    const probes: FailureProbeResult[] = scenario.probes.map((probe) => {
      const sources = baseline.findComponents((node) => node.componentId === probe.sourceComponentId);
      const targets = new Set(baseline.findComponents((node) => node.componentId === probe.targetComponentId).map((node) => node.id));
      let baselinePath: { nodeIds: string[]; edgeIds: string[] } | undefined;
      for (const source of sources) {
        baselinePath = baseline.findPath(source.id, (node) => targets.has(node.id), probe.connectionTypeIds);
        if (baselinePath) break;
      }

      if (!baselinePath) {
        return {
          probeId: probe.id, title: probe.title, status: 'not-available-before-failure',
          baselinePathNodeIds: [], baselinePathEdgeIds: [], survivingPathNodeIds: [], survivingPathEdgeIds: [],
          explanation: `The required path from ${probe.sourceComponentId} to ${probe.targetComponentId} does not exist before the failure.`,
        };
      }

      const survivingSources = degraded.findComponents((node) => node.componentId === probe.sourceComponentId);
      const survivingTargets = new Set(degraded.findComponents((node) => node.componentId === probe.targetComponentId).map((node) => node.id));
      let survivingPath: { nodeIds: string[]; edgeIds: string[] } | undefined;
      for (const source of survivingSources) {
        survivingPath = degraded.findPath(source.id, (node) => survivingTargets.has(node.id), probe.connectionTypeIds);
        if (survivingPath) break;
      }

      if (survivingPath) {
        return {
          probeId: probe.id, title: probe.title, status: 'survives',
          baselinePathNodeIds: baselinePath.nodeIds, baselinePathEdgeIds: baselinePath.edgeIds,
          survivingPathNodeIds: survivingPath.nodeIds, survivingPathEdgeIds: survivingPath.edgeIds,
          explanation: 'At least one valid directed path remains after the selected component outage.',
        };
      }

      return {
        probeId: probe.id, title: probe.title, status: 'disrupted',
        baselinePathNodeIds: baselinePath.nodeIds, baselinePathEdgeIds: baselinePath.edgeIds,
        survivingPathNodeIds: [], survivingPathEdgeIds: [],
        explanation: 'The path existed before the failure, but no valid directed path remains afterward.',
      };
    });

    results.push({
      scenarioId: scenario.id,
      title: scenario.title,
      failedNodeIds: [...failedNodeIds],
      probes,
      impactedProbeCount: probes.filter((probe) => probe.status === 'disrupted').length,
      survivedProbeCount: probes.filter((probe) => probe.status === 'survives').length,
      limitations: [
        'Only nodes whose componentId matches failedComponentIds are removed.',
        'A surviving path indicates topological reachability, not proven data consistency or successful failover.',
        'Probe paths absent before the failure are reported separately and are not counted as failure impact.',
      ],
    });
  }

  return {
    scenarios: results,
    limitations: [
      'This analyzer performs static graph failure simulation only.',
      'It does not simulate recovery time, replication lag, quorum, leader election, in-flight requests, retries, or state loss.',
      'Model replicas as separate diagram nodes if they should survive independently.',
    ],
  };
}
