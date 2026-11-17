import type { LessonBlock } from '../../features/learning/types';
import Inline from './Inline';

export default function BlockView({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case 'heading': return block.level === 3 ? <h4 className="lesson-h">{block.text}</h4> : <h3 className="lesson-h">{block.text}</h3>;
    case 'paragraph': return <p><Inline text={block.text} /></p>;
    case 'list': { const L = block.ordered ? 'ol' : 'ul'; return <L>{block.items.map((x) => <li key={x}><Inline text={x} /></li>)}</L>; }
    case 'callout': return <aside className={`note ${block.tone}`} role="note">{block.title && <b>{block.title}</b>}<p><Inline text={block.text} /></p></aside>;
    case 'example': return <aside className="example"><b>Example: {block.title}</b><p><Inline text={block.text} /></p></aside>;
    case 'formula': return (
      <figure className="formula">
        <code translate="no">{block.expression}</code>
        {block.caption && <figcaption>{block.caption}</figcaption>}
        {block.variables && <dl>{block.variables.map((v) => <div key={v.name}><dt>{v.name}</dt><dd>{v.meaning}</dd></div>)}</dl>}
      </figure>
    );
  }
}
