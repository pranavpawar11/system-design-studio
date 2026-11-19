/**
 * Backward-compatible public entry point for HLD evaluation.
 * All dispatch now goes through evaluatorRegistry so LocalApi, authoring,
 * tests and future HTTP handlers execute the same question-specific rules.
 */
import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument } from '../architecture/architecture.types';
import type { EvaluationReport, Workload } from './evaluation.types';
import { DEFAULT_WORKLOAD } from './evaluatorDefaults';
import { hasEvaluator, runQuestionEvaluation } from './evaluatorRegistry';

export type { Workload };
export { DEFAULT_WORKLOAD, hasEvaluator };
export {
  EVALUATION_ENGINE_VERSION,
  EVALUATION_REPORT_SCHEMA_VERSION,
  evaluatorRegistry,
  getEvaluator,
  runQuestionEvaluation,
  evaluateRegisteredQuestion,
} from './evaluatorRegistry';
export type { EvaluationContext, EvaluationInput, QuestionEvaluator } from './evaluatorRegistry';

/** Existing frontend/API call signature remains unchanged. */
export function evaluate(
  spec: QuestionSpec,
  doc: ArchitectureDocument,
  workload: Workload = DEFAULT_WORKLOAD,
): EvaluationReport {
  return runQuestionEvaluation({ spec, doc, workload });
}

/** Kept as a named helper for existing authoring and UI code. */
export { hasEvaluator as isQuestionEvaluatorRegistered };
