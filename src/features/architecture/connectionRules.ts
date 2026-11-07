import type { QuestionSpec } from '../questions/question.types';
import type { ArchitectureDocument } from './architecture.types';

export interface ConnectionCheck { ok: boolean; reason?: string }

/** Pure, UI-independent. Compatibility comes from the spec's connectionTypes contracts. */
export function checkConnection(
  spec: QuestionSpec, doc: ArchitectureDocument,
  sourceId: string, targetId: string, connectionTypeId: string,
): ConnectionCheck {
  const src = doc.nodes.find((n) => n.id === sourceId);
  const tgt = doc.nodes.find((n) => n.id === targetId);
  if (!src || !tgt) return { ok: false, reason: 'Source or target node does not exist.' };
  const ct = spec.connectionTypes.find((c) => c.id === connectionTypeId);
  if (!ct) return { ok: false, reason: `Connection type "${connectionTypeId}" is not supported by this question.` };
  const comps = spec.componentCatalogue.components;
  const sOps = comps.find((c) => c.id === src.componentId)?.supportedOperations ?? [];
  const tOps = comps.find((c) => c.id === tgt.componentId)?.supportedOperations ?? [];
  if (!sOps.some((o) => ct.compatibleSourceOperations.includes(o)))
    return { ok: false, reason: `${src.name} cannot be the source of a "${ct.name}" connection.` };
  if (!tOps.some((o) => ct.compatibleTargetOperations.includes(o)))
    return { ok: false, reason: `${tgt.name} cannot be the target of a "${ct.name}" connection.` };
  return { ok: true };
}

/** Which connection types could join two nodes (used for the default edge type). */
export function compatibleTypes(spec: QuestionSpec, doc: ArchitectureDocument, s: string, t: string) {
  return spec.connectionTypes.filter((c) => checkConnection(spec, doc, s, t, c.id).ok);
}
