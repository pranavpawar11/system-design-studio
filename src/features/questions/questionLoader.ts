import type { QuestionSpec } from './question.types';

export class QuestionLoadError extends Error {}

/** Validates the parts of the spec the frontend depends on; never fabricates missing content. */
export function parseQuestion(raw: unknown): QuestionSpec {
  const q = raw as Partial<QuestionSpec> | null;
  const problems: string[] = [];
  if (!q || typeof q !== 'object') throw new QuestionLoadError('Question JSON is not an object.');
  if (!q.question?.id) problems.push('question.id is missing');
  if (!Array.isArray(q.componentCatalogue?.components)) problems.push('componentCatalogue.components is missing');
  if (!Array.isArray(q.connectionTypes)) problems.push('connectionTypes is missing');
  if (!Array.isArray(q.capacityEstimation?.defaultInputs)) problems.push('capacityEstimation.defaultInputs is missing');
  if (problems.length) throw new QuestionLoadError(`Invalid question specification: ${problems.join('; ')}`);
  return q as QuestionSpec;
}

interface Extensions {
  components: QuestionSpec['componentCatalogue']['components']; connectionTypes: QuestionSpec['connectionTypes'];
  categories: Record<string, string>; addOperations: Record<string, string[]>; renames: Record<string, string>;
  configDefaults?: Record<string, Record<string, number | string | boolean>>;
  configSchemaPatch?: Record<string, NonNullable<QuestionSpec['componentCatalogue']['components'][number]['configSchema']>>;
  connectionPatches: Record<string, { addSourceOperations?: string[]; addTargetOperations?: string[] }>;
}
const addAll = (target: string[], extra: string[] = []) => { for (const x of extra) if (!target.includes(x)) target.push(x); };

/** Idempotently merges catalogue extensions into a question spec (never mutates the input). */
export function mergeExtensions(base: QuestionSpec, ext: Extensions): QuestionSpec {
  const s = structuredClone(base);
  const comps = s.componentCatalogue.components;
  for (const c of ext.components) {
    if (!comps.some((x) => x.id === c.id)) comps.push(structuredClone(c));
    addAll(s.componentCatalogue.allowedComponentIds, [c.id]);
  }
  for (const c of comps) {
    c.category ??= ext.categories[c.type];
    if (ext.renames[c.id]) c.displayName = ext.renames[c.id];
    addAll(c.supportedOperations, ext.addOperations[c.id]);
    if (ext.configDefaults?.[c.id]) c.defaultConfig = { ...ext.configDefaults[c.id], ...c.defaultConfig };
    if (ext.configSchemaPatch?.[c.id]) c.configSchema = { ...c.configSchema, ...ext.configSchemaPatch[c.id] };
  }
  for (const ct of ext.connectionTypes) if (!s.connectionTypes.some((x) => x.id === ct.id)) s.connectionTypes.push(structuredClone(ct));
  for (const ct of s.connectionTypes) {
    const p = ext.connectionPatches[ct.id];
    if (p) { addAll(ct.compatibleSourceOperations, p.addSourceOperations); addAll(ct.compatibleTargetOperations, p.addTargetOperations); }
  }
  return s;
}
