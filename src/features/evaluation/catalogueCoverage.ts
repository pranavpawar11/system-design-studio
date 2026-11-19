import { mergeExtensions, parseQuestion } from '../questions/questionLoader';
import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument } from '../architecture/architecture.types';
import { auditQuestionEvaluationCoverage, type EvaluationCoverageInput, type EvaluationCoverageIssue, type EvaluationCoverageResult } from './evaluationCoverage';
import { runQuestionEvaluation } from './evaluatorRegistry';
import type { EvaluationPackage } from './evaluationPackage';

interface CoverageSidecar {
  schemaVersion: number;
  questionId: string;
  status: 'supported' | 'not_supported';
  reason?: string;
  fixtures?: { validDesign?: string; invalidDesign?: string; alternativeValidDesign?: string };
}
interface CatalogueAuditQuestion extends EvaluationCoverageResult {
  title: string;
  fixtureChecks: { validDesign: boolean; invalidDesign: boolean; alternativeValidDesign: boolean };
}

const questionFiles = import.meta.glob('../../data/questions/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const fixtureFiles = import.meta.glob('../../tests/fixtures/evaluation-coverage/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const fixtureByName = new Map(Object.entries(fixtureFiles).map(([path, value]) => [path.split('/').pop() ?? path, value]));
const fileStem = (path: string) => (path.split('/').pop() ?? '').replace(/\.json$/, '');

function resolveFixture(reference: string | undefined): unknown {
  if (!reference) return undefined;
  return fixtureByName.get(reference.split('/').pop() ?? reference);
}

function isPassing(report: ReturnType<typeof runQuestionEvaluation>): boolean {
  return report.requirements.length > 0 && report.requirements.some((item) => item.status === 'pass') && report.requirements.every((item) => item.status !== 'fail');
}
function isFailing(report: ReturnType<typeof runQuestionEvaluation>): boolean {
  return report.requirements.some((item) => item.status === 'fail');
}

/**
 * Audits every bundled question and executes its declared deterministic fixtures.
 * This is the catalogue publication gate; no question JSON is silently omitted.
 */
export function auditBundledEvaluationCatalogue() {
  const groups = new Map<string, { spec?: unknown; evaluation?: unknown; extensions?: unknown; coverage?: unknown }>();
  for (const [path, value] of Object.entries(questionFiles)) {
    const stem = fileStem(path);
    const match = /^(.*)\.(evaluation|extensions|coverage|learning)$/.exec(stem);
    if (match?.[2] === 'learning') continue;
    const key = match?.[1] ?? stem;
    const group = groups.get(key) ?? {};
    if (!match) group.spec = value;
    else if (match[2] === 'evaluation') group.evaluation = value;
    else if (match[2] === 'extensions') group.extensions = value;
    else if (match[2] === 'coverage') group.coverage = value;
    groups.set(key, group);
  }

  const results: CatalogueAuditQuestion[] = [];
  const loadIssues: Array<{ file: string; message: string }> = [];
  for (const [slug, group] of groups) {
    if (!group.spec) continue;
    try {
      const base = parseQuestion(group.spec);
      const spec: QuestionSpec = group.extensions ? mergeExtensions(base, group.extensions as never) : base;
      const declaration = group.coverage as CoverageSidecar | undefined;
      const declarationValid = !declaration || (declaration.schemaVersion === 1 && declaration.questionId === spec.question.id && ['supported', 'not_supported'].includes(declaration.status));
      if (!declarationValid) {
        loadIssues.push({ file: `${slug}.coverage.json`, message: 'Coverage sidecar must use schemaVersion 1, match the questionId and declare a supported status.' });
      }
      const packageValue = group.evaluation as EvaluationPackage | undefined;
      const fixtureRefs = declaration?.fixtures;
      const fixtureDocs = {
        validDesign: resolveFixture(fixtureRefs?.validDesign) as ArchitectureDocument | undefined,
        invalidDesign: resolveFixture(fixtureRefs?.invalidDesign) as ArchitectureDocument | undefined,
        alternativeValidDesign: resolveFixture(fixtureRefs?.alternativeValidDesign) as ArchitectureDocument | undefined,
      };
      const checks = { validDesign: false, invalidDesign: false, alternativeValidDesign: false };
      const fixtureIssues: EvaluationCoverageIssue[] = [];
      const supportDeclaration = !declarationValid ? undefined : declaration?.status === 'not_supported'
        ? { status: 'not_supported' as const, reason: declaration.reason ?? '' }
        : declaration?.status === 'supported' ? { status: 'supported' as const } : undefined;

      if (supportDeclaration?.status === 'supported' && packageValue) {
        (Object.keys(fixtureDocs) as Array<keyof typeof fixtureDocs>).forEach((kind) => {
          const doc = fixtureDocs[kind];
          if (!doc) return;
          if (doc.questionId !== spec.question.id || doc.questionVersion !== spec.question.version) {
            fixtureIssues.push({ code: 'FIXTURE_INVALID_DOCUMENT', path: `fixtures.${kind}`, message: 'Fixture question identity/version does not match its question.' });
            return;
          }
          try {
            const report = runQuestionEvaluation({ spec, doc, evaluationPackage: packageValue });
            const matches = kind === 'invalidDesign' ? isFailing(report) : isPassing(report);
            checks[kind] = matches;
            if (!matches) fixtureIssues.push({ code: 'FIXTURE_EXPECTATION_MISMATCH', path: `fixtures.${kind}`, message: kind === 'invalidDesign' ? 'Invalid-design fixture did not produce a failing requirement.' : 'Valid-design fixture contains a failing requirement or no passing requirement.' });
          } catch (error) {
            fixtureIssues.push({ code: 'FIXTURE_EXECUTION_ERROR', path: `fixtures.${kind}`, message: error instanceof Error ? error.message : 'Fixture evaluation failed.' });
          }
        });
      }

      const input: EvaluationCoverageInput = {
        spec,
        evaluationPackage: packageValue,
        supportDeclaration,
        fixtures: checks,
      };
      const audited = auditQuestionEvaluationCoverage(input);
      const issues = [...audited.issues, ...fixtureIssues];
      results.push({
        ...audited,
        status: audited.status === 'not_supported' ? 'not_supported' : issues.length ? 'incomplete' : 'ready',
        issues,
        title: spec.question.title,
        fixtureChecks: checks,
      });
    } catch (error) {
      loadIssues.push({ file: `${slug}.json`, message: error instanceof Error ? error.message : 'Question could not be audited.' });
    }
  }

  const report = {
    total: results.length + loadIssues.length,
    ready: results.filter((item) => item.status === 'ready').length,
    incomplete: results.filter((item) => item.status === 'incomplete').length + loadIssues.length,
    notSupported: results.filter((item) => item.status === 'not_supported').length,
    questions: results,
    loadIssues,
  };
  return report;
}
