import { useCallback, useEffect, useMemo } from 'react';
import { toPng } from 'html-to-image';
import { bridge } from './canvasBridge';
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap, Handle, Position, ReactFlowProvider, useReactFlow, getNodesBounds, getViewportForBounds,
  type Node, type Edge, type NodeProps, type NodeChange, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Boxes } from 'lucide-react';
import { question, useStudio } from '../../features/architecture/architecture.store';
import { checkConnection, compatibleTypes } from '../../features/architecture/connectionRules';
import { categoryOf, iconOf, CATEGORY_COLORS } from '../layout/componentMeta';

type NodeData = { name: string; type: string; sub: string; flagged: boolean; dim: boolean };
type ArchRFNode = Node<NodeData, 'arch'>;

const EDGE_COLORS: Record<string, string> = {
  'EDGE-SYNC-HTTP': '#58a6ff', 'EDGE-DB-READ': '#3fb950', 'EDGE-DB-WRITE': '#f0883e',
  'EDGE-CACHE-READ': '#d2a8ff', 'EDGE-CACHE-WRITE': '#bc8cff', 'EDGE-ASYNC-PUBLISH': '#e3b341', 'EDGE-ASYNC-CONSUME': '#e3b341', 'EDGE-ID-ALLOC': '#79c0ff', 'EDGE-REPLICATION': '#a5d6a7', 'EDGE-TELEMETRY': '#56d4dd',
};

function ArchNodeView({ data, selected }: NodeProps<ArchRFNode>) {
  const cat = categoryOf(data.type);
  const Icon = iconOf(data.type);
  return (
    <div className={`arch-node${selected ? ' selected' : ''}${data.flagged ? ' flagged' : ''}${data.dim ? ' dim' : ''}`} style={{ borderLeftColor: CATEGORY_COLORS[cat] }}>
      <Handle type="target" position={Position.Left} />
      <Icon size={18} color={CATEGORY_COLORS[cat]} aria-hidden />
      <div className="arch-node-text">
        <strong>{data.flagged ? '⚠ ' : ''}{data.name}</strong>
        <span>{data.sub}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
function summary(c: Record<string, string | number | boolean>): string | null {
  if (c.instances && c.capacityPerInstanceRps) return `${c.instances} × ${c.capacityPerInstanceRps} req/s`;
  if (c.hitRatio !== undefined && c.ttlSeconds) return `${Math.round(Number(c.hitRatio) * 100)}% hit · TTL ${c.ttlSeconds}s`;
  if (c.readCapacityRps && c.writeCapacityRps) return `${c.readCapacityRps} R / ${c.writeCapacityRps} W per s`;
  if (c.readCapacityRps) return `${c.readCapacityRps} reads/s`;
  return null;
}
const nodeTypes = { arch: ArchNodeView };

function Inner() {
  const s = useStudio();
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow();
  useEffect(() => {
    if (s.focusRequest) fitView({ nodes: [{ id: s.focusRequest.id }], duration: 300, maxZoom: 1.2, padding: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.focusRequest]);
  useEffect(() => {
    if (s.fitRequest > 0) { const h = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 60); return () => clearTimeout(h); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.fitRequest]);
  useEffect(() => {
    bridge.exportPng = async () => {
      const el = document.querySelector<HTMLElement>('.react-flow__viewport');
      const all = getNodes();
      if (!el || !all.length) throw new Error('The canvas is empty.');
      const b = getNodesBounds(all); const pad = 80;
      const w = Math.round(b.width + pad * 2); const h = Math.round(b.height + pad * 2);
      const vp = getViewportForBounds(b, w, h, 1, 1, 0);
      const url = await toPng(el, { backgroundColor: '#0d1117', width: w, height: h, style: { width: `${w}px`, height: `${h}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` } });
      const a = document.createElement('a'); a.href = url; a.download = `${question.question.id}-design.png`; a.click();
    };
    return () => { bridge.exportPng = null; };
  }, [getNodes]);

  const flagged = useMemo(() => {
    const n = new Set<string>(); const e = new Set<string>();
    s.report?.findings.filter((f) => f.severity === 'error' || f.severity === 'warning').forEach((f) => { f.nodeIds.forEach((i) => n.add(i)); f.edgeIds.forEach((i) => e.add(i)); });
    return { n, e };
  }, [s.report]);

  const nodes: ArchRFNode[] = s.doc.nodes.map((n) => ({
    id: n.id, type: 'arch', position: n.position, width: 220, height: 64, selected: s.selIds.includes(n.id),
    data: { name: n.name, type: n.componentType, sub: summary(n.config) ?? question.componentCatalogue.components.find((c) => c.id === n.componentId)?.displayName ?? n.componentId, flagged: flagged.n.has(n.id), dim: s.highlight.length > 0 && !s.highlight.includes(n.id) },
  }));
  const edges: Edge[] = s.doc.edges.map((e) => {
    const bad = flagged.e.has(e.id);
    const dim = s.highlight.length > 0 && !(s.highlight.includes(e.source) && s.highlight.includes(e.target));
    return {
      id: e.id, source: e.source, target: e.target, selected: e.id === s.selEdge,
      label: `${bad ? '⚠ ' : ''}${question.connectionTypes.find((c) => c.id === e.connectionTypeId)?.name ?? e.connectionTypeId}`,
      animated: e.connectionTypeId === 'EDGE-ASYNC-PUBLISH',
      style: { opacity: dim ? 0.2 : 1, stroke: bad ? '#f85149' : EDGE_COLORS[e.connectionTypeId] ?? '#8b949e', strokeWidth: e.id === s.selEdge ? 3 : 1.8, strokeDasharray: bad ? '6 4' : undefined },
      labelStyle: { fill: '#e6edf3', fontSize: 11 }, labelBgStyle: { fill: '#161b22' },
    };
  });

  const onNodesChange = useCallback((changes: NodeChange<ArchRFNode>[]) => {
    for (const c of changes) if (c.type === 'position' && c.position) s.moveNode(c.id, c.position);
    const sel = changes.filter((c) => c.type === 'select');
    if (sel.length) {
      const cur = new Set(useStudio.getState().selIds);
      for (const c of sel) { if (c.selected) cur.add(c.id); else cur.delete(c.id); }
      s.setSelection([...cur]);
    }
  }, [s]);

  const valid = (c: Connection | Edge) => {
    if (!c.source || !c.target || c.source === c.target) return false;
    return s.connType === 'auto' ? compatibleTypes(question, s.doc, c.source, c.target).length > 0 : checkConnection(question, s.doc, c.source, c.target, s.connType).ok;
  };

  return (
    <div className="canvas-wrap" id="canvas" tabIndex={-1}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('application/hld-component'); if (id) s.addNode(id, screenToFlowPosition({ x: e.clientX - 110, y: e.clientY - 32 })); }}>
      <ReactFlow<ArchRFNode, Edge>
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} colorMode="dark" fitView proOptions={{ hideAttribution: true }} deleteKeyCode={null}
        onNodesChange={onNodesChange}
        onNodeDragStart={() => s.beginDrag()}
        onConnect={(c) => s.connect(c.source, c.target)}
        isValidConnection={valid}
        onConnectEnd={(_, st) => { if (st.toNode && !st.isValid) s.notify(s.connType === 'auto' ? 'Those components have no compatible connection type.' : 'Selected connection type is incompatible with these components.'); }}
        onNodeClick={(e, n) => { if (!(e.shiftKey || e.ctrlKey || e.metaKey)) s.select(n.id, null); }} onEdgeClick={(_, e) => s.select(null, e.id)} onPaneClick={() => s.select(null, null)}>
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#243549" />
        {s.showControls && <Controls showInteractive={false} />}
        {s.showMinimap && <MiniMap style={{ width: 170, height: 110 }} pannable zoomable nodeColor={(n) => CATEGORY_COLORS[categoryOf((n.data as NodeData).type)]} />}
      </ReactFlow>
      {s.doc.nodes.length === 0 && (
        <div className="empty-state">
          <Boxes size={36} aria-hidden />
          <h3>Start your design</h3>
          <p>Drag a component from the library, or click one to add it. Then drag from a node’s right handle to another node’s left handle to connect them.</p>
        </div>
      )}
      <div className="canvas-linktype">
        <label htmlFor="linktype">Link type</label>
        <select id="linktype" name="link-type" aria-label="New connection type" value={s.connType} onChange={(e) => s.setConnType(e.target.value)} title="Choose the type for new connections, or let the studio pick one that fits">
          <option value="auto">Automatic</option>{question.connectionTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="canvas-tools" role="toolbar" aria-label="Canvas view options">
        <button aria-pressed={s.showControls} onClick={() => s.setView({ showControls: !s.showControls })} title="Show or hide zoom controls">Zoom controls</button>
        <button aria-pressed={s.showMinimap} onClick={() => s.setView({ showMinimap: !s.showMinimap })} title="Show or hide the mini-map">Mini-map</button>
        <button onClick={s.autoLayout} title="Arrange components left to right by request flow">Auto-layout</button>
        <button onClick={() => fitView({ padding: 0.2 })}>Fit view</button>
      </div>
    </div>
  );
}
export default function ArchitectureCanvas() { return <ReactFlowProvider><Inner /></ReactFlowProvider>; }
