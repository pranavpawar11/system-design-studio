import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument } from '../architecture/architecture.types';
import type { EvaluationReport, Severity } from './evaluation.types';
import { analyzeCapacityTargets, type CapacityTarget } from './core/capacityAnalyzer';
import { analyzeFailureScenarios, type FailureScenario } from './core/failureScenarioAnalyzer';
import {
  evaluateRequirements,
  type RequirementCheck,
  type RequirementRule,
} from './core/requirementEvaluator';

export const EVALUATION_PACKAGE_SCHEMA_VERSION = 1;

export interface DeclarativeEvaluationRule extends RequirementRule {
  /** Stable identifier used by tests, reports and future content publishing. */
  id: string;
  checks: RequirementCheck[];
}

export interface QuestionMetricsDefinition {
  /** Stable key resolved by the shared metrics provider registry. */
  modelId: string;
  trafficLabel: string;
  outageLabel: string;
  lostInstancesLabel: string;
  showCreateRate: boolean;
  /** Optional label for a second workload stream shown beside the primary traffic rate. */
  secondaryTrafficLabel?: string;
  latencyModel?: 'redirect';
}

export interface EvaluationPackage {
  schemaVersion: number;
  questionId: string;
  questionVersion: number;
  packageVersion: string;
  rules: DeclarativeEvaluationRule[];
  /** Explicitly documents what this package does not attempt to prove. */
  limitations?: string[];
  /** Optional deterministic capacity models owned by this question. */
  capacityTargets?: CapacityTarget[];
  /** Optional topology-only outage scenarios owned by this question. */
  failureScenarios?: FailureScenario[];
  /** Question-owned declaration selecting its shared metrics model and UI labels. */
  metrics?: QuestionMetricsDefinition;
}

export interface EvaluationPackageValidationIssue {
  path: string;
  message: string;
}

const severities: Severity[] = ['error', 'warning', 'info', 'not-evaluated'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates a question-owned declarative package before it can be executed.
 * This is intentionally strict: unsupported rule types must fail validation,
 * rather than being silently ignored.
 */
export function validateEvaluationPackage(
  spec: QuestionSpec,
  value: unknown,
): EvaluationPackageValidationIssue[] {
  const issues: EvaluationPackageValidationIssue[] = [];
  if (!isRecord(value)) return [{ path: '$', message: 'Evaluation package must be an object.' }];

  if (value.schemaVersion !== EVALUATION_PACKAGE_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: `Expected schema version ${EVALUATION_PACKAGE_SCHEMA_VERSION}.` });
  }
  if (value.questionId !== spec.question.id) {
    issues.push({ path: 'questionId', message: `Package questionId must match ${spec.question.id}.` });
  }
  if (value.questionVersion !== spec.question.version) {
    issues.push({ path: 'questionVersion', message: `Package questionVersion must match ${spec.question.version}.` });
  }
  if (typeof value.packageVersion !== 'string' || value.packageVersion.trim() === '') {
    issues.push({ path: 'packageVersion', message: 'packageVersion must be a non-empty string.' });
  }
  if (!Array.isArray(value.rules)) {
    issues.push({ path: 'rules', message: 'rules must be an array.' });
    return issues;
  }
  if (value.rules.length === 0) {
    issues.push({ path: 'rules', message: 'rules must contain at least one rule.' });
  }

  const ids = new Set<string>();
  const componentIds = new Set(spec.componentCatalogue.components.map((component) => component.id));
  const checkTypes = new Set(['component_exists', 'config_equals', 'direct_connection', 'path_exists']);

  value.rules.forEach((rawRule, index) => {
    const path = `rules[${index}]`;
    if (!isRecord(rawRule)) {
      issues.push({ path, message: 'Rule must be an object.' });
      return;
    }
    if (typeof rawRule.id !== 'string' || rawRule.id.trim() === '') {
      issues.push({ path: `${path}.id`, message: 'Rule id must be a non-empty string.' });
    } else if (ids.has(rawRule.id)) {
      issues.push({ path: `${path}.id`, message: `Duplicate rule id: ${rawRule.id}.` });
    } else {
      ids.add(rawRule.id);
    }
    for (const field of ['title', 'description']) {
      if (typeof rawRule[field] !== 'string' || rawRule[field].trim() === '') {
        issues.push({ path: `${path}.${field}`, message: `${field} must be a non-empty string.` });
      }
    }
    if (rawRule.severity !== undefined && !severities.includes(rawRule.severity as Severity)) {
      issues.push({ path: `${path}.severity`, message: 'Unsupported severity.' });
    }
    if (!Array.isArray(rawRule.checks) || rawRule.checks.length === 0) {
      issues.push({ path: `${path}.checks`, message: 'Each rule must contain at least one check.' });
      return;
    }

    rawRule.checks.forEach((rawCheck, checkIndex) => {
      const checkPath = `${path}.checks[${checkIndex}]`;
      if (!isRecord(rawCheck) || typeof rawCheck.type !== 'string' || !checkTypes.has(rawCheck.type)) {
        issues.push({ path: `${checkPath}.type`, message: 'Unsupported or missing check type.' });
        return;
      }
      const componentFields: Record<string, string[]> = {
        component_exists: ['componentId'],
        config_equals: ['componentId'],
        direct_connection: ['sourceComponentId', 'targetComponentId'],
        path_exists: ['sourceComponentId', 'targetComponentId'],
      };
      for (const field of componentFields[rawCheck.type]) {
        const componentId = rawCheck[field];
        if (typeof componentId !== 'string' || !componentIds.has(componentId)) {
          issues.push({ path: `${checkPath}.${field}`, message: `Unknown component catalogue ID: ${String(componentId)}.` });
        }
      }
      if (rawCheck.type === 'config_equals' &&
          (typeof rawCheck.key !== 'string' || !rawCheck.key.trim() || !['string', 'number', 'boolean'].includes(typeof rawCheck.value))) {
        issues.push({ path: checkPath, message: 'config_equals requires a key and a string, number or boolean value.' });
      }
      if (rawCheck.type === 'direct_connection' && rawCheck.connectionTypeId !== undefined &&
          (typeof rawCheck.connectionTypeId !== 'string' ||
           !spec.connectionTypes.some((connection) => connection.id === rawCheck.connectionTypeId))) {
        issues.push({ path: `${checkPath}.connectionTypeId`, message: 'Unknown connection type ID.' });
      }
      if (rawCheck.type === 'path_exists' && rawCheck.connectionTypeIds !== undefined) {
        if (!Array.isArray(rawCheck.connectionTypeIds) ||
            rawCheck.connectionTypeIds.some((id) => typeof id !== 'string' ||
              !spec.connectionTypes.some((connection) => connection.id === id))) {
          issues.push({ path: `${checkPath}.connectionTypeIds`, message: 'All connection type IDs must exist in the question catalogue.' });
        }
      }
    });
  });

  const metrics = value.metrics;
  if (metrics !== undefined) {
    if (!isRecord(metrics)) {
      issues.push({ path: 'metrics', message: 'metrics must be an object.' });
    } else {
      for (const field of ['modelId', 'trafficLabel', 'outageLabel', 'lostInstancesLabel']) {
        if (typeof metrics[field] !== 'string' || !metrics[field].trim()) {
          issues.push({ path: `metrics.${field}`, message: `${field} must be a non-empty string.` });
        }
      }
      if (typeof metrics.showCreateRate !== 'boolean') {
        issues.push({ path: 'metrics.showCreateRate', message: 'showCreateRate must be a boolean.' });
      }
      if (metrics.secondaryTrafficLabel !== undefined && (typeof metrics.secondaryTrafficLabel !== 'string' || !metrics.secondaryTrafficLabel.trim())) {
        issues.push({ path: 'metrics.secondaryTrafficLabel', message: 'secondaryTrafficLabel must be a non-empty string when supplied.' });
      }
      if (metrics.latencyModel !== undefined && metrics.latencyModel !== 'redirect') {
        issues.push({ path: 'metrics.latencyModel', message: 'Unsupported latency model.' });
      }
    }
  }

  const capacityTargets = value.capacityTargets;
  if (capacityTargets !== undefined) {
    if (!Array.isArray(capacityTargets)) {
      issues.push({ path: 'capacityTargets', message: 'capacityTargets must be an array.' });
    } else {
      const targetIds = new Set<string>();
      capacityTargets.forEach((raw, index) => {
        const path = `capacityTargets[${index}]`;
        if (!isRecord(raw)) { issues.push({ path, message: 'Capacity target must be an object.' }); return; }
        if (typeof raw.id !== 'string' || !raw.id.trim() || targetIds.has(raw.id)) {
          issues.push({ path: `${path}.id`, message: 'Capacity target ID must be non-empty and unique.' });
        } else targetIds.add(raw.id);
        if (typeof raw.title !== 'string' || !raw.title.trim()) issues.push({ path: `${path}.title`, message: 'Capacity target title is required.' });
        if (typeof raw.componentId !== 'string' || !componentIds.has(raw.componentId)) issues.push({ path: `${path}.componentId`, message: 'Unknown component catalogue ID.' });
        if (!isRecord(raw.model) || !['instances', 'single', 'queue'].includes(String(raw.model.kind))) {
          issues.push({ path: `${path}.model`, message: 'Unsupported capacity model.' });
          return;
        }
        if (typeof raw.model.unit !== 'string' || !raw.model.unit.trim()) issues.push({ path: `${path}.model.unit`, message: 'Capacity model unit is required.' });
        if (raw.model.safeUtilization !== undefined && (typeof raw.model.safeUtilization !== 'number' || raw.model.safeUtilization <= 0 || raw.model.safeUtilization > 1)) {
          issues.push({ path: `${path}.model.safeUtilization`, message: 'safeUtilization must be in (0, 1].' });
        }
        const configKeys = raw.model.kind === 'instances'
          ? ['instancesConfig', 'perInstanceCapacityConfig']
          : raw.model.kind === 'single' ? ['capacityConfig'] : ['arrivalRateConfig', 'processingRateConfig'];
        for (const key of configKeys) if (typeof raw.model[key] !== 'string' || !raw.model[key].trim()) issues.push({ path: `${path}.model.${key}`, message: `${key} is required.` });
        if (raw.model.kind !== 'queue' && (typeof raw.model.load !== 'number' || !Number.isFinite(raw.model.load) || raw.model.load < 0)) {
          issues.push({ path: `${path}.model.load`, message: 'load must be a finite non-negative number.' });
        }
      });
    }
  }

  const failureScenarios = value.failureScenarios;
  if (failureScenarios !== undefined) {
    if (!Array.isArray(failureScenarios)) {
      issues.push({ path: 'failureScenarios', message: 'failureScenarios must be an array.' });
    } else {
      const scenarioIds = new Set<string>();
      failureScenarios.forEach((raw, index) => {
        const path = `failureScenarios[${index}]`;
        if (!isRecord(raw)) { issues.push({ path, message: 'Failure scenario must be an object.' }); return; }
        if (typeof raw.id !== 'string' || !raw.id.trim() || scenarioIds.has(raw.id)) issues.push({ path: `${path}.id`, message: 'Scenario ID must be non-empty and unique.' });
        else scenarioIds.add(raw.id);
        if (typeof raw.title !== 'string' || !raw.title.trim()) issues.push({ path: `${path}.title`, message: 'Scenario title is required.' });
        if (!Array.isArray(raw.failedComponentIds) || raw.failedComponentIds.some((id) => typeof id !== 'string' || !componentIds.has(id))) {
          issues.push({ path: `${path}.failedComponentIds`, message: 'All failedComponentIds must exist in the question catalogue.' });
        }
        if (!Array.isArray(raw.probes) || raw.probes.length === 0) {
          issues.push({ path: `${path}.probes`, message: 'Each failure scenario needs at least one probe.' });
        } else raw.probes.forEach((probe, probeIndex) => {
          const probePath = `${path}.probes[${probeIndex}]`;
          if (!isRecord(probe)) { issues.push({ path: probePath, message: 'Probe must be an object.' }); return; }
          for (const field of ['id', 'title']) if (typeof probe[field] !== 'string' || !probe[field].trim()) issues.push({ path: `${probePath}.${field}`, message: `${field} is required.` });
          for (const field of ['sourceComponentId', 'targetComponentId']) if (typeof probe[field] !== 'string' || !componentIds.has(probe[field] as string)) issues.push({ path: `${probePath}.${field}`, message: 'Unknown component catalogue ID.' });
          if (probe.connectionTypeIds !== undefined && (!Array.isArray(probe.connectionTypeIds) || probe.connectionTypeIds.some((id) => typeof id !== 'string' || !spec.connectionTypes.some((connection) => connection.id === id)))) {
            issues.push({ path: `${probePath}.connectionTypeIds`, message: 'All connection type IDs must exist in the question catalogue.' });
          }
        });
      });
    }
  }

  return issues;
}

/** Executes a validated declarative package and returns the shared report contract. */
export function evaluateDeclarativePackage(
  spec: QuestionSpec,
  doc: ArchitectureDocument,
  evaluationPackage: EvaluationPackage,
): EvaluationReport {
  const issues = validateEvaluationPackage(spec, evaluationPackage);
  if (issues.length) {
    throw new Error(`Invalid evaluation package: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
  }

  const report = evaluateRequirements(spec, doc, evaluationPackage.rules);
  const capacityAnalysis = evaluationPackage.capacityTargets?.length
    ? analyzeCapacityTargets(doc, evaluationPackage.capacityTargets)
    : undefined;
  const failureAnalysis = evaluationPackage.failureScenarios?.length
    ? analyzeFailureScenarios(spec, doc, evaluationPackage.failureScenarios)
    : undefined;
  const analysisFindings = [
    ...(capacityAnalysis?.rows ?? []).map((row) => ({
      id: `CAP-${row.targetId}-${row.nodeId}`,
      ruleId: `CAPACITY-${row.targetId}`,
      severity: (row.status === 'over' ? 'error' : row.status === 'high' ? 'warning' : row.status === 'not-modeled' ? 'not-evaluated' : 'info') as Severity,
      title: `${row.title}: ${row.status}`,
      explanation: row.note,
      nodeIds: [row.nodeId],
      edgeIds: [],
      suggestion: row.status === 'over' ? 'Increase capacity or reduce the modeled load.' : row.status === 'high' ? 'Review headroom and burst assumptions.' : undefined,
    })),
    ...(failureAnalysis?.scenarios ?? []).flatMap((scenario) => scenario.probes
      .filter((probe) => probe.status !== 'survives')
      .map((probe) => ({
        id: `FAIL-${scenario.scenarioId}-${probe.probeId}`,
        ruleId: `FAILURE-${scenario.scenarioId}`,
        severity: (probe.status === 'disrupted' ? 'error' : 'not-evaluated') as Severity,
        title: `${scenario.title}: ${probe.title}`,
        explanation: probe.explanation,
        nodeIds: [...probe.baselinePathNodeIds],
        edgeIds: [...probe.baselinePathEdgeIds],
        suggestion: probe.status === 'disrupted' ? 'Add an independent surviving path or revise the failure assumptions.' : undefined,
      }))),
  ];
  return {
    ...report,
    findings: [...report.findings, ...analysisFindings],
    capacityAnalysis,
    failureAnalysis,
    limitations: [...report.limitations, ...(capacityAnalysis?.limitations ?? []), ...(failureAnalysis?.limitations ?? []), ...(evaluationPackage.limitations ?? [])],
    schemaVersion: EVALUATION_PACKAGE_SCHEMA_VERSION,
    engineVersion: `declarative-${evaluationPackage.packageVersion}`,
    questionId: spec.question.id,
    questionVersion: spec.question.version,
  };
}
