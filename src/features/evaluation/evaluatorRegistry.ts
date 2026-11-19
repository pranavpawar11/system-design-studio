import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument } from '../architecture/architecture.types';
import type { EvaluationReport, Workload } from './evaluation.types';
import { evaluateDeclarativePackage, type EvaluationPackage } from './evaluationPackage';
import { DEFAULT_WORKLOAD } from './evaluatorDefaults';
import { evaluateUrlShortener } from './evaluators/urlShortenerEvaluator';
import { evaluateRateLimiter } from './rateLimiterEvaluator';
import { evaluateVotingPoll } from './votingPollEvaluator';

/**
 * Stable, serializable input to the evaluation runtime.
 * This shape is deliberately independent of React, Zustand, browser storage and HTTP.
 */
export interface EvaluationInput {
  spec: QuestionSpec;
  doc: ArchitectureDocument;
  workload?: Workload;
  /** Optional question-owned declarative package. It runs alongside a custom plugin when both exist. */
  evaluationPackage?: EvaluationPackage;
}

/** Context supplied to every question-specific evaluator plugin. */
export interface EvaluationContext {
  spec: QuestionSpec;
  doc: ArchitectureDocument;
  workload: Workload;
}

/** A question evaluator owns its domain rules but returns the shared report contract. */
export type QuestionEvaluator = (context: EvaluationContext) => EvaluationReport;

export const EVALUATION_ENGINE_VERSION = '1.0.0';
export const EVALUATION_REPORT_SCHEMA_VERSION = 1;

const evaluateUrl: QuestionEvaluator = ({ spec, doc, workload }) =>
  evaluateUrlShortener(spec, doc, workload);
const evaluateRate: QuestionEvaluator = ({ spec, doc, workload }) =>
  evaluateRateLimiter(spec, doc, workload.peakRedirectRps);
const evaluatePoll: QuestionEvaluator = ({ spec, doc }) =>
  evaluateVotingPoll(spec, doc);

/**
 * The only authoritative TypeScript-plugin mapping.
 * Declarative packages and custom plugins are composable: both run when present.
 */
export const evaluatorRegistry: Readonly<Record<string, QuestionEvaluator>> = Object.freeze({
  'hld-url-shortener-001': evaluateUrl,
  'hld-rate-limiter-001': evaluateRate,
  'hld-polls-001': evaluatePoll,
});

export function getEvaluator(questionId: string): QuestionEvaluator | undefined {
  return evaluatorRegistry[questionId];
}

export function hasEvaluator(questionId: string): boolean {
  return Object.prototype.hasOwnProperty.call(evaluatorRegistry, questionId);
}

function getRequirementIds(spec: QuestionSpec): string[] {
  const requirements = spec.requirements as {
    functional?: { id?: string }[];
    nonFunctional?: { id?: string }[];
  } | undefined;

  return [...(requirements?.functional ?? []), ...(requirements?.nonFunctional ?? [])]
    .map((requirement) => requirement.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function unsupportedReport(spec: QuestionSpec): EvaluationReport {
  const requirementIds = getRequirementIds(spec);
  const findingId = 'EVALUATOR-UNSUPPORTED';
  return {
    findings: [{
      id: findingId,
      ruleId: 'RULE-EVALUATOR-UNSUPPORTED',
      severity: 'not-evaluated',
      title: 'No evaluator registered for this question',
      explanation: `Question "${spec.question.id}" has no question-specific evaluator. No requirement checks were run.`,
      nodeIds: [],
      edgeIds: [],
      suggestion: 'Add question-specific evaluation rules and tests before treating this question as automatically evaluated.',
    }],
    requirements: requirementIds.map((requirementId) => ({
      requirementId,
      status: 'not-evaluated',
      findingIds: [findingId],
      evidenceNodeIds: [],
    })),
    limitations: ['Evaluation is unavailable because this question has no registered evaluator. No other question evaluator was used.'],
  };
}

/** Merge independently executed custom and declarative reports without ID collisions. */
function combineReports(custom: EvaluationReport, declarative: EvaluationReport): EvaluationReport {
  const prefix = (report: EvaluationReport, namespace: string): EvaluationReport => {
    const ids = new Map(report.findings.map((finding) => [finding.id, `${namespace}-${finding.id}`]));
    const requirementIds = new Map(
      report.requirements.map((requirement) => [requirement.requirementId, `${namespace}:${requirement.requirementId}`]),
    );
    return {
      ...report,
      findings: report.findings.map((finding) => ({
        ...finding,
        id: ids.get(finding.id)!,
        ruleId: `${namespace}:${finding.ruleId}`,
        ...(finding.requirementId ? { requirementId: requirementIds.get(finding.requirementId) ?? `${namespace}:${finding.requirementId}` } : {}),
      })),
      requirements: report.requirements.map((requirement) => ({
        ...requirement,
        requirementId: requirementIds.get(requirement.requirementId)!,
        findingIds: requirement.findingIds.map((id) => ids.get(id) ?? `${namespace}-${id}`),
      })),
    };
  };
  const left = prefix(custom, 'custom');
  const right = prefix(declarative, 'package');
  return {
    findings: [...left.findings, ...right.findings],
    requirements: [...left.requirements, ...right.requirements],
    limitations: [...new Set([...left.limitations, ...right.limitations])],
    ...(declarative.capacityAnalysis ? { capacityAnalysis: declarative.capacityAnalysis } : {}),
    ...(declarative.failureAnalysis ? { failureAnalysis: declarative.failureAnalysis } : {}),
  };
}

/**
 * Central evaluation entry point. It is pure and can be called by LocalApi today
 * or by a Fastify route later using the same JSON-compatible input contract.
 */
export function runQuestionEvaluation(input: EvaluationInput): EvaluationReport {
  const { spec, doc } = input;
  const workload = input.workload ?? DEFAULT_WORKLOAD;
  const evaluator = getEvaluator(spec.question.id);
  const customReport = evaluator ? evaluator({ spec, doc, workload }) : undefined;
  const declarativeReport = input.evaluationPackage
    ? evaluateDeclarativePackage(spec, doc, input.evaluationPackage)
    : undefined;
  const report = customReport && declarativeReport
    ? combineReports(customReport, declarativeReport)
    : customReport ?? declarativeReport ?? unsupportedReport(spec);

  return {
    ...report,
    schemaVersion: EVALUATION_REPORT_SCHEMA_VERSION,
    engineVersion: report.engineVersion ?? EVALUATION_ENGINE_VERSION,
    questionId: spec.question.id,
    questionVersion: spec.question.version,
  };
}

/** Backward-compatible adapter for existing callers. */
export function evaluateRegisteredQuestion(
  spec: QuestionSpec,
  doc: ArchitectureDocument,
  workload: Workload = DEFAULT_WORKLOAD,
): EvaluationReport {
  return runQuestionEvaluation({ spec, doc, workload });
}
