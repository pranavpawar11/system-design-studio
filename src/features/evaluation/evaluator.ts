import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument } from '../architecture/architecture.types';
import type { EvaluationReport, Workload } from './evaluation.types';
import { DEFAULT_WORKLOAD } from './evaluatorDefaults';
import { evaluateRegisteredQuestion } from './evaluatorRegistry';

export type { Workload };
export { DEFAULT_WORKLOAD };

/** Public evaluator entry point. Dispatch is explicit and unsupported questions never fall through. */
export function evaluate(spec: QuestionSpec, doc: ArchitectureDocument, workload: Workload = DEFAULT_WORKLOAD): EvaluationReport {
  return evaluateRegisteredQuestion(spec, doc, workload);
}
