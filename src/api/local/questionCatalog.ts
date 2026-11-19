import { mergeExtensions, parseQuestion } from '../../features/questions/questionLoader';
import { validateEvaluationPackage, type EvaluationPackage } from '../../features/evaluation/evaluationPackage';
import { ApiError, type Learning, type QuestionSpec, type QuestionSummary } from '../contracts';

/**
 * Bundled question content. Every file in src/data/questions is discovered automatically:
 *   <slug>.json              the question          (required)
 *   <slug>.learning.json     follow-ups and learning material (optional)
 *   <slug>.extensions.json   legacy catalogue extensions (optional)
 *   <slug>.evaluation.json   question-owned evaluation package (optional)
 * This is the only module allowed to read src/data. A real back end replaces it.
 */
const files = import.meta.glob('../../data/questions/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
interface Entry { spec: QuestionSpec; learning: Learning; evaluationPackage?: EvaluationPackage }
interface QuestionFileGroup { spec?: unknown; learning?: unknown; ext?: unknown; evaluation?: unknown }
const NO_LEARNING: Learning = { followUpQuestions: [], referenceSolutions: [], revisionRecommendations: [] };
const RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

/** Groups sidecar JSON files without treating them as independent questions. */
export function groupQuestionFiles(input: Record<string, unknown>): Map<string, QuestionFileGroup> {
  const groups = new Map<string, QuestionFileGroup>();
  for (const [path, content] of Object.entries(input)) {
    const name = (path.split('/').pop() ?? '').replace(/\.json$/, '');
    const match = /^(.*)\.(learning|extensions|evaluation)$/.exec(name);
    const stem = match ? match[1] : name;
    const group = groups.get(stem) ?? {};
    if (!match) group.spec = content;
    else if (match[2] === 'learning') group.learning = content;
    else if (match[2] === 'extensions') group.ext = content;
    else group.evaluation = content;
    groups.set(stem, group);
  }
  return groups;
}

function load(): Entry[] {
  const out: Entry[] = [];
  for (const [stem, group] of groupQuestionFiles(files)) {
    if (!group.spec) continue;
    try {
      const base = parseQuestion(group.spec);
      const spec = group.ext ? mergeExtensions(base, group.ext as never) : base;
      let evaluationPackage: EvaluationPackage | undefined;
      if (group.evaluation !== undefined) {
        const issues = validateEvaluationPackage(spec, group.evaluation);
        if (issues.length) {
          console.error(`Evaluation package for "${stem}" was ignored: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
        } else {
          evaluationPackage = group.evaluation as EvaluationPackage;
        }
      }
      out.push({ spec, learning: (group.learning as Learning | undefined) ?? NO_LEARNING, evaluationPackage });
    } catch (e) {
      console.error(`Question file "${stem}.json" was skipped: ${(e as Error).message}`);
    }
  }
  return out.sort((a, b) => (RANK[a.spec.question.difficulty] ?? 9) - (RANK[b.spec.question.difficulty] ?? 9) || a.spec.question.title.localeCompare(b.spec.question.title));
}
const entries = () => (cache ??= load());
let cache: Entry[] | null = null;

export const catalogList = (): QuestionSummary[] => entries().map(({ spec }) => ({ id: spec.question.id, title: spec.question.title, difficulty: spec.question.difficulty, estimatedMinutes: (spec.question as { estimatedMinutes?: number }).estimatedMinutes }));
export function catalogGet(id: string): Entry {
  const entry = entries().find((item) => item.spec.question.id === id);
  if (!entry) throw new ApiError(404, 'NOT_FOUND', `Question “${id}” does not exist.`);
  return entry;
}
