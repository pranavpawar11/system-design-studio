import { links } from '../../app/route';

export default function ModeNav({ current }: { current: 'studio' | 'learn' }) {
  return (
    <nav className="modenav" aria-label="Main">
      <a href={links.learn} aria-current={current === 'learn' ? 'page' : undefined}>Learn</a>
      <a href={links.studio} aria-current={current === 'studio' ? 'page' : undefined}>Studio</a>
    </nav>
  );
}
