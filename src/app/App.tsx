import { useRoute } from './route';
import StudioApp from './StudioApp';
import LearnApp from '../components/learn/LearnApp';
import HomeLanding from '../components/home/HomeLanding';

/** Public landing, HLD workspace, and learning experiences share one application shell. */
export default function App() {
  const route = useRoute();
  if (route.name === 'home') return <HomeLanding />;
  if (route.name === 'studio') return <StudioApp />;
  return <LearnApp route={route} />;
}
