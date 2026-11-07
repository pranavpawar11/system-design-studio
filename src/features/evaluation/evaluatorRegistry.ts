import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument } from '../architecture/architecture.types';
import type { EvaluationReport, Workload } from './evaluation.types';
import { DEFAULT_WORKLOAD } from './evaluatorDefaults';
import { evaluateUrlShortener } from './evaluators/urlShortenerEvaluator';
import { evaluateRateLimiter } from './rateLimiterEvaluator';
import { evaluateVotingPoll } from './votingPollEvaluator';

export type QuestionEvaluator = (spec: QuestionSpec, doc: ArchitectureDocument, workload: Workload) => EvaluationReport;

const evaluateUrl: QuestionEvaluator = (spec, doc, workload) => evaluateUrlShortener(spec, doc, workload);
const evaluateRate: QuestionEvaluator = (spec, doc, workload) => evaluateRateLimiter(spec, doc, workload.peakRedirectRps);
const evaluatePoll: QuestionEvaluator = (spec, doc) => evaluateVotingPoll(spec, doc);

/** Explicit dispatch only. A question can never inherit another question's evaluator accidentally. */
export const evaluatorRegistry: Readonly<Record<string, QuestionEvaluator>> = Object.freeze({
  'hld-url-shortener-001': evaluateUrl,
  'hld-rate-limiter-001': evaluateRate,
  'hld-polls-001': evaluatePoll,
});

export function getEvaluator(questionId: string): QuestionEvaluator | undefined {
  return evaluatorRegistry[questionId];
}

export function evaluateRegisteredQuestion(
  spec: QuestionSpec,
  doc: ArchitectureDocument,
  workload: Workload = DEFAULT_WORKLOAD,
): EvaluationReport {
  const evaluator = getEvaluator(spec.question.id);
  if (!evaluator) {
    return {
      findings: [{
        id: 'EVALUATOR-UNSUPPORTED', ruleId: 'RULE-EVALUATOR-UNSUPPORTED', severity: 'not-evaluated',
        title: 'No evaluator registered for this question',
        explanation: `Question "${spec.question.id}" has no question-specific evaluator. No requirement checks were run.`,
        nodeIds: [], edgeIds: [],
        suggestion: 'Register an evaluator for this question before interpreting its evaluation results.',
      }],
      requirements: [],
      limitations: ['Evaluation is unavailable because this question has no registered evaluator. No other question evaluator was used.'],
    };
  }
  return evaluator(spec, doc, workload);
}
