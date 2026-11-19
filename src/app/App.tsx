import { useRoute } from './route';
import StudioApp from './StudioApp';
import LearnApp from '../components/learn/LearnApp';
import HomeLanding from '../components/home/HomeLanding';
import { AdminDashboardPage, AdminLoginPage, LearnerAuthPage } from '../features/auth/AuthPages';
import LearnerProfilePage from '../features/profile/LearnerProfilePage';
import { useEffect } from 'react';
import { useAuthStore } from '../features/auth/authStore';

/** Public learning experience and separately protected admin entry points. */
export default function App() {
  const route = useRoute();
  const restoreAdmin = useAuthStore((s) => s.restoreAdmin);
  const restoreLearner = useAuthStore((s) => s.restoreLearner);
  useEffect(() => { void restoreAdmin(); void restoreLearner(); }, [restoreAdmin, restoreLearner]);
  if (route.name === 'admin-login') return <AdminLoginPage />;
  if (route.name === 'admin-dashboard') return <AdminDashboardPage />;
  if (route.name === 'user-login') return <LearnerAuthPage mode="login" />;
  if (route.name === 'user-signup') return <LearnerAuthPage mode="signup" />;
  if (route.name === 'learner-profile') return <LearnerProfilePage />;
  if (route.name === 'home') return <HomeLanding />;
  if (route.name === 'studio') return <StudioApp />;
  return <LearnApp route={route} />;
}
