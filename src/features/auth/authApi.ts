export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'REVIEWER';
export interface AdminUser { id: string; name: string; email: string; role: AdminRole; permissions: string[] }
export interface LearnerUser { id: string; name: string; email: string }
export interface AuthResult<T> { accessToken: string; tokenType: 'Bearer'; user: T }

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

async function request<T>(path: string, options: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new Error('Could not connect to the server. Check that the backend is running.');
  }
  const payload = await response.json().catch(() => ({})) as {
    message?: string;
    error?: string | { message?: string };
  };
  if (!response.ok) {
    const message = typeof payload.error === 'object' ? payload.error.message : payload.message;
    throw new Error(message || (response.status === 401 ? 'Your session has expired. Please sign in again.' : `Request failed (${response.status}).`));
  }
  return payload as T;
}

export const authApi = {
  adminLogin: (email: string, password: string) =>
    request<AuthResult<AdminUser>>('/auth/login', { method: 'POST', body: { email, password } }),
  adminRefresh: () => request<AuthResult<AdminUser>>('/auth/refresh', { method: 'POST' }),
  adminLogout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  learnerLogin: (email: string, password: string) =>
    request<AuthResult<LearnerUser>>('/user-auth/login', { method: 'POST', body: { email, password } }),
  learnerRegister: (name: string, email: string, password: string) =>
    request<AuthResult<LearnerUser>>('/user-auth/register', { method: 'POST', body: { name, email, password } }),
  learnerRefresh: () => request<AuthResult<LearnerUser>>('/user-auth/refresh', { method: 'POST' }),
  learnerLogout: () => request<{ success: boolean }>('/user-auth/logout', { method: 'POST' }),
};
