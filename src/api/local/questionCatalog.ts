import urlSpec from '../../data/questions/url-shortener.json';
import urlExt from '../../data/questions/url-shortener.extensions.json';
import urlLearning from '../../data/questions/url-shortener.learning.json';
import rlSpec from '../../data/questions/rate-limiter.json';
import rlLearning from '../../data/questions/rate-limiter.learning.json';
import pollSpec from '../../data/questions/voting-poll.json';
import pollExt from '../../data/questions/voting-poll.extensions.json';
import pollLearning from '../../data/questions/voting-poll.learning.json';
import { mergeExtensions, parseQuestion } from '../../features/questions/questionLoader';
import { ApiError, type Learning, type QuestionSpec, type QuestionSummary } from '../contracts';

/** Bundled question content. This is the only module allowed to import src/data. A real back end replaces it. */
interface Entry { spec: QuestionSpec; learning: Learning }
let cache: Entry[] | null = null;
const entries = (): Entry[] => {
  cache ??= [
    { spec: mergeExtensions(parseQuestion(urlSpec), urlExt as never), learning: urlLearning as unknown as Learning },
    { spec: parseQuestion(rlSpec), learning: rlLearning as unknown as Learning },
    { spec: mergeExtensions(parseQuestion(pollSpec), pollExt as never), learning: pollLearning as unknown as Learning },
  ];
  return cache;
};
export const catalogList = (): QuestionSummary[] => entries().map(({ spec }) => ({ id: spec.question.id, title: spec.question.title, difficulty: spec.question.difficulty, estimatedMinutes: (spec.question as { estimatedMinutes?: number }).estimatedMinutes }));
export function catalogGet(id: string): Entry {
  const e = entries().find((x) => x.spec.question.id === id);
  if (!e) throw new ApiError(404, 'NOT_FOUND', `Question “${id}” does not exist.`);
  return e;
}
