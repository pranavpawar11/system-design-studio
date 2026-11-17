import roadmapJson from '../../data/learning/roadmap.json';
import { leaves } from '../../features/learning/progress';
import { ApiError, type Lesson, type Roadmap } from '../contracts';

/** Bundled learning content. Together with questionCatalog this is the only code that reads src/data. A real back end replaces it. */
const lessonFiles = import.meta.glob('../../data/learning/lessons/*.json', { eager: true, import: 'default' }) as Record<string, Lesson>;
const roadmap = roadmapJson as unknown as Roadmap;
const lessons = new Map(Object.values(lessonFiles).map((l) => [l.id, l]));

export const catalogRoadmap = (): Roadmap => roadmap;
export function catalogLesson(id: string): Lesson {
  const l = lessons.get(id);
  if (!l) throw new ApiError(404, 'NOT_FOUND', `Lesson “${id}” does not exist yet.`);
  return l;
}
export const catalogHasNode = (id: string) => leaves(roadmap.nodes).some((n) => n.id === id);
