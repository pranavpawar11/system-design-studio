import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument } from './architecture.types';
import { checkConnection } from './connectionRules';

export type DocResult = { ok: true; doc: ArchitectureDocument } | { ok: false; errors: string[] };

/** Validates untrusted JSON (imported files, drafts, share links) before it is allowed to replace the design. */
export function validateDocument(raw: unknown, spec: QuestionSpec): DocResult {
  const errors: string[] = [];
  const d = raw as Partial<ArchitectureDocument> | null;
  if (!d || typeof d !== 'object') return { ok: false, errors: ['File is not a JSON object.'] };
  if (d.schemaVersion !== 1) errors.push('Unsupported schemaVersion (expected 1).');
  if (d.questionId !== spec.question.id) errors.push(`Design belongs to question "${String(d.questionId)}", not "${spec.question.id}".`);
  if (!Array.isArray(d.nodes) || !Array.isArray(d.edges)) return { ok: false, errors: [...errors, 'nodes and edges must be arrays.'] };
  const ids = new Set<string>();
  for (const n of d.nodes) {
    if (!n || typeof n.id !== 'string' || typeof n.componentId !== 'string' || !n.position || typeof n.config !== 'object') { errors.push('A node is malformed.'); continue; }
    if (ids.has(n.id)) errors.push(`Duplicate node ID ${n.id}.`);
    ids.add(n.id);
    if (!spec.componentCatalogue.allowedComponentIds.includes(n.componentId)) errors.push(`Unsupported component type: ${n.componentId}.`);
  }
  const edgeIds = new Set<string>();
  const full = d as ArchitectureDocument;
  for (const e of d.edges) {
    if (!e || typeof e.id !== 'string') { errors.push('An edge is malformed.'); continue; }
    if (edgeIds.has(e.id)) errors.push(`Duplicate edge ID ${e.id}.`);
    edgeIds.add(e.id);
    const r = checkConnection(spec, full, e.source, e.target, e.connectionTypeId);
    if (!r.ok) errors.push(`Edge ${e.id}: ${r.reason}`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, doc: full };
}
