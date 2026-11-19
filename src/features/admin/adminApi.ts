import type { AdminRole } from '../auth/authApi';

export type AdminPermission =
  | 'admin.users.read' | 'admin.users.manage' | 'audit.logs.read'
  | 'questions.read' | 'questions.create' | 'questions.update_draft' | 'questions.delete_draft'
  | 'questions.import' | 'questions.export' | 'questions.submit' | 'questions.review'
  | 'questions.approve' | 'questions.publish' | 'questions.archive'
  | 'learning.read' | 'learning.manage' | 'knowledge_base.read' | 'knowledge_base.manage'
  | 'platform.settings.manage';

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}
export interface Pagination { page: number; pageSize: number; total: number; totalPages: number }
export interface Page<T> { items: T[]; pagination: Pagination }
export interface AuditEntry {
  id: string; actorId: string | null; action: string; resourceType: string;
  resourceId: string | null; metadata: unknown; createdAt: string;
  actor: { id: string; name: string; email: string; role: AdminRole } | null;
}
export type QuestionVersionStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';
export interface CatalogueVersion extends ReviewItem {
  estimatedMinutes: number | null; tags: string[]; publishedAt: string | null;
}

export interface QuestionDraftInput {
  questionId: string; slug: string; title: string; subtitle?: string | null; category: string; difficulty: string;
  estimatedMinutes?: number | null; tags?: string[]; questionSpec: Record<string, unknown>;
  learningContent?: Record<string, unknown> | null; extensions?: Record<string, unknown> | null;
  evaluationData?: Record<string, unknown> | null; sourceSnapshot?: Record<string, unknown> | null;
}
export interface ReviewItem {
  id: string; questionId: string; version: number; status: string; title: string;
  subtitle: string | null; category: string; difficulty: string; createdAt: string;
  updatedAt: string; question: { id: string; slug: string };
  creator: { id: string; name: string; email: string } | null;
}

const base = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');
async function request<T>(token: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${token}` };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: init.method ?? 'GET', headers, credentials: 'include',
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch {
    throw new Error('Could not connect to the server. Check that the backend is running.');
  }
  const payload = await response.json().catch(() => ({})) as { message?: string; error?: string | { message?: string } };
  if (!response.ok) {
    const message = typeof payload.error === 'object' ? payload.error?.message : payload.message;
    throw new Error(message || (response.status === 401 ? 'Your admin session expired. Sign in again.' : `Request failed (${response.status}).`));
  }
  return payload as T;
}
const qs = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
  const value = params.toString(); return value ? `?${value}` : '';
};

export interface ImportConflict { severity: 'ERROR' | 'WARNING'; code: string; file: string; field?: string; message: string }
export interface ImportPreviewItem { file: string; questionId: string | null; slug: string | null; valid: boolean; conflicts: ImportConflict[]; action: 'CREATE' | 'NEW_VERSION' | 'SKIP' }
export interface ImportPreview { total: number; valid: number; invalid: number; warnings: number; items: ImportPreviewItem[] }
export interface ImportResult { file: string; questionId: string | null; status: 'IMPORTED' | 'SKIPPED' | 'FAILED'; message: string }
export type ImportBatchStatus = 'COMPLETED' | 'PARTIAL' | 'FAILED';
export interface ImportHistoryItem {
  id: string; file: string; questionId: string | null; slug: string | null;
  action: string | null; status: 'IMPORTED' | 'SKIPPED' | 'FAILED'; message: string; createdAt: string;
}
export interface ImportHistoryBatch {
  id: string; status: ImportBatchStatus; total: number; selected: number;
  imported: number; skipped: number; failed: number; createdAt: string; completedAt: string;
  admin: { id: string; name: string; email: string };
  items?: ImportHistoryItem[];
}


export const adminApi = {
  previewQuestionImport: async (token: string, files: Record<string, string>) => {
    const response = await fetch(`${base}/admin/questions/import/preview`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ files }) });
    const payload = await response.json().catch(() => ({})) as { previewId?: string; expiresInSeconds?: number; report?: ImportPreview; message?: string; error?: string };
    if (!response.ok || !payload.previewId || !payload.report) throw new Error(payload.message || payload.error || `Preview failed (${response.status}).`);
    return payload as { previewId: string; expiresInSeconds: number; report: ImportPreview };
  },
  applyQuestionImport: (token: string, previewId: string, selectedFiles: string[]) =>
    request<{ result: { total: number; imported: number; skipped: number; failed: number; results: ImportResult[] }; batchId: string }>(token, '/admin/questions/import/apply', { method: 'POST', body: { previewId, selectedFiles } }),
  listImportHistory: (token: string, input: { page?: number; pageSize?: number; status?: ImportBatchStatus } = {}) =>
    request<Page<ImportHistoryBatch>>(token, `/admin/questions/import/history${qs(input)}`),
  getImportHistory: (token: string, id: string) =>
    request<{ batch: ImportHistoryBatch }>(token, `/admin/questions/import/history/${encodeURIComponent(id)}`),

  listUsers: (token: string, input: { page?: number; pageSize?: number; search?: string; role?: AdminRole; status?: 'ACTIVE' | 'DISABLED' }) =>
    request<Page<AdminAccount>>(token, `/admin/users${qs(input)}`),
  createUser: (token: string, input: { name: string; email: string; password: string; role: AdminRole }) =>
    request<{ user: AdminAccount }>(token, '/admin/users', { method: 'POST', body: input }),
  updateRole: (token: string, id: string, role: AdminRole) =>
    request<{ user: AdminAccount }>(token, `/admin/users/${encodeURIComponent(id)}/role`, { method: 'PATCH', body: { role } }),
  updateStatus: (token: string, id: string, status: 'ACTIVE' | 'DISABLED') =>
    request<{ user: AdminAccount }>(token, `/admin/users/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } }),
  listAudit: (token: string, input: { page?: number; pageSize?: number; action?: string; resourceType?: string; resourceId?: string }) =>
    request<Page<AuditEntry>>(token, `/admin/audit-logs${qs(input)}`),
  listReviews: (token: string, page = 1, pageSize = 25) =>
    request<Page<ReviewItem>>(token, `/admin/reviews${qs({ page, pageSize })}`),
  listApproved: (token: string, page = 1, pageSize = 25) =>
    request<Page<ReviewItem>>(token, `/admin/questions/approved${qs({ page, pageSize })}`),
  listCatalogue: (token: string, input: { page?: number; pageSize?: number; status?: QuestionVersionStatus; search?: string }) =>
    request<Page<CatalogueVersion>>(token, `/admin/questions${qs(input)}`),
  getVersion: (token: string, versionId: string) => request<{ version: Record<string, unknown> & { id: string; questionId: string; version: number; status: QuestionVersionStatus; title: string; subtitle: string | null; category: string; difficulty: string; estimatedMinutes: number | null; tags: string[]; questionSpec: Record<string, unknown>; learningContent: Record<string, unknown> | null; extensions: Record<string, unknown> | null; evaluationData: Record<string, unknown> | null; sourceSnapshot: Record<string, unknown> | null; question: { id: string; slug: string } } }>(token, `/admin/questions/versions/${encodeURIComponent(versionId)}`),
  createDraft: (token: string, input: QuestionDraftInput) => request<{ version: { id: string; questionId: string; version: number; status: string; title: string } }>(token, '/admin/questions/drafts', { method: 'POST', body: input }),
  updateDraft: (token: string, versionId: string, input: QuestionDraftInput) => request<{ version: { id: string; questionId: string; version: number; status: string; title: string } }>(token, `/admin/questions/versions/${encodeURIComponent(versionId)}/draft`, { method: 'PATCH', body: input }),
  submitVersion: (token: string, versionId: string) =>
    request<unknown>(token, `/admin/questions/versions/${encodeURIComponent(versionId)}/submit`, { method: 'POST' }),
  approveReview: (token: string, versionId: string) =>
    request<unknown>(token, `/admin/reviews/${encodeURIComponent(versionId)}/approve`, { method: 'POST' }),
  rejectReview: (token: string, versionId: string, comments: string) =>
    request<unknown>(token, `/admin/reviews/${encodeURIComponent(versionId)}/reject`, { method: 'POST', body: { comments } }),
  publishVersion: (token: string, versionId: string) =>
    request<unknown>(token, `/admin/questions/versions/${encodeURIComponent(versionId)}/publish`, { method: 'POST' }),
};
