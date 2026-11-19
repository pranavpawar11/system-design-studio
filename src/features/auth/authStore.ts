import { create } from 'zustand';
import { authApi, type AdminUser, type LearnerUser } from './authApi';

let adminRestorePromise: Promise<boolean> | null = null;

type AuthState = {
  adminUser: AdminUser | null;
  adminToken: string | null;
  adminStatus: 'unknown' | 'authenticated' | 'anonymous';
  learnerUser: LearnerUser | null;
  learnerToken: string | null;
  hasAdminPermission: (permission: string) => boolean;
  adminLogin: (email: string, password: string) => Promise<void>;
  restoreAdmin: () => Promise<boolean>;
  adminLogout: () => Promise<void>;
  learnerLogin: (email: string, password: string) => Promise<void>;
  learnerRegister: (name: string, email: string, password: string) => Promise<void>;
  learnerLogout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  adminUser: null,
  adminToken: null,
  adminStatus: 'unknown',
  learnerUser: null,
  learnerToken: null,
  hasAdminPermission: (permission) => get().adminUser?.permissions.includes(permission) ?? false,

  adminLogin: async (email, password) => {
    const result = await authApi.adminLogin(email, password);
    set({ adminUser: result.user, adminToken: result.accessToken, adminStatus: 'authenticated' });
  },
  restoreAdmin: async () => {
    if (get().adminStatus === 'authenticated' && get().adminToken) return true;
    if (adminRestorePromise) return adminRestorePromise;
    adminRestorePromise = (async () => {
      try {
        const result = await authApi.adminRefresh();
        set({ adminUser: result.user, adminToken: result.accessToken, adminStatus: 'authenticated' });
        return true;
      } catch {
        set({ adminUser: null, adminToken: null, adminStatus: 'anonymous' });
        return false;
      } finally {
        adminRestorePromise = null;
      }
    })();
    return adminRestorePromise;
  },
  adminLogout: async () => {
    try { await authApi.adminLogout(); }
    finally { set({ adminUser: null, adminToken: null, adminStatus: 'anonymous' }); }
  },
  learnerLogin: async (email, password) => {
    const result = await authApi.learnerLogin(email, password);
    set({ learnerUser: result.user, learnerToken: result.accessToken });
  },
  learnerRegister: async (name, email, password) => {
    const result = await authApi.learnerRegister(name, email, password);
    set({ learnerUser: result.user, learnerToken: result.accessToken });
  },
  learnerLogout: async () => {
    try { await authApi.learnerLogout(); }
    finally { set({ learnerUser: null, learnerToken: null }); }
  },
}));
