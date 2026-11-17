import Ajv from 'ajv';
import schema from '../../../docs/learning-authoring/schemas/lesson.schema.json';
import { compileLab, defaultsOf, runLab, LabSpecError } from '../learning/lab';
import { leaves } from '../learning/progress';
import type { Lesson, Roadmap } from '../learning/types';
import type { LintIssue } from './lintQuestion';

const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

interface Context { roadmap?: Roadmap; questionIds?: string[]; publish?: boolean }

/** Checks one lesson file. Pure: the caller supplies the roadmap and the list of Studio question ids. */
export function lintLesson(raw: unknown, ctx: Context = {}): LintIssue[] {
  const out: LintIssue[] = [];
  const err = (where: string, message: string) => out.push({ level: 'error', where, message });
  const warn = (where: string, message: string) => out.push({ level: 'warning', where, message });

  if (!validate(raw)) { for (const e of validate.errors ?? []) if (e.keyword !== 'oneOf') err('lesson', `${e.instancePath || '(root)'} ${e.message}`); if (!out.length) err('lesson', 'A block has the wrong shape. Check each block has a valid "type" and only its own fields.'); return out; }
  const l = raw as unknown as Lesson;

  if (l.lab) {
    try {
      const lab = compileLab(l.lab);
      // Every task must be achievable. Try a grid of settings; a task nothing can satisfy would trap the learner.
      const per = Math.max(2, Math.floor(Math.pow(20000, 1 / l.lab.inputs.length))); const reached = new Set<string>();
      const values = (i: (typeof l.lab.inputs)[number]) => (i.type === 'toggle' ? [0, 1] : Array.from({ length: per }, (_, k) => i.min! + ((i.max! - i.min!) * k) / (per - 1)));
      const walk = (idx: number, cur: Record<string, number>) => {
        if (idx === l.lab!.inputs.length) { for (const [t, ok] of Object.entries(runLab(lab, cur).tasksMet)) if (ok) reached.add(t); return; }
        for (const v of values(l.lab!.inputs[idx])) walk(idx + 1, { ...cur, [l.lab!.inputs[idx].id]: v });
      };
      walk(0, defaultsOf(l.lab));
      for (const t of l.lab.tasks) if (!reached.has(t.id)) err(`lab task ${t.id}`, 'No setting of the controls can complete this task, so a learner would be stuck. Check the "check" formula and the slider ranges.');
    } catch (e) { for (const p of (e as LabSpecError).problems ?? [String(e)]) err('lab', p); }
    // {name} is inserted WITH its unit, so "{lostRequests} requests" would read "25,500 requests requests".
    const unitOf = new Map<string, string>([...l.lab.inputs.map((i) => [i.id, i.unit ?? ''] as const), ...l.lab.derived.map((d) => [d.id, d.unit ?? ''] as const)]);
    const formatOf = new Map<string, string | undefined>([...l.lab.inputs.map((i) => [i.id, i.format] as const), ...l.lab.derived.map((d) => [d.id, d.format] as const)]);
    for (const m of [...l.lab.narrative, ...(l.lab.notes ?? [])]) for (const ref of m.text.matchAll(/\{(\w+)\}( [A-Za-z/]+(?: [A-Za-z]+)?)/g)) {
      const unit = unitOf.get(ref[1]); if (!unit || formatOf.get(ref[1]) === 'percent') continue;
      const after = ref[2].trim().toLowerCase(); const u = unit.toLowerCase();
      if (after === u || after.startsWith(`${u} `) || (u === 'per day' && after.startsWith('a day'))) warn('lab.narrative', `"{${ref[1]}}" already shows its unit ("${unit}"), so the text repeats it: "…${ref[0].trim()}".`);
    }
    if (l.lab.tasks.length < 2) warn('lab.tasks', 'A lab usually needs 2 to 4 tasks so there is something to discover.');
    if (!l.lab.derived.some((d) => d.output)) warn('lab.derived', 'No formula has "output": true, so the learner sees no result tiles.');
    if (!l.lab.narrative.some((m) => m.when.trim() === 'true')) warn('lab.narrative', 'No fallback message with "when": "true". Some settings will show no headline.');
    if (!l.lab.sweep) warn('lab', 'No sweep chart. A chart of one input against one output usually teaches more than numbers alone.');
  }
  if (l.quiz) {
    for (const d of dupes(l.quiz.questions.map((q) => q.id))) err('quiz', `Question id ${d} is used twice.`);
    for (const q of l.quiz.questions) {
      if (dupes(q.options.map((o) => o.id)).length) err(`quiz ${q.id}`, 'Two options share an id.');
      if (!q.options.some((o) => o.id === q.correct)) err(`quiz ${q.id}`, `The correct answer "${q.correct}" is not one of the options.`);
      const lens = q.options.map((o) => o.text.length); if (Math.max(...lens) > 3 * Math.max(8, Math.min(...lens)) && q.options.find((o) => o.text.length === Math.max(...lens))?.id === q.correct) warn(`quiz ${q.id}`, 'The correct answer is much longer than the others, which gives it away.');
    }
    if (l.quiz.questions.length < 3) warn('quiz', 'Three or more questions make a pass score meaningful.');
    if (Math.round(l.quiz.passScore * l.quiz.questions.length) < 1) err('quiz.passScore', 'At this pass score nobody needs to get any answer right.');
  }
  for (const d of dupes(l.lab?.tasks.map((t) => t.id) ?? [])) err('lab.tasks', `Task id ${d} is used twice.`);
  for (const [i, b] of l.blocks.entries()) if (b.type === 'paragraph' && b.text.length > 700) warn(`blocks[${i}]`, 'This paragraph is long. Split it, or move part of it into a list or example.');
  if (!l.blocks.some((b) => b.type === 'example')) warn('blocks', 'No worked example. A concrete example with numbers helps most learners.');
  if (!l.blocks.some((b) => b.type === 'heading')) warn('blocks', 'No headings. Add some so the lesson can be scanned.');
  const estimate = Math.ceil(l.blocks.reduce((a, b) => a + words(JSON.stringify(b).replace(/[{}"\[\]:,]/g, ' ')), 0) / 180) + (l.lab ? 6 : 0) + (l.quiz ? 3 : 0);
  if (l.minutes < estimate * 0.6 || l.minutes > estimate * 2.2) warn('minutes', `${l.minutes} minutes looks off. By word count and activities this takes roughly ${estimate}.`);
  for (const p of l.practice ?? []) if (ctx.questionIds && !ctx.questionIds.includes(p.questionId)) err('practice', `Unknown Studio question "${p.questionId}".`);

  if (ctx.roadmap) {
    const node = leaves(ctx.roadmap.nodes).find((n) => n.id === l.id);
    if (!node) err('roadmap', `"${l.id}" is not on the roadmap. Add a lesson node with this id to roadmap.json.`);
    else {
      if (node.status !== 'ready') err('roadmap', `The roadmap still lists "${l.id}" as planned. Change its status to "ready".`);
      if (!!node.hasLab !== !!l.lab) err('roadmap', `The roadmap says hasLab is ${!!node.hasLab} but the lesson ${l.lab ? 'has' : 'has no'} lab.`);
      if (!!node.hasQuiz !== !!l.quiz) err('roadmap', `The roadmap says hasQuiz is ${!!node.hasQuiz} but the lesson ${l.quiz ? 'has' : 'has no'} quiz.`);
      if (node.minutes !== l.minutes) err('roadmap', `The roadmap says ${node.minutes ?? 'no'} minutes but the lesson says ${l.minutes}.`);
    }
  }
  if (ctx.publish) {
    if (JSON.stringify(raw).includes('TODO')) err('content', 'Some text still says TODO.');
    if (!l.quiz && !l.lab) warn('lesson', 'No lab and no quiz. The learner can only mark it as read.');
  }
  return out;
}
