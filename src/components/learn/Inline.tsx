import { Fragment } from 'react';

/** Renders **bold** and `code` in lesson text. Anything else is plain text: lessons can never inject HTML. */
export default function Inline({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong>
    : part.startsWith('`') && part.endsWith('`') ? <code key={i} translate="no">{part.slice(1, -1)}</code>
    : <Fragment key={i}>{part}</Fragment>)}</>;
}
