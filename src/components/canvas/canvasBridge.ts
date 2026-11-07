/** Lets components outside the React Flow provider (the top bar) trigger canvas-only actions. */
export const bridge: { exportPng: (() => Promise<void>) | null } = { exportPng: null };
