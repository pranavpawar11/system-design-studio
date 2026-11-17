import type { LessonBlock } from '../../features/learning/types';
import Inline from './Inline';

function ExampleContent({ text }: { text: string }) {
  const segments: Array<{ type: 'text' | 'code'; value: string }> = [];
  const pattern = /`([\s\S]*?)`/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) segments.push({ type: 'text', value: text.slice(cursor, match.index) });
    const value = match[1];
    if (value.includes('\n')) segments.push({ type: 'code', value: value.replace(/^\n|\n$/g, '') });
    else segments.push({ type: 'text', value: '`' + value + '`' });
    cursor = pattern.lastIndex;
  }
  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) });
  if (!segments.some((part) => part.type === 'code')) return <p><Inline text={text}/></p>;
  return <div className="lesson-example-content">{segments.map((part, i) => part.type === 'code'
    ? <pre className="lesson-code-block" key={i}><code translate="no">{part.value}</code></pre>
    : part.value.trim() ? <p key={i}><Inline text={part.value.trim()}/></p> : null)}</div>;
}

export default function BlockView({ block, headingId }: { block: LessonBlock; headingId?: string }) {
  switch (block.type) {
    case 'heading': return block.level === 3 ? <h4 id={headingId} className="lesson-h">{block.text}</h4> : <h3 id={headingId} className="lesson-h">{block.text}</h3>;
    case 'paragraph': return <p className="lesson-paragraph"><Inline text={block.text}/></p>;
    case 'list': { const L = block.ordered ? 'ol' : 'ul'; return <L className="lesson-list">{block.items.map((x) => <li key={x}><Inline text={x}/></li>)}</L>; }
    case 'callout': return <aside className={`note ${block.tone}`} role="note">{block.title && <b>{block.title}</b>}<p><Inline text={block.text}/></p></aside>;
    case 'example': return <aside className="example"><b>Example: {block.title}</b><ExampleContent text={block.text}/></aside>;
    case 'formula': return <figure className="formula"><code translate="no">{block.expression}</code>{block.caption && <figcaption>{block.caption}</figcaption>}{block.variables && <dl>{block.variables.map((v) => <div key={v.name}><dt>{v.name}</dt><dd>{v.meaning}</dd></div>)}</dl>}</figure>;
  }
}
