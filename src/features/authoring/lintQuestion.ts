import Ajv, { type ErrorObject } from 'ajv';
import questionSchema from '../../../docs/question-authoring/schemas/question.schema.json';
import learningSchema from '../../../docs/question-authoring/schemas/learning.schema.json';
import type { QuestionSpec } from '../questions/question.types';
import { normalizeDifficulty } from '../questions/questionLoader';
import { validateDocument } from '../architecture/architecture.utils';
import { evaluate, hasEvaluator } from '../evaluation/evaluator';

export interface LintIssue { level: 'error' | 'warning'; where: string; message: string }
interface Options { publish?: boolean }

const ajv = new Ajv({ allErrors: true, strict: false });
const vSpec = ajv.compile(questionSchema); const vLearning = ajv.compile(learningSchema);
const fmt = (e: ErrorObject) => `${e.instancePath || '(root)'} ${e.message}${e.params && 'allowedValues' in e.params ? ` (${(e.params.allowedValues as string[]).join(', ')})` : ''}`;
const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
const MINUTES: Record<string, [number, number]> = { easy: [30, 45], medium: [45, 60], hard: [60, 90] };

/** Checks a question (already merged with any extensions) and its learning file. Pure: no file access. */
export function lintQuestion(specRaw: unknown, learningRaw: unknown | null, opts: Options = {}): LintIssue[] {
  const out: LintIssue[] = [];
  const err = (where: string, message: string) => out.push({ level: 'error', where, message });
  const warn = (where: string, message: string) => out.push({ level: 'warning', where, message });

  if (!vSpec(specRaw)) { for (const e of vSpec.errors ?? []) err('question file', fmt(e)); return out; }
  const spec = specRaw as unknown as QuestionSpec & { requirements: { functional: { id: string }[]; nonFunctional: { id: string }[] }; presentation?: { problemStatement?: { full?: string }; scope?: { inScope?: string[]; outOfScope?: string[] } }; evaluation?: { rules?: { id: string; requirementId?: string }[] } };
  const q = spec.question as QuestionSpec['question'] & { learningObjectives?: string[]; estimatedMinutes?: number };
  const reqs = [...spec.requirements.functional, ...spec.requirements.nonFunctional] as (typeof spec.requirements.functional[number] & { evaluationRuleIds?: string[] })[];
  const reqIds = reqs.map((r) => r.id);
  const comps = spec.componentCatalogue.components as (QuestionSpec['componentCatalogue']['components'][number])[];
  const compIds = comps.map((c) => c.id);

  if (['beginner', 'intermediate', 'advanced'].includes(String(q.difficulty))) warn('question.difficulty', `“${q.difficulty}” still loads, but use “${normalizeDifficulty(q.difficulty)}”.`);
  for (const d of dupes(reqIds)) err('requirements', `Requirement id ${d} is used twice.`);
  for (const d of dupes(compIds)) err('componentCatalogue.components', `Component id ${d} is defined twice.`);
  for (const id of spec.componentCatalogue.allowedComponentIds) if (!compIds.includes(id)) err('componentCatalogue.allowedComponentIds', `${id} is allowed but never defined in components.`);
  for (const id of compIds) if (!spec.componentCatalogue.allowedComponentIds.includes(id)) warn('componentCatalogue', `${id} is defined but not in allowedComponentIds, so learners cannot use it.`);
  for (const d of dupes(spec.connectionTypes.map((c) => c.id))) err('connectionTypes', `Connection type id ${d} is used twice.`);
  for (const d of dupes(spec.hints.map((h) => h.id))) err('hints', `Hint id ${d} is used twice.`);
  const levels = spec.hints.map((h) => h.level);
  if (levels.some((l, i) => i > 0 && l <= levels[i - 1])) err('hints', 'Hint levels must increase: 1, 2, 3 …, from vague to specific.');
  for (const d of dupes(spec.capacityEstimation.defaultInputs.map((i) => i.id))) err('capacityEstimation', `Input id ${d} is used twice.`);

  for (const c of comps) {
    if (!c.category) warn(`component ${c.id}`, 'No category. Set one unless this type is already built into the app, or it will show under Compute.');
    for (const [k, rule] of Object.entries(c.configSchema ?? {})) {
      if (!(k in c.defaultConfig)) { err(`component ${c.id}`, `configSchema has “${k}” but defaultConfig does not.`); continue; }
      const v = c.defaultConfig[k];
      if (rule.type === 'integer' && !Number.isInteger(v)) err(`component ${c.id}`, `Default for ${k} must be an integer.`);
      if (typeof v === 'number') {
        if (rule.minimum !== undefined && v < rule.minimum) err(`component ${c.id}`, `Default for ${k} is below its minimum.`);
        if (rule.maximum !== undefined && v > rule.maximum) err(`component ${c.id}`, `Default for ${k} is above its maximum.`);
        if (rule.exclusiveMinimum !== undefined && v <= rule.exclusiveMinimum) err(`component ${c.id}`, `Default for ${k} must be greater than ${rule.exclusiveMinimum}.`);
      }
      if (rule.enum && !rule.enum.includes(String(v))) err(`component ${c.id}`, `Default for ${k} is not one of its allowed values.`);
    }
  }
  const allOps = new Set(comps.flatMap((c) => c.supportedOperations));
  for (const ct of spec.connectionTypes) {
    for (const o of ct.compatibleSourceOperations) if (!allOps.has(o)) err(`connectionType ${ct.id}`, `Source operation “${o}” is supported by no component, so this connection can never be drawn.`);
    for (const o of ct.compatibleTargetOperations) if (!allOps.has(o)) err(`connectionType ${ct.id}`, `Target operation “${o}” is supported by no component, so this connection can never be drawn.`);
  }
  for (const r of spec.evaluation?.rules ?? []) if (r.requirementId && !reqIds.includes(r.requirementId)) err(`evaluation.rules ${r.id}`, `Refers to unknown requirement ${r.requirementId}.`);
  const ruleIds = (spec.evaluation?.rules ?? []).map((r) => r.id);
  if (ruleIds.length) for (const r of reqs) for (const id of r.evaluationRuleIds ?? []) if (!ruleIds.includes(id)) warn(`requirement ${r.id}`, `Refers to rule ${id}, which is not in evaluation.rules.`);

  if (!hasEvaluator(q.id)) (opts.publish ? err : warn)('evaluator', `No evaluator is registered for ${q.id}. Validate will mark every requirement “not evaluated”. See EVALUATOR-GUIDE.md.`);

  if (learningRaw === null) (opts.publish ? err : warn)('learning file', 'No learning file. Follow-ups, reference designs and revision advice will be missing.');
  else if (!vLearning(learningRaw)) for (const e of vLearning.errors ?? []) err('learning file', fmt(e));
  else {
    const L = learningRaw as { followUpQuestions: { id: string }[]; referenceSolutions: { id: string; name: string; architecture: unknown }[]; revisionRecommendations: { requirementIds: string[] }[] };
    for (const d of dupes(L.followUpQuestions.map((f) => f.id))) err('learning.followUpQuestions', `Follow-up id ${d} is used twice.`);
    for (const d of dupes(L.referenceSolutions.map((f) => f.id))) err('learning.referenceSolutions', `Reference id ${d} is used twice.`);
    L.revisionRecommendations.forEach((r, i) => r.requirementIds.forEach((id) => { if (!reqIds.includes(id)) err(`learning.revisionRecommendations[${i}]`, `Refers to unknown requirement ${id}.`); }));
    for (const ref of L.referenceSolutions) {
      const a = ref.architecture as { questionId: string; questionVersion: number };
      if (a.questionId !== q.id) err(`reference ${ref.id}`, `architecture.questionId is “${a.questionId}” but should be “${q.id}”.`);
      if (a.questionVersion !== q.version) warn(`reference ${ref.id}`, `architecture.questionVersion is ${a.questionVersion} but the question is version ${q.version}.`);
      const v = validateDocument(ref.architecture, spec);
      if (!v.ok) { v.errors.forEach((m) => err(`reference ${ref.id}`, m)); continue; }
      if (hasEvaluator(q.id)) {
        const rep = evaluate(spec, v.doc);
        const failed = rep.requirements.filter((r) => r.status === 'fail').map((r) => r.requirementId);
        if (failed.length) warn(`reference ${ref.id}`, `Fails ${failed.join(', ')}. That is fine only if its “limitations” say so.`);
      }
    }
    if (opts.publish) {
      if (L.followUpQuestions.length < 3) err('learning', 'Publish needs at least 3 follow-up questions.');
      if (L.referenceSolutions.length < 1) err('learning', 'Publish needs at least 1 reference solution.');
    }
  }

  if (opts.publish) {
    if (!spec.presentation?.problemStatement?.full) err('presentation', 'Publish needs presentation.problemStatement.full.');
    if ((spec.presentation?.scope?.inScope?.length ?? 0) < 3) err('presentation.scope', 'Publish needs at least 3 inScope items.');
    if ((spec.presentation?.scope?.outOfScope?.length ?? 0) < 2) err('presentation.scope', 'Publish needs at least 2 outOfScope items.');
    if ((q.learningObjectives?.length ?? 0) < 3) err('question.learningObjectives', 'Publish needs at least 3 learning objectives.');
    if (spec.hints.length < 5) err('hints', 'Publish needs 5 hints.');
    if (spec.requirements.functional.length < 3) err('requirements.functional', 'Publish needs at least 3 functional requirements.');
    if (spec.requirements.nonFunctional.length < 2) err('requirements.nonFunctional', 'Publish needs at least 2 non-functional requirements.');
    if (JSON.stringify([specRaw, learningRaw]).includes('TODO')) err('content', 'Some text still says TODO.');
    const band = MINUTES[normalizeDifficulty(q.difficulty)]; const m = q.estimatedMinutes;
    if (band && m && (m < band[0] || m > band[1])) warn('question.estimatedMinutes', `${m} minutes is outside the usual ${band[0]} to ${band[1]} for ${normalizeDifficulty(q.difficulty)} questions.`);
  }
  return out;
}
