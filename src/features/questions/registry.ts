import urlSpec from '../../data/questions/url-shortener.json';
import urlExt from '../../data/questions/url-shortener.extensions.json';
import urlLearning from '../../data/questions/url-shortener.learning.json';
import rlSpec from '../../data/questions/rate-limiter.json';
import rlLearning from '../../data/questions/rate-limiter.learning.json';
import type { QuestionSpec } from './question.types';
import type { ArchitectureDocument } from '../architecture/architecture.types';
import { mergeExtensions, parseQuestion } from './questionLoader';

export interface Learning {
  followUpQuestions: { id: string; difficulty: string; category: string; prompt: string; expectedAnswerPoints: string[] }[];
  referenceSolutions: { id: string; name: string; difficulty: string; architecture: ArchitectureDocument; flows: { name: string; steps: string[] }[]; strengths: string[]; limitations: string[]; tradeoffs: string[] }[];
  revisionRecommendations: { requirementIds: string[]; text: string }[];
}
export interface QuestionEntry { id: string; spec: QuestionSpec; learning: Learning }

export const RATE_LIMITER_ID = 'hld-rate-limiter-001';
const entries = (): QuestionEntry[] => {
  const url = mergeExtensions(parseQuestion(urlSpec), urlExt as never);
  const rl = parseQuestion(rlSpec);
  return [{ id: url.question.id, spec: url, learning: urlLearning as unknown as Learning }, { id: rl.question.id, spec: rl, learning: rlLearning as unknown as Learning }];
};
export const QUESTION_KEY = 'hld-studio:question:v1';

export function getEntries() { return entries(); }
export function activeEntry(): QuestionEntry {
  const all = entries();
  try { const id = localStorage.getItem(QUESTION_KEY); return all.find((e) => e.id === id) ?? all[0]; } catch { return all[0]; }
}
export function switchQuestion(id: string) {
  try { localStorage.setItem(QUESTION_KEY, id); } catch { /* ignore */ }
  try { window.location.reload(); } catch { /* not available in tests */ }
}
