import type { ArchitectureDocument } from '../architecture/architecture.types';

export interface Comparison { shared: string[]; missing: string[]; extra: string[] }
const count = (d: ArchitectureDocument) => d.nodes.reduce<Record<string, number>>((m, n) => ({ ...m, [n.componentType]: (m[n.componentType] ?? 0) + 1 }), {});

/** Component-type comparison only. A different design is not a wrong design; evaluation is by requirements. */
export function compareWithReference(mine: ArchitectureDocument, ref: ArchitectureDocument): Comparison {
  const a = count(mine); const b = count(ref);
  return {
    shared: Object.keys(b).filter((t) => a[t]),
    missing: Object.keys(b).filter((t) => !a[t]),
    extra: Object.keys(a).filter((t) => !b[t]),
  };
}
