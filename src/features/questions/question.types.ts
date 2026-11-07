export interface ComponentDef {
  id: string; type: string; displayName: string; category?: string;
  responsibilities: string[]; supportedOperations: string[];
  defaultConfig: Record<string, number | string | boolean>;
  configSchema?: Record<string, { type: string; minimum?: number; maximum?: number; exclusiveMinimum?: number; enum?: string[] }>;
}
export interface ConnectionTypeDef {
  id: string; name: string; semantics: string;
  compatibleSourceOperations: string[]; compatibleTargetOperations: string[];
}
export interface CapacityInput { id: string; name: string; value: number; unit: string; configurable: boolean }
export interface QuestionSpec {
  schemaVersion: string;
  question: { id: string; version: number; title: string; difficulty: string };
  componentCatalogue: { allowedComponentIds: string[]; components: ComponentDef[] };
  connectionTypes: ConnectionTypeDef[];
  capacityEstimation: { defaultInputs: CapacityInput[] };
  hints: { id: string; level: number; text: string }[];
  [key: string]: unknown;
}
