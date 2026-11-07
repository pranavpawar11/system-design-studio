import type { ArchitectureDocument, ArchNode } from '../../architecture/architecture.types';

export type CapacityStatus = 'ok' | 'high' | 'over' | 'not-modeled';
export type CapacityModel =
  | {
      kind: 'instances';
      instancesConfig: string;
      perInstanceCapacityConfig: string;
      load: number;
      unit: string;
      safeUtilization?: number;
    }
  | {
      kind: 'single';
      capacityConfig: string;
      load: number;
      unit: string;
      safeUtilization?: number;
    }
  | {
      kind: 'queue';
      arrivalRateConfig: string;
      processingRateConfig: string;
      unit: string;
      safeUtilization?: number;
    };

export interface CapacityTarget {
  id: string;
  title: string;
  /** Match by component catalogue ID, not display name or UI label. */
  componentId: string;
  model: CapacityModel;
}

export interface CapacityRow {
  targetId: string;
  title: string;
  nodeId: string;
  componentId: string;
  load: number | null;
  capacity: number | null;
  utilization: number | null;
  status: CapacityStatus;
  unit: string;
  note: string;
}

export interface CapacityAnalysis {
  rows: CapacityRow[];
  bottleneckNodeId?: string;
  assumptions: string[];
  limitations: string[];
}

const DEFAULT_SAFE_UTILIZATION = 0.7;

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function statusFor(utilization: number | null, safe: number): CapacityStatus {
  if (utilization === null) return 'not-modeled';
  if (utilization > 1) return 'over';
  if (utilization > safe) return 'high';
  return 'ok';
}

function configNumber(node: ArchNode, key: string): number | undefined {
  const value = node.config[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Generic capacity analysis driven by explicit per-question targets.
 * It does not guess loads, component capacities, or missing configuration.
 */
export function analyzeCapacityTargets(
  doc: ArchitectureDocument,
  targets: CapacityTarget[],
): CapacityAnalysis {
  const rows: CapacityRow[] = [];
  const assumptions = [
    'A default 70% utilization threshold is used only when a target does not specify safeUtilization.',
    'Instance capacity is assumed to scale linearly with the configured instance count.',
  ];
  const limitations = [
    'The analyzer evaluates only explicitly supplied loads and component configuration.',
    'It does not infer traffic distribution, replication overhead, burst duration, network limits, or downstream fan-out.',
    'Missing or invalid capacity configuration is reported as not modeled, not treated as zero capacity.',
    'Queue stability is assessed using arrival rate versus processing rate; this alone does not model backlog drain time or message age.',
  ];

  for (const target of targets) {
    const matches = doc.nodes.filter((node) => node.componentId === target.componentId);
    if (!matches.length) continue;
    const safe = target.model.safeUtilization ?? DEFAULT_SAFE_UTILIZATION;
    if (!Number.isFinite(safe) || safe <= 0 || safe > 1) {
      throw new Error(`Invalid safeUtilization for capacity target ${target.id}; expected (0, 1].`);
    }

    for (const node of matches) {
      let load: number | null = null;
      let capacity: number | null = null;
      let utilization: number | null = null;
      let note = '';

      if (target.model.kind === 'instances') {
        load = target.model.load;
        const instances = configNumber(node, target.model.instancesConfig);
        const perInstance = configNumber(node, target.model.perInstanceCapacityConfig);
        if (finiteNonNegative(load) && instances !== undefined && perInstance !== undefined && instances > 0) {
          capacity = instances * perInstance;
          utilization = capacity > 0 ? load / capacity : (load === 0 ? 0 : null);
          note = `${instances} instance(s) × ${perInstance} ${target.model.unit} per instance.`;
        } else {
          note = 'Load, positive instance count, or per-instance capacity is missing or invalid.';
        }
      } else if (target.model.kind === 'single') {
        load = target.model.load;
        const configuredCapacity = configNumber(node, target.model.capacityConfig);
        if (finiteNonNegative(load) && configuredCapacity !== undefined && configuredCapacity > 0) {
          capacity = configuredCapacity;
          utilization = load / capacity;
          note = `Configured capacity: ${configuredCapacity} ${target.model.unit}.`;
        } else {
          note = 'Load or positive configured capacity is missing or invalid.';
        }
      } else {
        const arrival = configNumber(node, target.model.arrivalRateConfig);
        const processing = configNumber(node, target.model.processingRateConfig);
        if (arrival !== undefined && processing !== undefined && processing > 0) {
          load = arrival;
          capacity = processing;
          utilization = arrival / processing;
          note = `Arrival rate ${arrival} ${target.model.unit}; processing rate ${processing} ${target.model.unit}.`;
        } else {
          note = 'Queue arrival rate or positive processing rate is missing or invalid.';
        }
      }

      rows.push({
        targetId: target.id,
        title: target.title,
        nodeId: node.id,
        componentId: node.componentId,
        load,
        capacity,
        utilization,
        status: statusFor(utilization, safe),
        unit: target.model.unit,
        note,
      });
    }
  }

  const ranked = rows
    .filter((row) => row.utilization !== null)
    .sort((a, b) => (b.utilization ?? 0) - (a.utilization ?? 0));
  return { rows, bottleneckNodeId: ranked[0]?.nodeId, assumptions, limitations };
}
