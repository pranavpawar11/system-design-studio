import { describe, it, expect, beforeEach } from 'vitest';
import { useStudio } from '../features/architecture/architecture.store';

const s = () => useStudio.getState();
beforeEach(() => { localStorage.clear(); s().reset(); useStudio.setState({ past: [], future: [] }); });

describe('architecture store', () => {
  it('adds components with unique IDs', () => {
    s().addNode('COMP-CLIENT'); s().addNode('COMP-CLIENT');
    const ids = s().doc.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(2);
  });
  it('rejects incompatible connections and accepts valid ones', () => {
    s().addNode('COMP-CLIENT'); s().addNode('COMP-APP-SERVER'); s().addNode('COMP-SQL-DATABASE');
    const [c, a, d] = s().doc.nodes.map((n) => n.id);
    s().connect(c, d); expect(s().doc.edges).toHaveLength(0);
    s().connect(c, a); s().connect(a, d); expect(s().doc.edges).toHaveLength(2);
  });
  it('deleting a node removes its edges; undo/redo restore', () => {
    s().addNode('COMP-CLIENT'); s().addNode('COMP-APP-SERVER');
    const [c, a] = s().doc.nodes.map((n) => n.id);
    s().connect(c, a); s().removeNode(a);
    expect(s().doc.edges).toHaveLength(0);
    s().undo(); expect(s().doc.edges).toHaveLength(1);
    s().redo(); expect(s().doc.nodes).toHaveLength(1);
  });
  it('edits config', () => {
    s().addNode('COMP-APP-SERVER'); const id = s().doc.nodes[0].id;
    s().setConfig(id, 'instances', 5); expect(s().doc.nodes[0].config.instances).toBe(5);
  });
});
