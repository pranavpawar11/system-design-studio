import { question } from '../architecture/architecture.store';

interface Req { id: string; title: string }
const spec = question.requirements as { functional?: Req[]; nonFunctional?: Req[] } | undefined;

/** Plain-language grouping so learners need not know the FR/NFR jargon. */
export const REQ_GROUPS: { label: string; hint: string; items: Req[] }[] = [
  { label: 'What the system must do', hint: 'Features and behaviour users rely on', items: spec?.functional ?? [] },
  { label: 'How well it must do it', hint: 'Speed, scale, reliability and data safety', items: spec?.nonFunctional ?? [] },
].filter((g) => g.items.length > 0);

export const reqTitle = (id: string) => REQ_GROUPS.flatMap((g) => g.items).find((r) => r.id === id)?.title ?? id;
