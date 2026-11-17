import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { compile, ExpressionError } from '../features/learning/expression';
import { compileLab, runLab, sweep, defaultsOf, formatValue, LabSpecError } from '../features/learning/lab';
import { computeProgress, isLessonDone, leaves, pathTo } from '../features/learning/progress';
import type { Lesson, ProgressEvent, Roadmap, RoadmapNode } from '../features/learning/types';

const dir = join(process.cwd(), 'src/data/learning');
const roadmap = JSON.parse(readFileSync(join(dir, 'roadmap.json'), 'utf8')) as Roadmap;
const lessons = Object.fromEntries(readdirSync(join(dir, 'lessons')).map((f) => [f.replace('.json', ''), JSON.parse(readFileSync(join(dir, 'lessons', f), 'utf8')) as Lesson]));
const ready = leaves(roadmap.nodes).filter((l) => l.status === 'ready');
const finishEverything = (): ProgressEvent[] => ready.flatMap((l) => [...(l.hasLab ? [ev(l.id, 'lab_completed')] : []), ...(l.hasQuiz ? [ev(l.id, 'quiz_passed')] : [])]);
const ev = (nodeId: string, type: ProgressEvent['type']): ProgressEvent => ({ nodeId, type, at: '2026-01-01T00:00:00Z' });

describe('formula language', () => {
  const run = (src: string, vars: Record<string, number> = {}) => compile(src).evaluate(vars);
  it('does arithmetic with correct precedence', () => {
    expect(run('2 + 3 * 4')).toBe(14); expect(run('(2 + 3) * 4')).toBe(20); expect(run('-2 * -3')).toBe(6); expect(run('10 / 4')).toBe(2.5);
  });
  it('compares and combines conditions as 1 and 0', () => {
    expect(run('3 > 2 && 1 < 2')).toBe(1); expect(run('3 < 2 || 1 > 2')).toBe(0); expect(run('!(1 == 2)')).toBe(1); expect(run('true && !false')).toBe(1);
  });
  it('has a small set of functions', () => {
    expect(run('min(3, 1, 2)')).toBe(1); expect(run('max(1, x)', { x: 5 })).toBe(5); expect(run('round(2.6) + floor(2.9) + ceil(0.1)')).toBe(6); expect(run('pow(2, 10)')).toBe(1024);
  });
  it('reports the names a formula uses', () => { expect(compile('a * (1 - b) + min(c, 1)').names.sort()).toEqual(['a', 'b', 'c']); });
  it('turns division by zero into NaN, never Infinity', () => { expect(Number.isNaN(run('1 / 0'))).toBe(true); expect(Number.isNaN(run('x / y', { x: 5, y: 0 }))).toBe(true); });
  it('rejects bad syntax and unknown things clearly', () => {
    for (const bad of ['2 +', '(1', '1 2', 'foo(1)', '1 $ 2', '']) expect(() => compile(bad).evaluate({}), bad).toThrow(ExpressionError);
    expect(() => compile('missing + 1').evaluate({})).toThrow(/Unknown name "missing"/);
  });
  it('cannot reach JavaScript: no property access, calls on names, or assignment', () => {
    for (const evil of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'a.b', 'a = 1', 'process.exit(1)', '[1]', '"x"', 'window']) expect(() => compile(evil).evaluate({ a: 1 }), evil).toThrow(ExpressionError);
  });
});

describe('formatting', () => {
  it('formats each kind', () => {
    expect(formatValue(10000, 'integer', 'req/s')).toBe('10,000 req/s'); expect(formatValue(0.9, 'percent')).toBe('90%');
    expect(formatValue(3.14159, 'decimal2')).toBe('3.14'); expect(formatValue(2, 'decimal1', 'ms')).toBe('2 ms');
  });
  it('shows a dash for anything that is not a number', () => { expect(formatValue(NaN, 'integer')).toBe('—'); expect(formatValue(Infinity, 'integer')).toBe('—'); });
});

describe('the cache hit ratio lab', () => {
  const lab = compileLab(lessons['cache-hit-ratio'].lab!);
  const at = (over: Record<string, number> = {}) => runLab(lab, { ...defaultsOf(lab.spec), ...over });
  it('matches the numbers written in the lesson text', () => {
    expect(at({ hitRatio: 0.5 }).values.dbLoad).toBe(5000); expect(at({ hitRatio: 0.9 }).values.dbLoad).toBeCloseTo(1000);
    expect(at({ hitRatio: 0.99 }).values.dbLoad).toBeCloseTo(100);
    expect(at({ rps: 20000, hitRatio: 0.95 }).values.dbLoad).toBeCloseTo(1000);     // quiz question 1
    expect(at({ hitRatio: 0.9 }).values.dbLoad / at({ hitRatio: 0.99 }).values.dbLoad).toBeCloseTo(10); // "ten times"
  });
  it('starts healthy, overloads when the cache fails, and says so', () => {
    expect(at().headline?.tone).toBe('ok');
    const down = at({ cacheUp: 0 }); expect(down.values.dbLoad).toBe(10000); expect(down.headline?.tone).toBe('bad'); expect(down.headline?.text).toMatch(/cache is down/i);
  });
  it('is stable at exactly 100% of capacity, whatever the floating point arithmetic says', () => {
    for (const hit of [0.9, 0.8, 0.7, 0.6]) { const r = at({ rps: 50000, hitRatio: hit, dbCapacity: 50000 * (1 - hit) }); expect(r.values.utilization, String(hit)).toBeLessThanOrEqual(1); expect(r.headline?.tone, String(hit)).toBe('warn'); }
  });
  it('warns before the database is actually overloaded', () => { expect(at({ hitRatio: 0.4, dbCapacity: 8000 }).headline?.tone).toBe('warn'); });
  it('never produces Infinity or NaN across the whole range of every slider', () => {
    for (const rps of [1000, 100000]) for (const hit of [0, 0.5, 1]) for (const cap of [1000, 20000]) for (const up of [0, 1]) {
      const r = runLab(lab, { rps, hitRatio: hit, dbCapacity: cap, cacheUp: up });
      for (const o of r.outputs) expect(Number.isFinite(o.value), `${rps}/${hit}/${cap}/${up}/${o.id}`).toBe(true);
    }
  });
  it('tasks are met by the intended states and not by the starting state', () => {
    expect(at().tasksMet).toEqual({ t1: false, t2: true, t3: false });
    expect(at({ cacheUp: 0 }).tasksMet.t1).toBe(true);
    expect(at({ rps: 50000, hitRatio: 0.95 }).tasksMet.t3).toBe(true);
    expect(at({ rps: 50000, hitRatio: 0.5 }).tasksMet.t3).toBe(false);
  });
  it('every task can be reached by some setting of the sliders', () => {
    const grid = (id: string) => { const i = lab.spec.inputs.find((x) => x.id === id)!; return i.type === 'toggle' ? [0, 1] : Array.from({ length: 6 }, (_, k) => i.min! + ((i.max! - i.min!) * k) / 5); };
    const reachable = new Set<string>();
    for (const rps of grid('rps')) for (const h of grid('hitRatio')) for (const c of grid('dbCapacity')) for (const u of grid('cacheUp'))
      Object.entries(runLab(lab, { rps, hitRatio: h, dbCapacity: c, cacheUp: u }).tasksMet).forEach(([t, ok]) => ok && reachable.add(t));
    expect([...reachable].sort()).toEqual(['t1', 't2', 't3']);
  });
  it('sweeps one slider and reports the capacity line', () => {
    const s = sweep(lab, defaultsOf(lab.spec))!;
    expect(s.xs).toHaveLength(41); expect(s.xs[0]).toBe(0); expect(s.xs[40]).toBe(1); expect(s.ys[0]).toBe(10000); expect(s.ys[40]).toBe(0); expect(s.ref).toBe(5000);
  });
  it('scenarios only touch real inputs', () => { for (const sc of lab.spec.scenarios!) for (const k of Object.keys(sc.set)) expect(lab.spec.inputs.some((i) => i.id === k)).toBe(true); });
});

describe('lab files are checked when written, not when a learner opens them', () => {
  const base = () => structuredClone(lessons['cache-hit-ratio'].lab!);
  const problems = (mutate: (l: ReturnType<typeof base>) => void) => { const l = base(); mutate(l); try { compileLab(l); return []; } catch (e) { return (e as LabSpecError).problems; } };
  it('finds a misspelt name in a formula', () => { expect(problems((l) => { l.derived[1].formula = 'rps * (1 - effectiveHitt)'; }).join()).toMatch(/unknown name "effectiveHitt"/); });
  it('finds a formula that uses a value defined later', () => { expect(problems((l) => { l.derived[0].formula = 'cacheUp * dbLoad'; }).join()).toMatch(/unknown name "dbLoad"/); });
  it('finds text that mentions an unknown value', () => { expect(problems((l) => { l.narrative[0].text = 'Load is {nope}'; }).join()).toMatch(/unknown name "nope"/); });
  it('finds a broken slider and a default outside its range', () => {
    expect(problems((l) => { l.inputs[0].step = 0; }).join()).toMatch(/slider needs/); expect(problems((l) => { l.inputs[1].default = 5; }).join()).toMatch(/default is outside/);
  });
  it('finds duplicate names, a bad sweep and a bad scenario', () => {
    expect(problems((l) => { l.derived[2].id = 'rps'; }).join()).toMatch(/used twice/);
    expect(problems((l) => { l.sweep!.output = 'ghost'; }).join()).toMatch(/unknown output/);
    expect(problems((l) => { l.scenarios![0].set = { ghost: 1 }; }).join()).toMatch(/unknown input/);
  });
  it('needs a message and a task', () => { expect(problems((l) => { l.narrative = []; l.tasks = []; }).join()).toMatch(/narrative.*tasks/); });
});

describe('roadmap and lesson files agree', () => {
  const ready = leaves(roadmap.nodes).filter((l) => l.status === 'ready');
  it('has a topic → group → lesson shape with unique ids', () => {
    const ids = new Set<string>(); const walk = (ns: RoadmapNode[], depth: number) => ns.forEach((n) => { expect(ids.has(n.id), n.id).toBe(false); ids.add(n.id); expect(n.kind).toBe(['topic', 'group', 'lesson'][depth]); if (n.children) walk(n.children, depth + 1); else expect(depth).toBe(2); });
    walk(roadmap.nodes, 0); expect(roadmap.nodes.length).toBeGreaterThanOrEqual(10);
  });
  it('every ready lesson has a file, and every file is on the map', () => {
    expect(ready.map((l) => l.id).sort()).toEqual(Object.keys(lessons).sort());
  });
  it('map flags match what each lesson really contains', () => {
    for (const n of ready) { const l = lessons[n.id]; expect(l.id).toBe(n.id); expect(!!n.hasLab, `${n.id} hasLab`).toBe(!!l.lab); expect(!!n.hasQuiz, `${n.id} hasQuiz`).toBe(!!l.quiz); expect(n.minutes, `${n.id} minutes`).toBe(l.minutes); }
  });
  it('every lab compiles and every quiz answer exists', () => {
    for (const l of Object.values(lessons)) {
      if (l.lab) expect(() => compileLab(l.lab!), l.id).not.toThrow();
      for (const q of l.quiz?.questions ?? []) { expect(q.options.some((o) => o.id === q.correct), `${l.id}/${q.id}`).toBe(true); expect(q.explanation.length).toBeGreaterThan(20); }
      if (l.quiz) expect(l.quiz.passScore).toBeGreaterThan(0);
    }
  });
  it('a planned lesson never claims a lab or quiz, and a group is ready only if a child is', () => {
    const walk = (ns: RoadmapNode[]) => ns.forEach((n) => { if (n.kind === 'lesson' && n.status === 'planned') expect(!!n.hasLab || !!n.hasQuiz).toBe(false); if (n.children) { expect(n.status === 'ready').toBe(n.children.some((c) => c.status === 'ready')); walk(n.children); } });
    walk(roadmap.nodes);
  });
});

describe('progress', () => {
  const nodes = roadmap.nodes;
  it('starts empty: nothing done, the first ready lesson is next, planned lessons are not counted', () => {
    const p = computeProgress(nodes, []); const all = leaves(nodes).length;
    expect(p.done).toBe(0); expect(p.total).toBe(ready.length); expect(p.planned).toBe(all - ready.length); expect(p.percent).toBe(0); expect(p.nextUp?.id).toBe(ready[0].id);
    expect(p.byId.get('networking')?.state).toBe('todo'); expect(p.byId.get('caching')?.state).toBe('todo'); expect(p.byId.get('storage')?.state).toBe('planned'); expect(p.byId.get('dns')?.state).toBe('planned');
  });
  it('a lesson with a quiz only is done when the quiz is passed', () => {
    const lesson = leaves(nodes).find((l) => l.id === 'cache-basics')!;
    expect(isLessonDone(lesson, [ev('cache-basics', 'lesson_viewed')])).toBe(false);
    expect(isLessonDone(lesson, [ev('cache-basics', 'quiz_passed')])).toBe(true);
  });
  it('a lesson with a lab AND a quiz needs both, and viewing it only marks it as started', () => {
    const lesson = leaves(nodes).find((l) => l.id === 'cache-hit-ratio')!;
    expect(isLessonDone(lesson, [ev('cache-hit-ratio', 'lab_completed')])).toBe(false);
    expect(isLessonDone(lesson, [ev('cache-hit-ratio', 'quiz_passed')])).toBe(false);
    expect(isLessonDone(lesson, [ev('cache-hit-ratio', 'lab_completed'), ev('cache-hit-ratio', 'quiz_passed')])).toBe(true);
    expect(computeProgress(nodes, [ev('cache-hit-ratio', 'lesson_viewed')]).byId.get('cache-hit-ratio')?.state).toBe('doing');
  });
  it('rolls up: partial progress shows as doing, and a finished group shows done', () => {
    const one = computeProgress(nodes, [ev('cache-basics', 'quiz_passed')]);
    expect(one.byId.get('cache-basics')?.state).toBe('done'); expect(one.byId.get('caching-basics')?.state).toBe('doing'); expect(one.byId.get('caching')?.percent).toBe(50);
    const both = computeProgress(nodes, [ev('cache-basics', 'quiz_passed'), ev('cache-hit-ratio', 'lab_completed'), ev('cache-hit-ratio', 'quiz_passed')]);
    expect(both.byId.get('caching-basics')?.state).toBe('done'); expect(both.byId.get('caching-basics')?.caughtUp).toBe(false);
    expect(both.byId.get('caching')?.state).toBe('doing'); expect(both.byId.get('caching')?.caughtUp).toBe(true);   // other Caching groups are only planned
  });
  it('finishing every written lesson reaches 100% with nothing left to suggest', () => {
    const p = computeProgress(nodes, finishEverything()); expect(p.percent).toBe(100); expect(p.done).toBe(p.total); expect(p.nextUp).toBeNull();
  });
  it('after you finish a lesson, the suggestion follows it instead of jumping back to the top of the map', () => {
    const p = computeProgress(nodes, [ev('cache-basics', 'quiz_passed')]);
    expect(ready[0].id).not.toBe('cache-hit-ratio'); expect(p.nextUp?.id).toBe('cache-hit-ratio');        // the next lesson in Caching, not the first lesson overall
    const q = computeProgress(nodes, [ev('l4-vs-l7', 'quiz_passed')]); expect(q.nextUp?.id).toBe('health-checks');
    const wrap = computeProgress(nodes, [...finishEverything().filter((e) => e.nodeId !== 'load-balancing'), ev('cache-hit-ratio', 'quiz_passed')]);
    expect(wrap.nextUp?.id).toBe('load-balancing');                                                         // nothing after it, so wrap to what is left
  });
  it('a topic is only done when nothing is left, including lessons still to come', () => {
    const n: RoadmapNode[] = [{ id: 't', title: 'T', kind: 'topic', status: 'ready', children: [{ id: 'g', title: 'G', kind: 'group', status: 'ready', children: [{ id: 'l1', title: 'L1', kind: 'lesson', status: 'ready', hasQuiz: true }, { id: 'l2', title: 'L2', kind: 'lesson', status: 'ready' }] }] }];
    expect(computeProgress(n, [ev('l1', 'quiz_passed'), ev('l2', 'lesson_read')]).byId.get('t')?.state).toBe('done');
    n[0].children![0].children!.push({ id: 'l3', title: 'L3', kind: 'lesson', status: 'planned' });
    const p = computeProgress(n, [ev('l1', 'quiz_passed'), ev('l2', 'lesson_read')]);
    expect(p.byId.get('t')).toMatchObject({ state: 'doing', caughtUp: true, percent: 100 });
  });
  it('recommends continuing what you started over starting something new', () => {
    expect(computeProgress(nodes, [ev('cache-hit-ratio', 'lesson_viewed')]).nextUp?.id).toBe('cache-hit-ratio');
    expect(computeProgress(nodes, [ev('cache-hit-ratio', 'lesson_viewed'), ev('l4-vs-l7', 'quiz_passed')]).nextUp?.id).toBe('cache-hit-ratio');
  });
  it('never locks: any ready lesson is reachable regardless of progress', () => {
    const p = computeProgress(nodes, []); for (const l of leaves(nodes).filter((x) => x.status === 'ready')) expect(['todo', 'doing']).toContain(p.byId.get(l.id)?.state);
  });
  it('finds the breadcrumb for a lesson', () => { expect(pathTo(nodes, 'cache-hit-ratio')?.map((n) => n.title)).toEqual(['Caching', 'Caching basics', 'Cache hit ratio']); expect(pathTo(nodes, 'nope')).toBeNull(); });
});

describe('the load balancing lab', () => {
  const lab = compileLab(lessons['load-balancing'].lab!);
  const at = (over: Record<string, number> = {}) => runLab(lab, { ...defaultsOf(lab.spec), ...over });
  it('matches the numbers written in the lesson', () => {
    const d = at(); expect(d.values.totalCapacity).toBe(12000); expect(d.values.utilization).toBeCloseTo(0.833, 3); expect(d.headline?.tone).toBe('ok');
    const one = at({ failed: 1 }); expect(one.values.totalCapacity).toBe(9000); expect(one.values.utilization).toBeCloseTo(1.111, 3); expect(one.headline?.tone).toBe('bad');
    expect(one.headline?.text).toMatch(/Traffic is 10,000 req\/s but the 3 working servers can only handle 9,000 req\/s/);
  });
  it('warns that there is no spare server, at the starting settings', () => { expect(at().notes.map((n) => n.text).join()).toMatch(/no spare server/); expect(at({ rps: 8000 }).notes).toEqual([]); });
  it('uneven balancing overloads the busiest server while the average looks fine', () => {
    const r = at({ skew: 0.5 }); expect(r.values.utilization).toBeLessThanOrEqual(1); expect(r.values.busiestUtil).toBeCloseTo(1.25, 3); expect(r.headline?.text).toMatch(/busiest one is asked for 3,750 req\/s/);
  });
  it('says so plainly when every server is down, and shows dashes rather than Infinity', () => {
    const r = at({ failed: 4 }); expect(r.headline?.text).toMatch(/Every server is down/); expect(r.values.working).toBe(0);
    expect(Number.isNaN(r.values.utilization)).toBe(true); expect(r.outputs.find((o) => o.id === 'utilization')?.text).toBe('—');
    expect(at({ failed: 10, servers: 3 }).values.working).toBe(0);                      // more failures than servers cannot go negative
  });
  it('is only ever "not a number" when no server works, and never infinite', () => {
    for (const rps of [1000, 30000]) for (const servers of [1, 4, 10]) for (const failed of [0, 3, 10]) for (const skew of [0, 1]) {
      const r = at({ rps, servers, failed, skew });
      for (const o of r.outputs) { expect(o.value === Infinity || o.value === -Infinity).toBe(false); if (r.values.working > 0) expect(Number.isFinite(o.value), `${rps}/${servers}/${failed}/${skew}/${o.id}`).toBe(true); }
    }
  });
  it('no task is met at the starting settings, so the learner has something to do', () => { expect(Object.values(at().tasksMet).every((m) => !m)).toBe(true); });
  it('each task is met by the intended settings', () => {
    expect(at({ failed: 1, rps: 8000 }).tasksMet.t1).toBe(true); expect(at({ skew: 0.5 }).tasksMet.t2).toBe(true); expect(at({ capacityPerServer: 3500 }).tasksMet.t3).toBe(true);
    expect(at({ capacityPerServer: 3000 }).tasksMet.t3).toBe(false);
  });
});

describe('the health checks lab', () => {
  const lab = compileLab(lessons['health-checks'].lab!);
  const at = (over: Record<string, number> = {}) => runLab(lab, { ...defaultsOf(lab.spec), ...over });
  it('matches the numbers written in the lesson', () => {
    const d = at(); expect(d.values.worstDetect).toBe(17); expect(d.values.lostRequests).toBe(25500); expect(d.values.falseRemovals).toBeCloseTo(0.138, 3); expect(d.headline?.tone).toBe('ok');
    expect(at({ interval: 10, failuresNeeded: 3, timeout: 2 }).values.worstDetect).toBe(32);          // quiz question 1
  });
  it('reads naturally: each value carries its unit once', () => {
    const text = [at(), at({ interval: 1, failuresNeeded: 1, timeout: 1 }), at({ interval: 30, failuresNeeded: 5, timeout: 5 })].map((r) => r.headline?.text).join(' | ');
    expect(text).not.toMatch(/requests requests|per day a day|s s\b/); expect(text).toMatch(/about 25,500 requests fail in that time/);
  });
  it('shows the trade-off: faster detection wrongly removes healthy servers far more often', () => {
    const fast = at({ interval: 1, failuresNeeded: 1, timeout: 1 }), calm = at({ interval: 30, failuresNeeded: 5, timeout: 5 });
    expect(fast.values.worstDetect).toBeLessThan(calm.values.worstDetect); expect(fast.values.falseRemovals).toBeGreaterThan(calm.values.falseRemovals);
    expect(fast.headline?.tone).toBe('bad'); expect(fast.headline?.text).toMatch(/flapping/); expect(calm.headline?.tone).toBe('warn');
  });
  it('is finite across the whole range of every slider, including a perfectly reliable server', () => {
    for (const rps of [1000, 30000]) for (const servers of [2, 10]) for (const interval of [1, 30]) for (const f of [1, 5]) for (const p of [0, 0.1]) {
      for (const o of at({ rps, servers, interval, failuresNeeded: f, probeFailChance: p }).outputs) expect(Number.isFinite(o.value), `${rps}/${servers}/${interval}/${f}/${p}/${o.id}`).toBe(true);
    }
    expect(at({ probeFailChance: 0 }).values.falseRemovals).toBe(0);
  });
  it('the trade-off has a good answer: some setting is both quick and calm', () => { expect(at({ interval: 3, failuresNeeded: 3, timeout: 2 }).tasksMet.t3).toBe(true); expect(at().tasksMet.t3).toBe(false); });
});
