import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../app/App';
import { useStudio } from '../features/architecture/architecture.store';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';
import solved from './fixtures/url-shortener-solved.json';

describe('findings are keyboard-reachable', () => {
  it('uses a real button to show a finding on the canvas', async () => {
    const d = structuredClone(solved) as unknown as ArchitectureDocument;
    d.nodes.find((n) => n.componentType === 'application-server')!.config.instances = 1; // triggers capacity findings with node evidence
    useStudio.getState().replaceDoc(d);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }));
    const btn = (await screen.findAllByRole('button', { name: 'Show on canvas' }))[0];
    await userEvent.click(btn);
    expect(useStudio.getState().highlight.length).toBeGreaterThan(0);
    expect(document.querySelectorAll('div.finding[onclick], .finding[role=button]').length).toBe(0);
  });
});
