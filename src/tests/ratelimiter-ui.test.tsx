import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';
import solved from './fixtures/rate-limiter-solved.json';

// Select the second question BEFORE the app (and its store) is loaded.
localStorage.setItem('hld-studio:question:v1', 'hld-rate-limiter-001');
const { default: App } = await import('../app/App');
const { useStudio, question } = await import('../features/architecture/architecture.store');

describe('Rate Limiter question in the real UI', () => {
  it('boots with its own question, components and plain-language requirements', async () => {
    render(<App />);
    expect(question.question.id).toBe('hld-rate-limiter-001');
    expect(screen.getByLabelText('Add Rate Limiter')).toBeInTheDocument();
    expect(screen.queryByLabelText('Add Distributed Cache')).not.toBeInTheDocument();   // URL-shortener-only component
    await userEvent.click(screen.getByRole('tab', { name: 'Question' }));
    expect(screen.getByText('What the system must do')).toBeInTheDocument();
    expect(screen.getByText('Check every request before it reaches the service')).toBeInTheDocument();
  });

  it('shows the problem statement it ships with', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Question' }));
    expect(screen.getByText(/Design a rate limiter for a public API/)).toBeInTheDocument();
    expect(screen.getByText('What you will practise')).toBeInTheDocument();
  });

  it('validates the reference design, shows the metrics tab and a clean summary', async () => {
    useStudio.getState().replaceDoc(solved as unknown as ArchitectureDocument);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Validate/ }));
    expect(await screen.findByText('Requirements met')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Metrics' }));
    expect(screen.getByText('Requests per second')).toBeInTheDocument();
    expect(screen.getAllByText('Counter Store (Redis-style)').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Practice' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Learning summary/ }));
    expect(screen.getByText('7/7')).toBeInTheDocument();
  });
});
