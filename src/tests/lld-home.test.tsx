import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import LLDHome from '../components/learn/LLDHome';
import { usePreferencesStore } from '../features/preferences/preferences.store';

beforeEach(() => {
  localStorage.clear();
  usePreferencesStore.getState().resetPreferences();
});

describe('LLD roadmap rendering', () => {
  it('renders with the default Java language preference', () => {
    render(<LLDHome />);
    expect(screen.getByText('LOW-LEVEL DESIGN · JAVA LEARNING PATH')).toBeInTheDocument();
    expect(screen.getByText('Java examples where available')).toBeInTheDocument();
  });

  it('updates the roadmap language label when the global preference changes', () => {
    render(<LLDHome />);
    usePreferencesStore.getState().setGlobalProgrammingLanguage('python');
    expect(screen.getByText('LOW-LEVEL DESIGN · PYTHON LEARNING PATH')).toBeInTheDocument();
    expect(screen.getByText('Python examples where available')).toBeInTheDocument();
  });
});
