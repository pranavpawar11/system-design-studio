import { compile, ExpressionError, type Compiled } from './expression';
import type { Format, LabSpec, Tone } from './types';

export class LabSpecError extends Error { readonly problems: string[]; constructor(problems: string[]) { super(problems.join('; ')); this.problems = problems; } }

export function formatValue(v: number, fmt: Format = 'decimal1', unit?: string): string {
  if (!Number.isFinite(v)) return '—';
  const n = fmt === 'integer' ? Math.round(v).toLocaleString('en-US') : fmt === 'percent' ? `${Math.round(v * 100).toLocaleString('en-US')}%` : v.toLocaleString('en-US', { minimumFractionDigits: fmt === 'decimal2' ? 2 : 0, maximumFractionDigits: fmt === 'decimal2' ? 2 : 1 });
  return unit && fmt !== 'percent' ? `${n} ${unit}` : n;
}

export interface CompiledLab {
  spec: LabSpec; derived: { id: string; c: Compiled }[];
  narrative: { c: Compiled; tone: Tone; text: string }[]; notes: { c: Compiled; tone: Tone; text: string }[];
  tasks: { id: string; text: string; c: Compiled }[];
}
/** Checks the whole lab up front, so a typo in a formula is found when the file is written, not when a learner opens it. */
export function compileLab(spec: LabSpec): CompiledLab {
  const problems: string[] = []; const known = new Set<string>();
  const dup = (id: string, where: string) => { if (known.has(id)) problems.push(`${where}: name "${id}" is used twice`); known.add(id); };
  const safe = <T,>(f: () => T, where: string): T | null => { try { return f(); } catch (e) { problems.push(`${where}: ${(e as Error).message}`); return null; } };
  const check = (c: Compiled | null, where: string) => { if (c) for (const n of c.names) if (!known.has(n)) problems.push(`${where}: unknown name "${n}"`); return c; };

  for (const i of spec.inputs) {
    dup(i.id, `input ${i.id}`);
    if ((i.type ?? 'slider') === 'slider' && !(typeof i.min === 'number' && typeof i.max === 'number' && typeof i.step === 'number' && i.min < i.max && i.step > 0)) problems.push(`input ${i.id}: a slider needs min < max and step > 0`);
    if (i.type !== 'toggle' && typeof i.min === 'number' && typeof i.max === 'number' && (i.default < i.min || i.default > i.max)) problems.push(`input ${i.id}: default is outside min..max`);
  }
  const derived = spec.derived.flatMap((d) => { const c = check(safe(() => compile(d.formula), `formula ${d.id}`), `formula ${d.id}`); dup(d.id, `formula ${d.id}`); return c ? [{ id: d.id, c }] : []; });
  const msg = (m: { when: string; tone: Tone; text: string }, where: string) => { const c = check(safe(() => compile(m.when), where), where); for (const ref of m.text.matchAll(/\{(\w+)\}/g)) if (!known.has(ref[1])) problems.push(`${where}: text mentions unknown name "${ref[1]}"`); return c ? { c, tone: m.tone, text: m.text } : null; };
  const narrative = spec.narrative.map((m, i) => msg(m, `narrative ${i + 1}`)).filter((x) => x !== null);
  const notes = (spec.notes ?? []).map((m, i) => msg(m, `note ${i + 1}`)).filter((x) => x !== null);
  const tasks = spec.tasks.flatMap((t) => { const c = check(safe(() => compile(t.check), `task ${t.id}`), `task ${t.id}`); return c ? [{ id: t.id, text: t.text, c }] : []; });
  if (spec.sweep) {
    const s = spec.sweep; const inp = spec.inputs.find((i) => i.id === s.input);
    if (!inp || (inp.type ?? 'slider') !== 'slider') problems.push(`sweep: "${s.input}" must be a slider input`);
    if (!spec.derived.some((d) => d.id === s.output)) problems.push(`sweep: unknown output "${s.output}"`);
    if (s.reference && !known.has(s.reference.value)) problems.push(`sweep: unknown reference "${s.reference.value}"`);
  }
  for (const sc of spec.scenarios ?? []) for (const k of Object.keys(sc.set)) if (!spec.inputs.some((i) => i.id === k)) problems.push(`scenario "${sc.label}": unknown input "${k}"`);
  if (!narrative.length) problems.push('narrative: at least one message is needed');
  if (!tasks.length) problems.push('tasks: at least one task is needed');
  if (problems.length) throw new LabSpecError(problems);
  return { spec, derived, narrative: narrative as CompiledLab['narrative'], notes: notes as CompiledLab['notes'], tasks };
}

export const defaultsOf = (spec: LabSpec) => Object.fromEntries(spec.inputs.map((i) => [i.id, i.default]));

export interface LabResult {
  values: Record<string, number>;
  outputs: { id: string; label: string; unit?: string; text: string; value: number }[];
  headline: { tone: Tone; text: string } | null; notes: { tone: Tone; text: string }[];
  tasksMet: Record<string, boolean>;
}
export function runLab(lab: CompiledLab, inputs: Record<string, number>): LabResult {
  const values: Record<string, number> = { ...inputs };
  for (const d of lab.derived) values[d.id] = d.c.evaluate(values);
  const meta = (id: string) => lab.spec.inputs.find((i) => i.id === id) ?? lab.spec.derived.find((d) => d.id === id);
  const say = (text: string) => text.replace(/\{(\w+)\}/g, (_, id: string) => { const m = meta(id) as { format?: Format; unit?: string } | undefined; return Object.prototype.hasOwnProperty.call(values, id) ? formatValue(values[id], m?.format ?? 'decimal1', m?.unit) : '—'; });
  const on = (c: Compiled) => c.evaluate(values) === 1;
  const head = lab.narrative.find((m) => on(m.c));
  return {
    values,
    outputs: lab.spec.derived.filter((d) => d.output).map((d) => ({ id: d.id, label: d.label ?? d.id, unit: d.unit, value: values[d.id], text: formatValue(values[d.id], d.format ?? 'decimal1', d.unit) })),
    headline: head ? { tone: head.tone, text: say(head.text) } : null,
    notes: lab.notes.filter((m) => on(m.c)).map((m) => ({ tone: m.tone, text: say(m.text) })),
    tasksMet: Object.fromEntries(lab.tasks.map((t) => [t.id, on(t.c)])),
  };
}

/** Vary one slider across its range, holding the others, and read one output: the data for the lab chart. */
export function sweep(lab: CompiledLab, inputs: Record<string, number>, points = 41) {
  const s = lab.spec.sweep; if (!s) return null;
  const inp = lab.spec.inputs.find((i) => i.id === s.input)!;
  const xs = Array.from({ length: points }, (_, k) => inp.min! + ((inp.max! - inp.min!) * k) / (points - 1));
  const ys = xs.map((x) => runLab(lab, { ...inputs, [s.input]: x }).values[s.output]);
  const ref = s.reference ? runLab(lab, inputs).values[s.reference.value] : null;
  return { xs, ys, ref };
}
export { ExpressionError };
