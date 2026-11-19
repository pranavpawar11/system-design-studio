import { useAuthStore } from '../../features/auth/authStore';

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');
export interface LearnerQuestionProgress {
  status: 'IN_PROGRESS' | 'SOLVED';
  evaluatorPassed: boolean;
  manualSolved: boolean;
  manualOverride: boolean;
  solvedBy: 'MANUAL' | 'EVALUATOR' | null;
  startedAt: string;
  solvedAt: string | null;
  lastActivityAt: string;
}
export interface LearnerQuestionItem {
  id: string; slug: string; version: number; title: string; subtitle: string | null;
  category: string; difficulty: string; estimatedMinutes: number | null; tags: string[];
  learning: {
    followUpQuestions?: { id: string; difficulty?: string; category?: string; prompt: string }[];
    referenceSolutions?: { id: string; name: string; difficulty?: string }[];
    revisionRecommendations?: { requirementIds?: string[]; text: string }[];
    [key: string]: unknown;
  } | null;
  progress: LearnerQuestionProgress | null;
}
async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  await useAuthStore.getState().restoreLearner();
  const token = useAuthStore.getState().learnerToken;
  if (!token) throw new Error('Sign in to view and sync HLD question progress.');
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const payload = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? `Question progress request failed (${response.status}).`);
  return payload;
}
export const learnerQuestionProgressApi = {
  list: async () => (await request<{ items: LearnerQuestionItem[] }>('/questions/progress')).items,
  update: (questionId: string, action: 'start' | 'manual_solve' | 'reopen' | 'evaluation', evaluatorPassed?: boolean) =>
    request<LearnerQuestionProgress>(`/questions/${encodeURIComponent(questionId)}/progress`, {
      method: 'POST', body: { action, ...(evaluatorPassed === undefined ? {} : { evaluatorPassed }) },
    }),
};
