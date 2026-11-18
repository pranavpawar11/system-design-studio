import { useEffect, useState } from 'react';
import { Activity, ArrowDown, ArrowRight, Boxes, Database, GitBranch, Layers3, Network, ShieldCheck, Workflow, Zap } from 'lucide-react';
import './learning-mini-visuals.css';

type Node = { name: string; icon: typeof Network };
type Stage = { label: string; caption: string; layers: Node[][] };

const stages: Stage[] = [
  {
    label: 'FOUNDATION',
    caption: 'A simple request path',
    layers: [
      [{ name: 'Users', icon: Network }, { name: 'API Gateway', icon: ShieldCheck }],
      [{ name: 'Application', icon: Workflow }],
      [{ name: 'Database', icon: Database }],
    ],
  },
  {
    label: 'HORIZONTAL SCALING',
    caption: 'Traffic is distributed across multiple instances',
    layers: [
      [{ name: 'Users', icon: Network }, { name: 'Gateway', icon: ShieldCheck }, { name: 'Load Balancer', icon: GitBranch }],
      [{ name: 'API 1', icon: Workflow }, { name: 'API 2', icon: Workflow }, { name: 'API 3', icon: Workflow }],
      [{ name: 'Cache', icon: Zap }, { name: 'Database', icon: Database }],
    ],
  },
  {
    label: 'DISTRIBUTED SYSTEM',
    caption: 'Independent services coordinate through shared infrastructure',
    layers: [
      [{ name: 'Users', icon: Network }, { name: 'Gateway', icon: ShieldCheck }, { name: 'Load Balancer', icon: GitBranch }],
      [{ name: 'User Service', icon: Boxes }, { name: 'Order Service', icon: Boxes }, { name: 'Payment Service', icon: Boxes }],
      [{ name: 'Queue', icon: Activity }, { name: 'Workers', icon: Workflow }, { name: 'Replicas', icon: Database }, { name: 'Monitor', icon: Layers3 }],
    ],
  },
];

export default function HLDArchitecturePlayground() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStage((value) => (value + 1) % stages.length), 4300);
    return () => window.clearInterval(timer);
  }, []);
  const current = stages[stage];
  return <section className="learning-mini-visual hld-mini-visual hld-layered-visual" aria-label="Architecture evolving through three horizontal layers">
    <div className="learning-mini-head"><span>ARCHITECTURE EVOLVES</span><b>{current.label}</b></div>
    <div className="hld-layer-stack" key={stage}>
      {current.layers.map((layer, layerIndex) => <div className="hld-layer-line" key={`${stage}-${layerIndex}`}>
        {layer.map((node, nodeIndex) => {
          const Icon = node.icon;
          return <div className="hld-layer-node-wrap" key={node.name}>
            <div className="hld-layer-node"><Icon size={14}/><b>{node.name}</b></div>
            {nodeIndex < layer.length - 1 && <ArrowRight className="hld-layer-right" size={13} aria-hidden="true"/>}
          </div>;
        })}
        {layerIndex < current.layers.length - 1 && <ArrowDown className="hld-layer-down" size={13} aria-hidden="true"/>}
      </div>)}
    </div>
    <div className="hld-layer-caption">{current.caption}</div>
    <div className="learning-mini-foot"><span>Simple system</span><div>{stages.map((item, index) => <i key={item.label} className={index === stage ? 'active' : ''}/>)}</div><span>Distributed system</span></div>
  </section>;
}
