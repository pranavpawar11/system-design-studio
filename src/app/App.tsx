import { useRoute } from './route';
import StudioApp from './StudioApp';
import LearnApp from '../components/learn/LearnApp';

/** Two modes in one site: the Studio (practise) and Learn (the roadmap and lessons). */
export default function App() {
  const route = useRoute();
  return route.name === 'studio' ? <StudioApp /> : <LearnApp route={route} />;
}
