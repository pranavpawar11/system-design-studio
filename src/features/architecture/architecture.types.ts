export type ConfigValue = number | string | boolean;
export interface ArchNode {
  id: string; componentId: string; componentType: string; name: string;
  position: { x: number; y: number }; config: Record<string, ConfigValue>;
}
export interface ArchEdge { id: string; source: string; target: string; connectionTypeId: string; label?: string }
export interface ArchitectureDocument {
  schemaVersion: 1; questionId: string; questionVersion: number;
  nodes: ArchNode[]; edges: ArchEdge[];
}
