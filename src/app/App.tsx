import { useRoute } from './route';
import StudioApp from './StudioApp';
import LearnApp from '../components/learn/LearnApp';
import HomeLanding from '../components/home/HomeLanding';
import { AdminDashboardPage, AdminLoginPage, LearnerAuthPage } from '../features/auth/AuthPages';

/** Public learning experience and separately protected admin entry points. */
export default function App() {
  const route = useRoute();
  if (route.name === 'admin-login') return <AdminLoginPage />;
  if (route.name === 'admin-dashboard') return <AdminDashboardPage />;
  if (route.name === 'user-login') return <LearnerAuthPage mode="login" />;
  if (route.name === 'user-signup') return <LearnerAuthPage mode="signup" />;
  if (route.name === 'home') return <HomeLanding />;
  if (route.name === 'studio') return <StudioApp />;
  return <LearnApp route={route} />;
}
