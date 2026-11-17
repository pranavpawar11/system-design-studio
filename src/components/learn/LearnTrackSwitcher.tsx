import { Code2, Network } from 'lucide-react';
import { links } from '../../app/route';

export default function LearnTrackSwitcher({ current }: { current: 'hld' | 'lld' }) {
  return (
    <nav className="learn-track-switcher" aria-label="Choose learning track">
      <span className="learn-track-label">LEARNING TRACK</span>
      <div className="learn-track-options">
        <a href={links.learn} className={current === 'hld' ? 'active' : ''} aria-current={current === 'hld' ? 'page' : undefined}>
          <Network size={15} aria-hidden /> <span>HLD</span><small>High-Level Design</small>
        </a>
        <a href={links.lldLearn} className={current === 'lld' ? 'active' : ''} aria-current={current === 'lld' ? 'page' : undefined}>
          <Code2 size={15} aria-hidden /> <span>LLD</span><small>Low-Level Design</small>
        </a>
      </div>
    </nav>
  );
}
