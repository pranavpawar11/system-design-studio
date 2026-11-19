import type { ApiClient } from './contracts';
import { HttpApi } from './http/HttpApi';
import { LocalApi } from './local/LocalApi';
import { useAuthStore } from '../features/auth/authStore';

/**
 * The single place the back end is chosen.
 *   VITE_API_MODE=local (default)  → browser storage and bundled questions
 *   VITE_API_MODE=http             → REST at VITE_API_BASE_URL (default /api/v1)
 * See docs/API.md for the contract and .env.example for the variables.
 */
function create(): ApiClient {
  const env = import.meta.env;
  if (env.VITE_API_MODE === 'http') return new HttpApi({ baseUrl: env.VITE_API_BASE_URL ?? '/api/v1', getToken: () => useAuthStore.getState().learnerToken });
  return new LocalApi(Number(env.VITE_API_LATENCY_MS ?? 0) || 0);
}
export const api: ApiClient = create();
export * from './contracts';
