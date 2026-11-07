import { describe, it, expect, beforeEach } from 'vitest';
import { useStudio } from '../features/architecture/architecture.store';
import { buildSummary } from '../features/learning/summary';
import rlSpec from '../data/questions/rate-limiter.json';
import rlLearning from '../data/questions/rate-limiter.learning.json';
import rlSolved from './fixtures/rate-limiter-solved.json';
import { parseQuestion } from '../features/questions/questionLoader';
import { validateDocument } from '../features/architecture/architecture.utils';
import { evaluate } from '../features/evaluation/evaluator';
import { analyzeRateLimiter } from '../features/evaluation/rlCapacity';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';

const s = () => useStudio.getState();
beforeEach(() => { localStorage.clear(); s().reset(); useStudio.setState({ past: [], future: [], clipboard: null, selIds: [], selNode: null }); });

describe('multi-select and clipboard', () => {
  it('copies selected nodes with only their internal edges, then pastes with fresh IDs', () => {
    s().addNode('COMP-CLIENT'); s().addNode('COMP-APP-SERVER'); s().addNode('COMP-SQL-DATABASE');
    const [c, a, d] = s().doc.nodes.map((n) => n.id);
    s().connect(c, a); s().connect(a, d);
    s().setSelection([c, a]); s().copy(); s().paste();
    const st = s();
    expect(st.doc.nodes).toHaveLength(5);
    expect(new Set(st.doc.nodes.map((n) => n.id)).size).toBe(5);
    expect(st.doc.edges).toHaveLength(3);               // original 2 + one internal copy (a→d is not copied)
    const copyEdge = st.doc.edges.at(-1)!;
    expect(st.selIds).toContain(copyEdge.source); expect(st.selIds).toContain(copyEdge.target);
    expect(st.doc.nodes.at(-1)!.name).toMatch(/\(copy\)/);
  });
  it('paste with nothing copied is a no-op with a message', () => {
    s().paste(); expect(s().doc.nodes).toHaveLength(0); expect(s().toast).toMatch(/Nothing copied/);
  });
  it('removeNodes deletes several nodes in one undo step', () => {
    s().addNode('COMP-CLIENT'); s().addNode('COMP-APP-SERVER');
    const ids = s().doc.nodes.map((n) => n.id);
    s().removeNodes(ids); expect(s().doc.nodes).toHaveLength(0);
    s().undo(); expect(s().doc.nodes).toHaveLength(2);
  });
  it('selectAll and duplicate work', () => {
    s().addNode('COMP-CLIENT'); s().addNode('COMP-CACHE');
    s().selectAll(); expect(s().selIds).toHaveLength(2);
    s().duplicate(); expect(s().doc.nodes).toHaveLength(4);
  });
});

describe('learning summary', () => {
  const base = { titleOf: (id: string) => `T-${id}`, hintsTotal: 5, followUps: [{ id: 'a', expectedAnswerPoints: ['x', 'y'] }, { id: 'b', expectedAnswerPoints: ['z'] }], recommendations: [{ requirementIds: ['R1'], text: 'Review R1' }] };
  it('is honest when nothing has been validated', () => {
    const r = buildSummary({ ...base, report: null, hintsUsed: 0, answers: {} });
    expect(r.validated).toBe(false); expect(r.nextStep).toMatch(/Validate/);
  });
  it('reports failures, independence, follow-up coverage and revision advice', () => {
    const report = { findings: [{ id: 'F1', ruleId: 'x', severity: 'error' as const, title: 't', explanation: 'e', requirementId: 'R1', nodeIds: [], edgeIds: [], suggestion: 'Do the thing' }],
      requirements: [{ requirementId: 'R1', status: 'fail' as const, findingIds: ['F1'], evidenceNodeIds: [] }, { requirementId: 'R2', status: 'pass' as const, findingIds: [], evidenceNodeIds: [] }], limitations: [] };
    const r = buildSummary({ ...base, report, hintsUsed: 4, answers: { a: { revealed: true, covered: [0] } } });
    expect(r.met).toEqual(['T-R2']); expect(r.notMet[0].next).toBe('Do the thing');
    expect(r.independence).toMatch(/most/); expect(r.followUps).toMatchObject({ reviewed: 1, pointsCovered: 1, pointsTotal: 2 });
    expect(r.recommendations).toEqual(['Review R1']); expect(r.nextStep).toMatch(/Fix “T-R1”/);
  });
});

describe('Rate Limiter question (second question)', () => {
  const q = parseQuestion(rlSpec);
  const solved = rlSolved as unknown as ArchitectureDocument;
  const status = (d: ArchitectureDocument, id: string) => evaluate(q, d).requirements.find((r) => r.requirementId === id)?.status;
  it('loads, and its reference design is valid and passes every requirement', () => {
    expect(validateDocument(solved, q).ok).toBe(true);
    expect(evaluate(q, solved).requirements.every((r) => r.status === 'pass')).toBe(true);
    expect(validateDocument(rlLearning.referenceSolutions[0].architecture, q).ok).toBe(true);
  });
  it('fails when requests can bypass the limiter', () => {
    const d = structuredClone(solved); d.edges.push({ id: 'bypass', source: 'lb', target: 'app', connectionTypeId: 'EDGE-SYNC-HTTP' });
    expect(status(d, 'RL-FR-01')).toBe('fail');
  });
  it('fails when several limiter servers have no shared counter store', () => {
    const d = structuredClone(solved); d.edges = d.edges.filter((e) => e.connectionTypeId !== 'EDGE-COUNTER');
    expect(status(d, 'RL-FR-02')).toBe('fail');
    d.nodes.find((n) => n.id === 'limiter')!.config.instances = 1;
    expect(status(d, 'RL-FR-02')).toBe('pass');
  });
  it('leaves undeclared behaviour unverified instead of passing it', () => {
    const d = structuredClone(solved); const l = d.nodes.find((n) => n.id === 'limiter')!;
    l.config.rejectBehavior = 'undeclared'; l.config.onStoreUnavailable = 'undeclared';
    expect(status(d, 'RL-FR-03')).toBe('not-evaluated'); expect(status(d, 'RL-NFR-03')).toBe('not-evaluated');
  });
  it('flags insufficient limiter capacity', () => {
    const d = structuredClone(solved); d.nodes.find((n) => n.id === 'limiter')!.config.instances = 1;
    expect(status(d, 'RL-NFR-01')).toBe('fail');
  });
  it('capacity what-if: store down shows the declared behaviour, not Infinity', () => {
    const a = analyzeRateLimiter(q, solved, { redirectRps: 10000, multiplier: 1 }, { cacheDown: true, lostInstances: 0 });
    expect(a.rows.find((r) => r.id === 'store')!.note).toMatch(/not enforced/);
    const b = analyzeRateLimiter(q, solved, { redirectRps: 10000, multiplier: 1 }, { cacheDown: false, lostInstances: 2 });
    expect(b.rows.find((r) => r.id === 'limiter')!.status).toBe('not-modeled');
  });
});
