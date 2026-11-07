import { api, type DraftResult, type Interview, type Learning, type QuestionSpec, type QuestionSummary, type Snapshot } from './index';
import { getActiveQuestionId } from './preferences';

export interface Session { questions: QuestionSummary[]; question: QuestionSpec; learning: Learning; draft: DraftResult; snapshots: Snapshot[]; interview: Interview | null; warnings: string[] }

/** Everything the app needs before first render. The question itself is required; the rest degrades with a warning. */
export async function loadSession(): Promise<Session> {
  const questions = await api.listQuestions();
  if (!questions.length) throw new Error('No questions are available.');
  const wanted = getActiveQuestionId();
  const id = questions.find((q) => q.id === wanted)?.id ?? questions[0].id;
  const [question, learning] = await Promise.all([api.getQuestion(id), api.getLearning(id)]);
  const warnings: string[] = [];
  const soft = async <T,>(p: Promise<T>, fallback: T, what: string) => { try { return await p; } catch (e) { warnings.push(`Could not load ${what}: ${(e as Error).message}`); return fallback; } };
  const [draft, snapshots, interview] = await Promise.all([
    soft<DraftResult>(api.getDraft(id), { status: 'none' }, 'your saved draft'),
    soft<Snapshot[]>(api.listSnapshots(id), [], 'your snapshots'),
    soft<Interview | null>(api.getInterview(id), null, 'your interview session'),
  ]);
  return { questions, question, learning, draft, snapshots, interview, warnings };
}
