import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../app/App';
import { useStudio } from '../features/architecture/architecture.store';
import solved from './fixtures/url-shortener-solved.json';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';

async function choose(menu: string, item: string) {
  await userEvent.click(screen.getByRole('button', { name: menu }));
  await userEvent.click(screen.getByRole('menuitem', { name: new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }));
}

beforeEach(() => {
  localStorage.clear();
  const s = useStudio.getState(); s.reset();
  useStudio.setState({ past: [], future: [], hints: [], answers: {}, report: null, selNode: null, selEdge: null, highlight: [], toast: null, leftOpen: true, rightOpen: true });
});

describe('HLD Studio UI', () => {
  it('loads the URL Shortener question with a categorized library', () => {
    render(<App />);
    expect(screen.getByText('Design a URL Shortener')).toBeInTheDocument();
    expect(screen.getByText('Networking')).toBeInTheDocument();
    expect(screen.getByText('Start your design')).toBeInTheDocument();
  });

  it('collapses and searches library categories', async () => {
    render(<App />);
    expect(screen.getByLabelText('Add Client')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Collapse all'));
    expect(screen.queryByLabelText('Add Client')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Search components'), 'cache');
    expect(screen.getByLabelText('Add Distributed Cache')).toBeInTheDocument();
  });

  it('adds a component with the click alternative and opens the inspector', async () => {
    render(<App />);
    await userEvent.click(screen.getByLabelText('Add Application Server'));
    expect(useStudio.getState().doc.nodes).toHaveLength(1);
    expect(await screen.findByLabelText('Instance name')).toHaveValue('Application Server');
    expect(screen.queryByText('Start your design')).not.toBeInTheDocument();
  });

  it('shows inspector when a node on the canvas is selected', async () => {
    render(<App />);
    await userEvent.click(screen.getByLabelText('Add Client'));
    useStudio.getState().select(null, null);
    await waitFor(() => expect(screen.getByText('Design guidance')).toBeInTheDocument());
    const node = document.querySelector('.react-flow__node');
    expect(node).not.toBeNull();
    fireEvent.click(node!);
    expect(await screen.findByLabelText('Instance name')).toBeInTheDocument();
  });

  it('reveals hints one at a time and counts them', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Question' }));
    await userEvent.click(screen.getByText(/Reveal hint 1/));
    expect(screen.getByText(/creating a short URL or redirecting/)).toBeInTheDocument();
    expect(screen.queryByText(/creation path and redirect path separately/)).not.toBeInTheDocument();
    expect(useStudio.getState().hints).toHaveLength(1);
  });

  it('runs validation and shows requirement coverage in Results', async () => {
    useStudio.getState().replaceDoc(solved as unknown as ArchitectureDocument);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Validate/ }));
    expect(await screen.findByText('Requirements met')).toBeInTheDocument();
    expect(screen.getAllByText('Create a short URL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('✓ Met').length).toBeGreaterThan(3);
  });

  it('shows an empty-design validation without crashing', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Validate/ }));
    expect(await screen.findByText('Not met')).toBeInTheDocument();
  });

  it('rejects an invalid import with a clear message and keeps the design', async () => {
    render(<App />);
    await userEvent.click(screen.getByLabelText('Add Client'));
    const input = screen.getByLabelText('Import design JSON') as HTMLInputElement;
    await userEvent.upload(input, new File(['not json'], 'bad.json', { type: 'application/json' }));
    expect(await screen.findByText(/Import failed: file is not valid JSON/)).toBeInTheDocument();
    const bad = { ...(solved as object), nodes: [{ id: 'x', componentId: 'COMP-NOPE', componentType: 'x', name: 'X', position: { x: 0, y: 0 }, config: {} }], edges: [] };
    await userEvent.upload(input, new File([JSON.stringify(bad)], 'bad2.json', { type: 'application/json' }));
    expect(await screen.findByText(/Import rejected: .*Unsupported component type/)).toBeInTheDocument();
    expect(useStudio.getState().doc.nodes).toHaveLength(1);
  });

  it('imports a valid design', async () => {
    render(<App />);
    await userEvent.upload(screen.getByLabelText('Import design JSON'), new File([JSON.stringify(solved)], 'ok.json', { type: 'application/json' }));
    await waitFor(() => expect(useStudio.getState().doc.nodes.length).toBe(6));
  });

  it('asks for confirmation before reset, and cancel keeps the design', async () => {
    render(<App />);
    await userEvent.click(screen.getByLabelText('Add Client'));
    await choose('File', 'Reset design…');
    const dlg = screen.getByRole('dialog', { name: 'Reset design' });
    await userEvent.click(within(dlg).getByText('Cancel'));
    expect(useStudio.getState().doc.nodes).toHaveLength(1);
    await choose('File', 'Reset design…');
    await userEvent.click(within(screen.getByRole('dialog')).getByText('Reset design'));
    expect(useStudio.getState().doc.nodes).toHaveLength(0);
  });

  it('shows what-if capacity in the Metrics tab', async () => {
    useStudio.getState().replaceDoc(solved as unknown as ArchitectureDocument);
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Metrics' }));
    expect(screen.getByLabelText('Scenario')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Cache is unavailable'));
    expect(await screen.findByText(/No usable cache: every redirect reads the database/)).toBeInTheDocument();
  });

  it('keeps the reference solutions hidden until requested, then loads one', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Reference' }));
    expect(screen.queryByText('Minimal valid architecture')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Show reference solutions'));
    await userEvent.click(screen.getByText('Minimal valid architecture'));
    await userEvent.click(screen.getByText('Load onto canvas'));
    expect(useStudio.getState().doc.nodes.length).toBe(4);
  });

  it('shows plain-language requirement groups instead of FR/NFR codes', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Question' }));
    expect(screen.getByText('What the system must do')).toBeInTheDocument();
    expect(screen.getByText('How well it must do it')).toBeInTheDocument();
    expect(screen.queryByText(/^FR-01/)).not.toBeInTheDocument();
    expect(screen.getByText('Create a short URL')).toBeInTheDocument();
  });

  it('resizes a panel from the keyboard and toggles canvas widgets', async () => {
    render(<App />);
    const before = useStudio.getState().leftWidth;
    screen.getByLabelText('Resize left panel').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(useStudio.getState().leftWidth).toBe(before + 16);
    await userEvent.click(screen.getByRole('button', { name: 'Mini-map' }));
    expect(useStudio.getState().showMinimap).toBe(false);
    expect(document.querySelector('.react-flow__minimap')).toBeNull();
  });

  it('toggles the side panels to give the canvas more room', async () => {
    render(<App />);
    await userEvent.click(screen.getByLabelText('Toggle left panel'));
    expect(screen.queryByLabelText('Library and question')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Toggle right panel'));
    expect(screen.queryByLabelText('Inspector')).not.toBeInTheDocument();
  });
});

describe('v4 UI', () => {
  it('capacity estimates are read-only (no editable fields)', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Question' }));
    const section = screen.getByText('Capacity estimates').closest('details')!;
    expect(within(section).queryAllByRole('spinbutton')).toHaveLength(0);
    expect(within(section).getByText(/fixed for this question/)).toBeInTheDocument();
    expect(within(section).getByText('New URLs per day')).toBeInTheDocument();
  });

  it('hints are progressive: only the next one can be revealed, and used ones can be hidden', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Question' }));
    expect(screen.getAllByText(/Locked/)).toHaveLength(4);
    await userEvent.click(screen.getByText('Reveal hint 1'));
    await userEvent.click(screen.getByText('Hide'));
    expect(screen.getByText(/Hidden\. Click Show/)).toBeInTheDocument();
    expect(useStudio.getState().hints).toHaveLength(1);
  });

  it('outline lists components and connections and focuses a component on click', async () => {
    useStudio.getState().replaceDoc(solved as unknown as ArchitectureDocument);
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Outline' }));
    expect(screen.getByText('Components (6)')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Load Balancer', { selector: 'b' }));
    expect(useStudio.getState().selNode).toBe('node_ixqe5xmkt');
  });

  it('file menu offers JSON and PNG export, and refuses to claim a PNG for an empty design', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByRole('menuitem', { name: /Export design \(JSON\)/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: /Export diagram \(PNG\)/ }));
    expect(await screen.findByText('Add components before exporting an image.')).toBeInTheDocument();
  });

  it('learning summary opens and is honest before validation', async () => {
    render(<App />);
    await choose('Practice', 'Learning summary');
    const dlg = screen.getByRole('dialog', { name: 'Learning summary' });
    expect(within(dlg).getByText('Not validated yet')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByText('Close'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers both questions in the question switcher', () => {
    render(<App />);
    const sel = screen.getByLabelText('Choose question');
    expect(within(sel).getByText('Design a Rate Limiter')).toBeInTheDocument();
  });

  it('multi-selected components show group actions in the inspector', async () => {
    useStudio.getState().replaceDoc(solved as unknown as ArchitectureDocument);
    render(<App />);
    useStudio.getState().selectAll();
    expect(await screen.findByText('6 components selected')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Duplicate'));
    expect(useStudio.getState().doc.nodes).toHaveLength(12);
  });
});

import { vi } from 'vitest';
import { encodeShare } from '../api/local/shareCodec';
import v2 from './fixtures/url-shortener-solved-v2.json';

describe('v5 UI', () => {
  beforeEach(() => { useStudio.setState({ snapshots: [], interview: null, shared: null, selIds: [] }); window.location.hash = ''; });

  it('auto-layout rearranges the diagram and can be undone in one step', async () => {
    const d = structuredClone(v2) as unknown as ArchitectureDocument; d.nodes.forEach((n, i) => { n.position = { x: i, y: i }; });
    useStudio.getState().replaceDoc(d); useStudio.setState({ past: [] });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Auto-layout' }));
    const xs = useStudio.getState().doc.nodes.map((n) => n.position.x);
    expect(new Set(xs).size).toBeGreaterThan(3);
    await userEvent.click(screen.getByLabelText('Undo'));
    expect(useStudio.getState().doc.nodes[1].position).toEqual({ x: 1, y: 1 });
  });

  it('aligns a multi-selection from the inspector', async () => {
    useStudio.getState().replaceDoc(v2 as unknown as ArchitectureDocument);
    render(<App />);
    useStudio.getState().selectAll();
    await userEvent.click(await screen.findByLabelText('Align left edges'));
    expect(new Set(useStudio.getState().doc.nodes.map((n) => n.position.x)).size).toBe(1);
  });

  it('copies a share link, and falls back to a visible link when the clipboard is blocked', async () => {
    useStudio.getState().replaceDoc(v2 as unknown as ArchitectureDocument);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<App />);
    await choose('File', 'Copy share link');
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('#share=');
    writeText.mockRejectedValueOnce(new Error('blocked'));
    await choose('File', 'Copy share link');
    expect(await screen.findByRole('dialog', { name: 'Share link' })).toBeInTheDocument();
  });

  it('offers to open a design from a share link without overwriting silently', async () => {
    const payload = await encodeShare('hld-url-shortener-001', v2);
    window.location.hash = `#share=${payload}`;
    render(<App />);
    expect(await screen.findByText(/A shared design was found/)).toBeInTheDocument();
    expect(useStudio.getState().doc.nodes).toHaveLength(0);
    await userEvent.click(screen.getByText('Open it'));
    expect(useStudio.getState().doc.nodes).toHaveLength(13);
  });

  it('shows a clear error for a damaged share link', async () => {
    window.location.hash = '#share=z.broken';
    render(<App />);
    expect(await screen.findByText(/damaged or not a HLD Studio design/)).toBeInTheDocument();
  });

  it('saves a version from History, compares it with later changes, and confirms before deleting', async () => {
    useStudio.getState().replaceDoc(v2 as unknown as ArchitectureDocument);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByText('No versions yet')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Version name'), 'Before trimming');
    await userEvent.click(screen.getByRole('button', { name: /Save version/ }));
    expect(await screen.findByText('Before trimming')).toBeInTheDocument();
    useStudio.getState().removeNode('logs');
    await userEvent.click(screen.getByLabelText(/Compare Before trimming/));
    const dlg = await screen.findByRole('dialog', { name: 'Compare with snapshot' });
    expect(within(dlg).getByText('Components removed')).toBeInTheDocument();
    expect(within(dlg).getByText('Logging & Tracing')).toBeInTheDocument();
    expect(await within(dlg).findByText('No requirement changed status.')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByText('Close'));
    await userEvent.click(screen.getByLabelText('Delete Before trimming'));
    expect(screen.getByText('Delete this version?')).toBeInTheDocument();
    expect(useStudio.getState().snapshots).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(useStudio.getState().snapshots).toHaveLength(1);
    await userEvent.click(screen.getByLabelText('Delete Before trimming'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(useStudio.getState().snapshots).toHaveLength(0));
  });

  it('runs an interview session: locks hints, shows the clock, then summarises it', async () => {
    render(<App />);
    await choose('Practice', 'Interview mode');
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Start interview session' })).getByText('Start session'));
    expect(screen.getByRole('timer')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Question' }));
    expect(screen.getByText('Disabled in interview mode')).toBeDisabled();
    await userEvent.click(screen.getByRole('tab', { name: 'Reference' }));
    expect(screen.getByText('Locked during the interview')).toBeInTheDocument();
    await userEvent.click(screen.getByText('End session'));
    const dlg = screen.getByRole('dialog', { name: 'Learning summary' });
    expect(within(dlg).getByText('Interview session')).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
});


import { api, ApiError } from '../api';

describe('v6 accessibility and states', () => {
  it('has one h1, a skip link and a labelled main region', () => {
    render(<App />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Skip to the canvas' })).toHaveAttribute('href', '#canvas');
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('dialogs close on Escape and give focus back to the control that opened them', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    const opener = screen.getByRole('button', { name: 'History' });
    expect(screen.getByRole('dialog', { name: 'Version history' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('keeps Tab inside an open dialog', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    const dlg = screen.getByRole('dialog', { name: 'Version history' });
    for (let i = 0; i < 8; i++) { await userEvent.tab(); expect(dlg.contains(document.activeElement)).toBe(true); }
  });

  it('menus open with the keyboard, move with arrows, and close on Escape', async () => {
    render(<App />);
    const file = screen.getByRole('button', { name: 'File' });
    file.focus(); await userEvent.keyboard('{Enter}');
    const items = screen.getAllByRole('menuitem');
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}'); expect(items[1]).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}'); expect(items[items.length - 1]).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument(); expect(file).toHaveFocus();
  });

  it('shows saving and failed states, and lets the learner retry', async () => {
    const spy = vi.spyOn(api, 'saveDraft').mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server.'));
    render(<App />);
    await choose('File', 'Save now');
    expect(await screen.findByText(/Save failed/)).toBeInTheDocument();
    expect(await screen.findByText(/Could not save: Could not reach the server/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText(/Save failed/)).not.toBeInTheDocument());
    spy.mockRestore();
  });

  it('shows a validating state while the API works, and ignores double clicks', async () => {
    let release: (v: Awaited<ReturnType<typeof api.evaluate>>) => void = () => {};
    const spy = vi.spyOn(api, 'evaluate').mockImplementation(() => new Promise((r) => { release = r; }));
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }));
    const busy = await screen.findByRole('button', { name: 'Validating…' });
    expect(busy).toBeDisabled();
    release({ findings: [], requirements: [], limitations: [] });
    expect(await screen.findByRole('button', { name: 'Validate' })).toBeEnabled();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('reports a failed validation instead of hanging', async () => {
    const spy = vi.spyOn(api, 'evaluate').mockRejectedValueOnce(new ApiError(500, 'SERVER_ERROR', 'The server returned 500.'));
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }));
    expect(await screen.findByText(/Validation failed: The server returned 500/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Validate' })).toBeEnabled();
    spy.mockRestore();
  });

  it('puts the link-type control on the canvas, not in the top bar', () => {
    render(<App />);
    expect(screen.getByLabelText('New connection type').closest('.canvas-wrap')).not.toBeNull();
  });
});


describe('problem section', () => {
  it('shows the statement, scope, objectives and assumptions written in the question file', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Question' }));
    const sec = screen.getByText('The problem').closest('details')!;
    expect(sec).toHaveAttribute('open');
    expect(within(sec).getByText(/URL-shortening service similar to Bitly/)).toBeInTheDocument();
    expect(within(sec).getByText('In scope')).toBeInTheDocument();
    expect(within(sec).getByText('Out of scope')).toBeInTheDocument();
    expect(within(sec).getByText('What you will practise')).toBeInTheDocument();
    expect(within(sec).getByText('Assumptions')).toBeInTheDocument();
  });
});
