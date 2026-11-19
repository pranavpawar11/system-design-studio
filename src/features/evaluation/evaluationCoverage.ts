import type { QuestionSpec } from '../questions/question.types';
import { hasEvaluator } from './evaluatorRegistry';
import { validateEvaluationPackage, type EvaluationPackage } from './evaluationPackage';
import { questionMetricsProviders } from './questionMetrics';

export type EvaluationSupportDeclaration =
  | { status: 'supported' }
  | { status: 'not_supported'; reason: string };

export interface EvaluationFixtureCoverage {
  validDesign: boolean;
  invalidDesign: boolean;
  alternativeValidDesign: boolean;
}

export interface EvaluationCoverageInput {
  spec: QuestionSpec;
  evaluationPackage?: unknown;
  supportDeclaration?: EvaluationSupportDeclaration;
  fixtures?: EvaluationFixtureCoverage;
}

export type EvaluationCoverageIssueCode =
  | 'MISSING_SUPPORT_DECLARATION'
  | 'UNSUPPORTED_WITHOUT_REASON'
  | 'MISSING_EVALUATION_PACKAGE'
  | 'INVALID_EVALUATION_PACKAGE'
  | 'NO_EXECUTABLE_EVALUATOR'
  | 'MISSING_METRICS_DEFINITION'
  | 'UNKNOWN_METRICS_PROVIDER'
  | 'MISSING_VALID_FIXTURE'
  | 'MISSING_INVALID_FIXTURE'
  | 'MISSING_ALTERNATIVE_FIXTURE'
  | 'FIXTURE_INVALID_DOCUMENT'
  | 'FIXTURE_EXPECTATION_MISMATCH'
  | 'FIXTURE_EXECUTION_ERROR';

export interface EvaluationCoverageIssue {
  code: EvaluationCoverageIssueCode;
  path: string;
  message: string;
}

export interface EvaluationCoverageResult {
  questionId: string;
  questionVersion: number;
  status: 'ready' | 'incomplete' | 'not_supported';
  executable: boolean;
  metrics: 'configured' | 'not_configured' | 'not_applicable';
  fixtures: 'complete' | 'incomplete' | 'not_applicable';
  issues: EvaluationCoverageIssue[];
}

/**
 * Audits one question for catalogue publication readiness.
 *
 * A TypeScript evaluator alone is not sufficient: supported questions also need
 * a valid question-owned package, an available metrics provider, and all three
 * deterministic fixture classes. Explicitly unsupported questions are reported
 * separately and are never mistaken for ready evaluations.
 */
export function auditQuestionEvaluationCoverage(input: EvaluationCoverageInput): EvaluationCoverageResult {
  const { spec } = input;
  const issues: EvaluationCoverageIssue[] = [];
  const declaration = input.supportDeclaration;

  if (!declaration) {
    issues.push({
      code: 'MISSING_SUPPORT_DECLARATION',
      path: 'supportDeclaration',
      message: 'Declare whether evaluation is supported or explicitly not supported.',
    });
  }

  if (declaration?.status === 'not_supported') {
    if (!declaration.reason.trim()) {
      issues.push({
        code: 'UNSUPPORTED_WITHOUT_REASON',
        path: 'supportDeclaration.reason',
        message: 'An explicit reason is required when evaluation is not supported.',
      });
    }
    return {
      questionId: spec.question.id,
      questionVersion: spec.question.version,
      status: 'not_supported',
      executable: false,
      metrics: 'not_applicable',
      fixtures: 'not_applicable',
      issues,
    };
  }

  if (input.evaluationPackage === undefined) {
    issues.push({
      code: 'MISSING_EVALUATION_PACKAGE',
      path: 'evaluationPackage',
      message: 'A supported question must provide a question-owned evaluation package.',
    });
  }

  let validPackage: EvaluationPackage | undefined;
  if (input.evaluationPackage !== undefined) {
    const packageIssues = validateEvaluationPackage(spec, input.evaluationPackage);
    if (packageIssues.length) {
      issues.push(...packageIssues.map((issue) => ({
        code: 'INVALID_EVALUATION_PACKAGE' as const,
        path: issue.path,
        message: issue.message,
      })));
    } else {
      validPackage = input.evaluationPackage as EvaluationPackage;
    }
  }

  const executable = hasEvaluator(spec.question.id) || Boolean(validPackage?.rules.length);
  if (!executable) {
    issues.push({
      code: 'NO_EXECUTABLE_EVALUATOR',
      path: 'evaluator',
      message: 'No registered custom evaluator or executable declarative rules are available.',
    });
  }

  let metrics: EvaluationCoverageResult['metrics'] = 'not_configured';
  if (validPackage?.metrics) {
    if (questionMetricsProviders[validPackage.metrics.modelId]) {
      metrics = 'configured';
    } else {
      issues.push({
        code: 'UNKNOWN_METRICS_PROVIDER',
        path: 'metrics.modelId',
        message: `No metrics provider is registered for model "${validPackage.metrics.modelId}".`,
      });
    }
  } else {
    issues.push({
      code: 'MISSING_METRICS_DEFINITION',
      path: 'metrics',
      message: 'A supported question must declare its metrics model.',
    });
  }

  const fixtures = input.fixtures;
  const fixtureChecks: Array<[keyof EvaluationFixtureCoverage, EvaluationCoverageIssueCode, string]> = [
    ['validDesign', 'MISSING_VALID_FIXTURE', 'A valid-design fixture is required.'],
    ['invalidDesign', 'MISSING_INVALID_FIXTURE', 'An invalid-design fixture is required.'],
    ['alternativeValidDesign', 'MISSING_ALTERNATIVE_FIXTURE', 'An alternative valid-design fixture is required.'],
  ];
  for (const [key, code, message] of fixtureChecks) {
    if (!fixtures?.[key]) {
      issues.push({ code, path: `fixtures.${key}`, message });
    }
  }

  return {
    questionId: spec.question.id,
    questionVersion: spec.question.version,
    status: issues.length === 0 ? 'ready' : 'incomplete',
    executable,
    metrics,
    fixtures: fixtureChecks.every(([key]) => Boolean(fixtures?.[key])) ? 'complete' : 'incomplete',
    issues,
  };
}

/** Audits a complete catalogue and returns a stable summary suitable for CI output. */
export function auditEvaluationCatalogue(inputs: EvaluationCoverageInput[]) {
  const questions = inputs.map(auditQuestionEvaluationCoverage);
  return {
    total: questions.length,
    ready: questions.filter((question) => question.status === 'ready').length,
    incomplete: questions.filter((question) => question.status === 'incomplete').length,
    notSupported: questions.filter((question) => question.status === 'not_supported').length,
    questions,
  };
}
