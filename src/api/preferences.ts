/** Device-level UI preferences. These never go to the server. */
const QUESTION_KEY = 'hld-studio:question:v1';
export const getActiveQuestionId = (): string | null => { try { return localStorage.getItem(QUESTION_KEY); } catch { return null; } };
export function switchQuestion(id: string) {
  try { localStorage.setItem(QUESTION_KEY, id); } catch { /* ignore */ }
  try { window.location.reload(); } catch { /* not available in tests */ }
}
