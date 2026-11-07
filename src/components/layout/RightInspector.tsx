import { useEffect, useState } from 'react';
import { Trash2, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter } from 'lucide-react';
import { question, useStudio } from '../../features/architecture/architecture.store';
import { checkConnection } from '../../features/architecture/connectionRules';
import type { ConfigValue } from '../../features/architecture/architecture.types';
import { REQ_GROUPS, reqTitle } from '../../features/questions/requirementGroups';
import MetricsPanel from '../evaluation/MetricsPanel';
import type { ComponentDef } from '../../features/questions/question.types';

function validateField(v: string, schema: ComponentDef['configSchema'] extends infer S ? (S extends Record<string, infer F> ? F : never) | undefined : never, isNum: boolean): string | null {
  if (!isNum) return v.trim() ? null : 'Required.';
  if (v.trim() === '' || !Number.isFinite(Number(v))) return 'Enter a number.';
  const n = Number(v);
  if (schema?.type === 'integer' && !Number.isInteger(n)) return 'Must be a whole number.';
  if (schema?.minimum !== undefined && n < schema.minimum) return `Minimum is ${schema.minimum}.`;
  if (schema?.maximum !== undefined && n > schema.maximum) return `Maximum is ${schema.maximum}.`;
  if (schema?.exclusiveMinimum !== undefined && n <= schema.exclusiveMinimum) return `Must be greater than ${schema.exclusiveMinimum}.`;
  if (!schema && n < 0) return 'Cannot be negative.';
  return null;
}
function Field({ id, k, value, schema, onCommit }: { id: string; k: string; value: ConfigValue; schema?: Parameters<typeof validateField>[1]; onCommit(v: ConfigValue): void }) {
  const [text, setText] = useState(String(value)); const [err, setErr] = useState<string | null>(null);
  if (schema?.enum) return <label className="field"><span>{k}</span><select value={String(value)} onChange={(e) => onCommit(e.target.value)}>{schema.enum.map((o) => <option key={o}>{o}</option>)}</select></label>;
  if (typeof value === 'boolean') return <label className="field check"><input type="checkbox" checked={value} onChange={(e) => onCommit(e.target.checked)} /> {k}</label>;
  const isNum = typeof value === 'number';
  return (
    <label className="field" key={id}><span>{k}</span>
      <input name={`config-${k}`} autoComplete="off" spellCheck={false} inputMode={isNum ? 'decimal' : undefined} value={text} aria-invalid={!!err} onChange={(e) => { setText(e.target.value); const m = validateField(e.target.value, schema, isNum); setErr(m); if (!m) onCommit(isNum ? Number(e.target.value) : e.target.value); }} />
      {err && <small className="err" role="alert">{err}</small>}
    </label>
  );
}

const STATUS_LABEL = { pass: '✓ Met', fail: '✗ Not met', 'not-evaluated': '? Unverified' } as const;
function Results() {
  const report = useStudio((s) => s.report); const doc = useStudio((s) => s.doc);
  const highlight = useStudio((s) => s.highlight); const setHighlight = useStudio((s) => s.setHighlight);
  if (!report) return <p className="muted">Click <b>Validate</b> to evaluate this design. Nothing is scored until you do.</p>;
  const reqSpec = question.requirements as { functional: { id: string; title: string }[]; nonFunctional: { id: string; title: string }[] } | undefined;
  const titles = new Map([...(reqSpec?.functional ?? []), ...(reqSpec?.nonFunctional ?? [])].map((r) => [r.id, r.title]));
  const reqs = [...new Map(report.requirements.map((r) => [r.requirementId, r])).values()]; // each requirement once
  const name = (id: string) => doc.nodes.find((n) => n.id === id)?.name ?? id;
  const count = (s: string) => reqs.filter((r) => r.status === s).length;
  const sev = (s: string) => report.findings.filter((f) => f.severity === s).length;
  const groups = REQ_GROUPS.map((g) => ({ ...g, reqs: reqs.filter((r) => g.items.some((i) => i.id === r.requirementId)) })).filter((g) => g.reqs.length);
  const general = report.findings.filter((f) => !f.requirementId);
  const show = (f: { nodeIds: string[]; edgeIds: string[] }) => setHighlight([...f.nodeIds, ...f.edgeIds.flatMap((e) => { const ed = doc.edges.find((x) => x.id === e); return ed ? [ed.source, ed.target] : []; })]);
  const same = (ids: string[]) => ids.length > 0 && ids.length === highlight.length && ids.every((i) => highlight.includes(i));
  return (
    <div>
      <div className="tiles">
        <div><b className="ok">{count('pass')}</b><span>Requirements met</span></div>
        <div><b className="bad">{count('fail')}</b><span>Not met</span></div>
        <div><b className="warn">{count('not-evaluated')}</b><span>Unverified</span></div>
        <div><b>{sev('error') + sev('warning')}</b><span>Errors &amp; warnings</span></div>
      </div>
      <p className="muted">“Pass” means the specific check passed on the diagram. It does not mean the design is production-ready.</p>
      <h3>Requirement coverage</h3>
      {groups.map((g) => <div key={g.label}><h4 className="grouphead">{g.label}</h4>{g.reqs.map((r) => {
        const fs = report.findings.filter((f) => f.requirementId === r.requirementId);
        return (
          <div key={r.requirementId} className={`reqcard ${r.status}`}>
            <button className={`reqhead${same(r.evidenceNodeIds) ? ' on' : ''}`} disabled={!r.evidenceNodeIds.length} onClick={() => setHighlight(same(r.evidenceNodeIds) ? [] : r.evidenceNodeIds)}
              title={r.evidenceNodeIds.length ? 'Highlight the evidence on the canvas' : 'No diagram evidence to highlight'}>
              <span title={r.requirementId}>{titles.get(r.requirementId) ?? r.requirementId}</span><span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>
            </button>
            {r.status === 'pass' && r.evidenceNodeIds.length > 0 && <p className="evidence">Evidence: {r.evidenceNodeIds.map(name).join(' → ')}</p>}
            {fs.map((f) => (
              <div key={f.id} className={`finding ${f.severity}`}>
                <b>{f.title}</b><p>{f.explanation}</p>{f.suggestion && <p className="next">Next: {f.suggestion}</p>}
                {(f.nodeIds.length > 0 || f.edgeIds.length > 0) && <button className="link" onClick={() => show(f)}>Show on canvas</button>}
              </div>
            ))}
          </div>
        );
      })}</div>)}
      {general.length > 0 && <h3>Structural findings</h3>}
      {general.map((f) => (
        <div key={f.id} className={`finding ${f.severity}`}>
          <b>{f.title}</b><p>{f.explanation}</p>{f.suggestion && <p className="next">Next: {f.suggestion}</p>}{(f.nodeIds.length > 0 || f.edgeIds.length > 0) && <button className="link" onClick={() => show(f)}>Show on canvas</button>} <small>{f.ruleId}</small>
        </div>
      ))}
      <h3>Assumptions &amp; limitations</h3><ul className="muted">{report.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
    </div>
  );
}

function nextAction(s: ReturnType<typeof useStudio.getState>): string {
  const has = (type: string) => s.doc.nodes.some((n) => n.componentType === type);
  if (question.question.id === 'hld-rate-limiter-001') {
    if (!s.doc.nodes.length) return 'Add a Client and an Application Server to protect.';
    if (!has('rate-limiter')) return 'Add a Rate Limiter and place it between the Client and the Application Server.';
    if (!has('cache')) return 'Add a shared Counter Store so every limiter server counts the same way.';
    if (!s.report) return 'Click Validate to see which requirements your design meets.';
    const g = s.report.findings.find((x) => x.severity === 'error' || x.severity === 'warning' || x.severity === 'not-evaluated');
    return g ? `${g.title}${g.suggestion ? ` — ${g.suggestion}` : ''}` : 'No blocking findings. Think about failure scenarios.';
  }
  if (!s.doc.nodes.length) return 'Add a Client and an Application Server from the library.';
  if (!has('client') || !has('application-server')) return 'Every request path starts at a Client and needs an Application Server.';
  if (!s.doc.nodes.some((n) => n.componentType.includes('database'))) return 'Add a durable database so created URLs survive restarts.';
  if (!s.doc.edges.some((e) => e.connectionTypeId === 'EDGE-DB-WRITE')) return 'Connect the Application Server to the database with a Database Write edge.';
  if (!s.doc.edges.some((e) => e.connectionTypeId === 'EDGE-DB-READ')) return 'Add a Database Read edge so redirects can look up mappings.';
  if (!s.report) return 'Click Validate to see which requirements your design covers.';
  const f = s.report.findings.find((x) => x.severity === 'error' || x.severity === 'warning');
  return f ? `${f.title}${f.suggestion ? ` — ${f.suggestion}` : ''}` : 'No blocking findings. Review the “not evaluated” items and think about failure scenarios.';
}

export default function RightInspector() {
  const s = useStudio();
  const node = s.doc.nodes.find((n) => n.id === s.selNode);
  const edge = s.doc.edges.find((e) => e.id === s.selEdge);
  const [tab, setTab] = useState<'inspect' | 'results' | 'metrics'>('inspect');
  useEffect(() => { if (s.report) setTab('results'); }, [s.report]);
  useEffect(() => { if (s.selNode || s.selEdge || s.selIds.length) setTab('inspect'); }, [s.selNode, s.selEdge, s.selIds]);
  const issues = s.report ? s.report.findings.filter((f) => f.severity === 'error' || f.severity === 'warning').length : 0;
  const nev = s.report ? s.report.requirements.filter((r) => r.status === 'not-evaluated').length : 0;
  const comp = node && question.componentCatalogue.components.find((c) => c.id === node.componentId);
  return (
    <aside className="sidebar sidebar-right" style={{ width: s.rightWidth }} aria-label="Inspector">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'inspect'} onClick={() => setTab('inspect')}>Inspector</button>
        <button role="tab" aria-selected={tab === 'metrics'} onClick={() => setTab('metrics')}>Metrics</button>
        <button role="tab" aria-selected={tab === 'results'} onClick={() => setTab('results')}>Results{s.report ? ` · ${issues} issue${issues === 1 ? '' : 's'}${nev ? `, ${nev} unverified` : ''}` : ''}</button>
      </div>
      <div className="panel">
        {tab === 'metrics' ? <MetricsPanel /> : tab === 'results' ? <Results /> : node && comp ? (
          <div>
            <h2>{comp.displayName}</h2><p className="muted">{comp.type}</p>
            <label className="field"><span>Instance name</span><input name="instance-name" autoComplete="off" spellCheck={false} value={node.name} onChange={(e) => s.renameNode(node.id, e.target.value)} /></label>
            <h3>Configuration</h3>
            {Object.entries({ ...comp.defaultConfig, ...node.config }).length === 0 && <p className="muted">No configurable values.</p>}
            {Object.entries({ ...comp.defaultConfig, ...node.config }).map(([k, v]) => <Field key={node.id + k} id={node.id + k} k={k} value={v} schema={comp.configSchema?.[k]} onCommit={(nv) => s.setConfig(node.id, k, nv)} />)}
            <h3>Connections</h3>
            {(() => {
              const nm = (id: string) => s.doc.nodes.find((x) => x.id === id)?.name ?? id;
              const ct = (id: string) => question.connectionTypes.find((c) => c.id === id)?.name ?? id;
              const inc = s.doc.edges.filter((e) => e.target === node.id); const out = s.doc.edges.filter((e) => e.source === node.id);
              return inc.length + out.length === 0 ? <p className="muted">Not connected yet.</p> : <ul>{inc.map((e) => <li key={e.id}>← {nm(e.source)} <small>({ct(e.connectionTypeId)})</small></li>)}{out.map((e) => <li key={e.id}>→ {nm(e.target)} <small>({ct(e.connectionTypeId)})</small></li>)}</ul>;
            })()}
            <h3>Responsibilities</h3><ul>{comp.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul>
            <h3>Supported operations</h3><p className="chips">{comp.supportedOperations.map((o) => <code key={o} translate="no">{o}</code>)}</p>
            <button className="danger" onClick={() => s.removeNode(node.id)}><Trash2 size={14} aria-hidden /> Delete component</button>
          </div>
        ) : edge ? (
          <div>
            <h2>Connection</h2>
            <p>{s.doc.nodes.find((n) => n.id === edge.source)?.name} → {s.doc.nodes.find((n) => n.id === edge.target)?.name}</p>
            <label className="field"><span>Connection type</span>
              <select value={edge.connectionTypeId} onChange={(e) => s.setEdgeType(edge.id, e.target.value)}>
                {question.connectionTypes.map((c) => <option key={c.id} value={c.id} disabled={!checkConnection(question, s.doc, edge.source, edge.target, c.id).ok}>{c.name}</option>)}
              </select></label>
            <p className="muted">{question.connectionTypes.find((c) => c.id === edge.connectionTypeId)?.semantics}</p>
            <button className="danger" onClick={() => s.removeEdge(edge.id)}><Trash2 size={14} aria-hidden /> Delete connection</button>
          </div>
        ) : s.selIds.length > 1 ? (
          <div>
            <h2>{s.selIds.length} components selected</h2>
            <p className="muted">Drag any selected component to move them together.</p>
            <div className="btnrow"><button onClick={s.copy}>Copy</button><button onClick={s.duplicate}>Duplicate</button><button className="danger" onClick={() => s.removeNodes(s.selIds)}><Trash2 size={14} aria-hidden /> Delete selected</button></div>
            <h3>Align</h3>
            <div className="alignrow" role="group" aria-label="Align selected">
              <button aria-label="Align left edges" title="Align left" onClick={() => s.alignSelected('left')}><AlignStartVertical size={16} /></button>
              <button aria-label="Align horizontal centers" title="Align centers" onClick={() => s.alignSelected('center')}><AlignCenterVertical size={16} /></button>
              <button aria-label="Align right edges" title="Align right" onClick={() => s.alignSelected('right')}><AlignEndVertical size={16} /></button>
              <button aria-label="Align top edges" title="Align top" onClick={() => s.alignSelected('top')}><AlignStartHorizontal size={16} /></button>
              <button aria-label="Align vertical middles" title="Align middles" onClick={() => s.alignSelected('middle')}><AlignCenterHorizontal size={16} /></button>
              <button aria-label="Align bottom edges" title="Align bottom" onClick={() => s.alignSelected('bottom')}><AlignEndHorizontal size={16} /></button>
            </div>
            <h3>Distribute (3 or more)</h3>
            <div className="alignrow" role="group" aria-label="Distribute selected">
              <button aria-label="Distribute horizontally" title="Space evenly, left to right" onClick={() => s.distributeSelected('h')}><AlignHorizontalDistributeCenter size={16} /></button>
              <button aria-label="Distribute vertically" title="Space evenly, top to bottom" onClick={() => s.distributeSelected('v')}><AlignVerticalDistributeCenter size={16} /></button>
            </div>
            <p className="muted">Shortcuts: Ctrl/Cmd+C copy · V paste · D duplicate · A select all. Hold Shift and drag to box-select; Ctrl/Cmd-click adds one.</p>
          </div>
        ) : (
          <div>
            <h2>Design guidance</h2>
            <p>{s.doc.nodes.length} components · {s.doc.edges.length} connections</p>
            <div className="callout"><b>Next step</b><p>{nextAction(s)}</p></div>
            <h3>Not yet covered</h3>
            {s.report ? <ul>{s.report.requirements.filter((r) => r.status === 'fail').map((r) => <li key={r.requirementId}>{reqTitle(r.requirementId)}</li>)}{!s.report.requirements.some((r) => r.status === 'fail') && <li>No failed checks.</li>}</ul> : <p className="muted">Run Validate to find out.</p>}
            <p className="muted">Select a component or connection to inspect it. Click a requirement in Results to highlight its path.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
