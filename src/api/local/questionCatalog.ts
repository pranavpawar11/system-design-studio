import { mergeExtensions, parseQuestion } from '../../features/questions/questionLoader';
import { ApiError, type Learning, type QuestionSpec, type QuestionSummary } from '../contracts';

/**
 * Bundled question content. Every file in src/data/questions is discovered automatically:
 *   <slug>.json              the question          (required)
 *   <slug>.learning.json     follow-ups, reference designs, revision advice (recommended)
 *   <slug>.extensions.json   legacy catalogue extensions (optional; new questions do not need it)
 * This is the only module allowed to read src/data. A real back end replaces it.
 */
const files = import.meta.glob('../../data/questions/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
interface Entry { spec: QuestionSpec; learning: Learning }
const NO_LEARNING: Learning = { followUpQuestions: [], referenceSolutions: [], revisionRecommendations: [] };
const RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

let cache: Entry[] | null = null;
function load(): Entry[] {
  const groups = new Map<string, { spec?: unknown; learning?: unknown; ext?: unknown }>();
  for (const [path, content] of Object.entries(files)) {
    const name = (path.split('/').pop() ?? '').replace(/\.json$/, '');
    const m = /^(.*)\.(learning|extensions)$/.exec(name);
    const g = groups.get(m ? m[1] : name) ?? {};
    if (!m) g.spec = content; else if (m[2] === 'learning') g.learning = content; else g.ext = content;
    groups.set(m ? m[1] : name, g);
  }
  const out: Entry[] = [];
  for (const [stem, g] of groups) {
    if (!g.spec) continue;
    try {
      const base = parseQuestion(g.spec);
      out.push({ spec: g.ext ? mergeExtensions(base, g.ext as never) : base, learning: (g.learning as Learning | undefined) ?? NO_LEARNING });
    } catch (e) { console.error(`Question file "${stem}.json" was skipped: ${(e as Error).message}`); }
  }
  return out.sort((a, b) => (RANK[a.spec.question.difficulty] ?? 9) - (RANK[b.spec.question.difficulty] ?? 9) || a.spec.question.title.localeCompare(b.spec.question.title));
}
const entries = () => (cache ??= load());

export const catalogList = (): QuestionSummary[] => entries().map(({ spec }) => ({ id: spec.question.id, title: spec.question.title, difficulty: spec.question.difficulty, estimatedMinutes: (spec.question as { estimatedMinutes?: number }).estimatedMinutes }));
export function catalogGet(id: string): Entry {
  const e = entries().find((x) => x.spec.question.id === id);
  if (!e) throw new ApiError(404, 'NOT_FOUND', `Question “${id}” does not exist.`);
  return e;
}
