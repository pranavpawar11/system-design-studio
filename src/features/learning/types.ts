/** Learning content and progress. Content is authored as JSON (docs/learning-authoring); progress is a list of events. */
import type { ProgrammingLanguage } from './programming-language';

export type NodeKind = 'topic' | 'group' | 'lesson';
export interface RoadmapNode {
  id: string; title: string; summary?: string; kind: NodeKind;
  /** ready = the lesson exists. planned = on the map but not written yet. */
  status: 'ready' | 'planned';
  children?: RoadmapNode[];
  minutes?: number; hasLab?: boolean; hasQuiz?: boolean;
  /** Topics that help but never block. Shown as "also helps with". */
  relatedTo?: string[];
}
export interface Roadmap { version: number; nodes: RoadmapNode[] }

export type Format = 'integer' | 'decimal1' | 'decimal2' | 'percent';
export type Tone = 'ok' | 'warn' | 'bad' | 'info';

export type LessonBlock =
  | { type: 'heading'; level?: 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'callout'; tone: 'info' | 'tip' | 'warning'; title?: string; text: string }
  | { type: 'example'; title: string; text: string }
  | { type: 'formula'; expression: string; caption?: string; variables?: { name: string; meaning: string }[] };

export interface LabInput { id: string; label: string; unit?: string; type?: 'slider' | 'toggle'; min?: number; max?: number; step?: number; default: number; format?: Format; help?: string }
export interface LabDerived { id: string; label?: string; unit?: string; formula: string; format?: Format; output?: boolean }
export interface LabMessage { when: string; tone: Tone; text: string }
export interface LabSpec {
  title: string; intro: string; inputs: LabInput[]; derived: LabDerived[];
  /** First message whose `when` is true is shown as the headline. */
  narrative: LabMessage[];
  /** Every message whose `when` is true is listed under "Also worth noticing". */
  notes?: LabMessage[];
  sweep?: { input: string; output: string; title: string; reference?: { label: string; value: string } };
  scenarios?: { label: string; set: Record<string, number> }[];
  tasks: { id: string; text: string; check: string }[];
}

export interface QuizQuestion { id: string; prompt: string; options: { id: string; text: string }[]; correct: string; explanation: string }
export interface Quiz { passScore: number; questions: QuizQuestion[] }

export interface LessonLanguageVariant {
  /** Optional language-specific summary when the implementation changes the explanation. */
  summary?: string;
  /** Full language-specific block replacement (legacy option). */
  blocks?: LessonBlock[];
  /** Sparse replacements keyed by the shared lesson block index. */
  blockOverrides?: Record<number, LessonBlock>;
  /** Additional notes for language-specific idioms, runtime behavior, or conventions. */
  implementationNotes?: LessonBlock[];
}

export interface Lesson {
  id: string; title: string; summary: string; minutes: number;
  blocks: LessonBlock[]; lab?: LabSpec; quiz?: Quiz;
  /** Optional variants; shared lesson content remains the fallback when a variant is absent. */
  languageVariants?: Partial<Record<ProgrammingLanguage, LessonLanguageVariant>>;
  /** Studio questions that practise this lesson. */
  practice?: { questionId: string; label: string }[];
}

export type ProgressEventType = 'lesson_viewed' | 'lesson_read' | 'lab_completed' | 'quiz_passed';
export interface ProgressEvent { nodeId: string; type: ProgressEventType; score?: number; at: string }
