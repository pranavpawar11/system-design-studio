import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../app/App';
import { api, ApiError } from '../api';
import { useLearn } from '../features/learning/learn.store';

const go = (hash: string) => { window.location.hash = hash; };
const click = (t: string | RegExp, role: 'button' | 'link' = 'button') => userEvent.click(screen.getByRole(role, { name: t }));
beforeEach(async () => {
  localStorage.clear(); go('');
  useLearn.setState({ status: 'idle', error: '', roadmap: null, events: [], notice: null });
});

describe('the roadmap', () => {
  it('shows the whole map, with progress at zero and a clear place to start', async () => {
    go('#/learn'); render(<App />);
    expect(await screen.findByText('System design, one step at a time')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Overall progress' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('0 of 5')).toBeInTheDocument(); expect(screen.getByText(/59 more on the way/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start here/ })).toHaveAttribute('href', '#/learn/lesson/load-balancing');
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(11); // eleven topics on the spine
  });

  it('expands the topic you are in and collapses the rest, and lets you open any topic', async () => {
    go('#/learn'); render(<App />); await screen.findByText('The roadmap');
    expect(screen.getByRole('button', { name: /Networking/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Caching/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('What a cache is and why it exists')).not.toBeInTheDocument();
    await click(/Caching/);
    expect(screen.getByText('What a cache is and why it exists')).toBeInTheDocument();
    await click(/Networking/); expect(screen.queryByText('Health checks and failover')).not.toBeInTheDocument();
  });

  it('only written lessons are links; planned ones are visible but say "Coming soon"', async () => {
    go('#/learn'); render(<App />); await screen.findByText('The roadmap');
    expect(screen.getByRole('link', { name: /^Load balancing/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^DNS/ })).not.toBeInTheDocument();
    expect(within(screen.getByText('DNS').closest('li')!).getByText('Coming soon')).toBeInTheDocument();
    await click(/Caching/);
    expect(screen.queryByRole('link', { name: /Cache-aside/ })).not.toBeInTheDocument();
    expect(within(screen.getByText('Cache-aside').closest('li')!).getByText('Coming soon')).toBeInTheDocument();
  });

  it('never locks anything: every written lesson can be opened with no progress', async () => {
    go('#/learn/lesson/cache-hit-ratio'); render(<App />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Cache hit ratio' })).toBeInTheDocument();
  });

  it('shows done and remaining differently, in words as well as shape', async () => {
    await api.recordProgress({ nodeId: 'cache-basics', type: 'quiz_passed', score: 1 });
    go('#/learn'); render(<App />); await screen.findByText('The roadmap');
    const done = screen.getByText('What a cache is and why it exists').closest('li')!; const todo = screen.getByText('Cache hit ratio', { selector: '.leaf-title' }).closest('li')!;
    expect(done).toHaveClass('done'); expect(within(done).getByText('Done')).toBeInTheDocument();
    expect(todo).toHaveClass('todo'); expect(within(todo).getByText('Not started')).toBeInTheDocument();
    expect(screen.getByText('1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start here/ })).toHaveAttribute('href', '#/learn/lesson/cache-hit-ratio');   // follows what you just did
    expect(screen.getByRole('button', { name: /Caching/ })).toHaveTextContent('In progress');
  });

  it('says honestly when everything available is finished but more is coming', async () => {
    for (const e of [['cache-basics', 'quiz_passed'], ['cache-hit-ratio', 'lab_completed'], ['cache-hit-ratio', 'quiz_passed'], ['load-balancing', 'lab_completed'], ['load-balancing', 'quiz_passed'], ['l4-vs-l7', 'quiz_passed'], ['health-checks', 'lab_completed'], ['health-checks', 'quiz_passed']] as const) await api.recordProgress({ nodeId: e[0], type: e[1] });
    go('#/learn'); render(<App />); await screen.findByText('The roadmap');
    expect(screen.getByText('You have finished every lesson available so far.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Caching/ })).toHaveTextContent('All available done'); // not "Done": seven lessons are still to come
    expect(screen.getByRole('button', { name: /Networking/ })).toHaveTextContent('All available done');
    expect(screen.getByRole('progressbar', { name: 'Overall progress' })).toHaveAttribute('aria-valuenow', '100');
  });

  it('resets progress only after confirmation', async () => {
    await api.recordProgress({ nodeId: 'cache-basics', type: 'quiz_passed' });
    go('#/learn'); render(<App />); await screen.findByText('The roadmap');
    await click('Reset my progress…'); await click('Cancel');
    expect(await api.getProgress()).toHaveLength(1);
    await click('Reset my progress…'); await click('Reset progress');
    await waitFor(async () => expect(await api.getProgress()).toEqual([]));
    expect(await screen.findByText('0 of 5')).toBeInTheDocument();
  });

  it('reports a failed load and lets the learner retry', async () => {
    const spy = vi.spyOn(api, 'getRoadmap').mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server.'));
    go('#/learn'); render(<App />);
    expect(await screen.findByText(/The roadmap could not be loaded: Could not reach the server/)).toBeInTheDocument();
    await click('Try again'); expect(await screen.findByText('The roadmap')).toBeInTheDocument(); spy.mockRestore();
  });
});

describe('a lesson', () => {
  it('records the first view, shows its content, and links back to the roadmap', async () => {
    go('#/learn/lesson/cache-basics'); render(<App />);
    expect(await screen.findByRole('heading', { level: 2, name: 'What a cache is and why it exists' })).toBeInTheDocument();
    expect(screen.getByText(/A cache is not the source of truth/)).toBeInTheDocument();
    expect(screen.getByText('hit', { selector: 'strong' })).toBeInTheDocument();      // **bold** is rendered, not shown as asterisks
    expect(screen.getByRole('link', { name: /Back to the roadmap/ })).toHaveAttribute('href', '#/learn');
    await waitFor(async () => expect((await api.getProgress()).map((e) => e.type)).toEqual(['lesson_viewed']));
  });

  it('explains a planned lesson without pretending it exists, and an unknown one clearly', async () => {
    go('#/learn/lesson/dns'); const { unmount } = render(<App />);
    expect(await screen.findByText('Not written yet')).toBeInTheDocument(); unmount();
    useLearn.setState({ status: 'idle', roadmap: null }); go('#/learn/lesson/nonsense'); render(<App />);
    expect(await screen.findByText('Lesson not found')).toBeInTheDocument();
  });

  it('a quiz explains every answer, lets you try again, and records the pass', async () => {
    go('#/learn/lesson/cache-basics'); render(<App />); await screen.findByText('Quick check');
    await click('Check my answers').catch(() => undefined);                       // disabled until everything is answered
    expect(screen.getByRole('button', { name: 'Check my answers' })).toBeDisabled();
    for (const a of ['An eviction', 'One where every request asks for different, never-repeated data', 'All the data is gone, because the cache held the only copy']) await userEvent.click(screen.getByLabelText(a));
    await click('Check my answers');
    expect(screen.getByText(/You got 0 of 3/)).toBeInTheDocument(); expect(screen.getAllByText('✗ Not quite.')).toHaveLength(3);
    expect(screen.getByText(/A hit means the cache already had the answer/)).toBeInTheDocument();
    expect(await api.getProgress()).not.toContainEqual(expect.objectContaining({ type: 'quiz_passed' }));
    await click('Start over');
    for (const a of ['A hit', 'One where a small set of popular items is read very often', 'The database still holds the real data, so the system keeps working, if more slowly']) await userEvent.click(screen.getByLabelText(a));
    await click('Check my answers');
    expect(screen.getByText('You got 3 of 3. Passed.')).toBeInTheDocument();
    await waitFor(async () => expect(await api.getProgress()).toContainEqual(expect.objectContaining({ nodeId: 'cache-basics', type: 'quiz_passed', score: 1 })));
    expect(await screen.findByText('✓ Lesson complete')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cache hit ratio' })).toHaveAttribute('href', '#/learn/lesson/cache-hit-ratio'); // suggested next, never forced
  });

  it('a failed save is reported, rolled back, and does not mark the lesson complete', async () => {
    const spy = vi.spyOn(api, 'recordProgress').mockImplementation(async (e) => { if (e.type === 'quiz_passed') throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server.'); return { ...e, at: 'now' }; });
    go('#/learn/lesson/cache-basics'); render(<App />); await screen.findByText('Quick check');
    for (const a of ['A hit', 'One where a small set of popular items is read very often', 'The database still holds the real data, so the system keeps working, if more slowly']) await userEvent.click(screen.getByLabelText(a));
    await click('Check my answers');
    expect(await screen.findByText(/Your progress could not be saved: Could not reach the server/)).toBeInTheDocument();
    expect(screen.queryByText('✓ Lesson complete')).not.toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('the lab', () => {
  const slider = (name: string) => screen.getByRole('slider', { name });
  const task = (re: RegExp) => screen.getByText(re).closest('li')!;

  it('starts healthy, shows a chart, and explains what is happening in words', async () => {
    go('#/learn/lesson/cache-hit-ratio'); render(<App />); await screen.findByText(/Lab: Cache and database load/);
    expect(screen.getByText(/The cache answers 90% of requests and the database only sees 1,000 reads\/s/)).toBeInTheDocument();
    expect(screen.getByText('Healthy.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Database reads as the hit ratio changes\. At cache hit ratio 90%, reads reaching the database is 1,000/ })).toBeInTheDocument();
    expect(slider('Requests per second')).toHaveAttribute('aria-valuetext', '10,000 req/s');
  });

  it('reacts to the controls: cache off overloads the database and says why', async () => {
    go('#/learn/lesson/cache-hit-ratio'); render(<App />); await screen.findByText(/Lab: Cache and database load/);
    await userEvent.click(screen.getByRole('switch', { name: 'Cache is running' }));
    expect(screen.getByText('Problem.')).toBeInTheDocument(); expect(screen.getByText(/The cache is down, so all 10,000 req\/s arrive at the database/)).toBeInTheDocument();
    expect(screen.getByText('200%')).toBeInTheDocument();                            // database load vs capacity
    await click('Back to normal'); expect(screen.getByText('Healthy.')).toBeInTheDocument();
    await click('Traffic grows 5 times');
    expect(screen.getByText('Careful.')).toBeInTheDocument();                       // exactly at capacity: works, but no headroom
    expect(screen.getByText(/The database is at 100% of its capacity/)).toBeInTheDocument();
  });

  it('ticks tasks as they are achieved, keeps them ticked, and completes the lab', async () => {
    go('#/learn/lesson/cache-hit-ratio'); render(<App />); await screen.findByText(/Lab: Cache and database load/);
    expect(screen.getByText('Your tasks (1 of 3)')).toBeInTheDocument();             // task 2 is already true at the start
    await userEvent.click(screen.getByRole('switch', { name: 'Cache is running' }));
    expect(task(/Turn the cache off/)).toHaveClass('done');
    await userEvent.click(screen.getByRole('switch', { name: 'Cache is running' }));
    expect(task(/Turn the cache off/)).toHaveClass('done');                            // stays ticked after moving on
    fireEvent.change(slider('Requests per second'), { target: { value: '50000' } });
    fireEvent.change(slider('Cache hit ratio'), { target: { value: '0.95' } });
    expect(await screen.findByText('Your tasks (3 of 3)')).toBeInTheDocument();
    expect(await screen.findByText('✓ Completed')).toBeInTheDocument();
    await waitFor(async () => expect((await api.getProgress()).filter((e) => e.type === 'lab_completed')).toHaveLength(1)); // exactly once
  });

  it('a lesson is complete only when the lab AND the quiz are done, then points to what is next', async () => {
    await api.recordProgress({ nodeId: 'cache-basics', type: 'quiz_passed' });
    await api.recordProgress({ nodeId: 'cache-hit-ratio', type: 'lab_completed' });
    go('#/learn/lesson/cache-hit-ratio'); render(<App />); await screen.findByText('Quick check');
    expect(screen.queryByText('✓ Lesson complete')).not.toBeInTheDocument();         // lab done, quiz not yet
    expect(screen.getByText('✓ Completed')).toBeInTheDocument();                       // lab remembered across visits
    for (const a of ['1,000 per second', 'Ten times', 'All traffic suddenly reaches a database that may not be able to handle it']) await userEvent.click(screen.getByLabelText(a));
    await click('Check my answers');
    expect(await screen.findByText('✓ Lesson complete')).toBeInTheDocument();
    expect(screen.getByText(/Next up:/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Load balancing' })).toHaveAttribute('href', '#/learn/lesson/load-balancing');   // wraps round to what is left
  });

  it('opens the Studio on the practice question', async () => {
    go('#/learn/lesson/cache-hit-ratio'); render(<App />); await screen.findByText('Practise this in the Studio');
    await click('Design a URL Shortener');
    expect(window.location.hash).toBe('#/');                                           // same question already open: no reload needed
    expect(await screen.findByRole('button', { name: 'Validate' })).toBeInTheDocument();
  });
});

describe('moving between the two modes', () => {
  it('the Studio is still the default, and each mode links to the other', async () => {
    render(<App />); expect(await screen.findByRole('button', { name: 'Validate' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('href', '#/learn');
    await click('Learn', 'link'); expect(await screen.findByText('System design, one step at a time')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page');
    await click('Studio', 'link'); expect(await screen.findByRole('button', { name: 'Validate' })).toBeInTheDocument();
  });
  it('a share link still opens the Studio, not the learning pages', () => {
    go('#share=z.abc'); render(<App />); expect(screen.getByRole('button', { name: 'Validate' })).toBeInTheDocument();
  });
});


describe('the load balancing lessons', () => {
  const slider = (n: string) => screen.getByRole('slider', { name: n });
  const task = (re: RegExp) => screen.getByText(re).closest('li')!;

  it('starts healthy but warns there is no spare server, then shows what one failure does', async () => {
    go('#/learn/lesson/load-balancing'); render(<App />); await screen.findByText(/Lab: Servers behind a balancer/);
    expect(screen.getByText('Healthy.')).toBeInTheDocument(); expect(screen.getAllByText('83%').length).toBeGreaterThan(0);
    expect(screen.getByText(/You have no spare server/)).toBeInTheDocument();
    await click('A server fails');
    expect(screen.getByText('Problem.')).toBeInTheDocument(); expect(screen.getAllByText('111%').length).toBeGreaterThan(0);
    expect(screen.getByText(/the 3 working servers can only handle 9,000 req\/s/)).toBeInTheDocument();
  });

  it('uneven balancing is reported as the busiest server being overloaded', async () => {
    go('#/learn/lesson/load-balancing'); render(<App />); await screen.findByText(/Lab: Servers behind a balancer/);
    await click('Balancing becomes uneven');
    expect(screen.getByText(/the busiest one is asked for 3,750 req\/s/)).toBeInTheDocument(); expect(screen.getAllByText('125%').length).toBeGreaterThan(0);
  });

  it('copes with every server down: a clear message, dashes, and a chart that still draws', async () => {
    go('#/learn/lesson/load-balancing'); render(<App />); await screen.findByText(/Lab: Servers behind a balancer/);
    fireEvent.change(slider('Servers that have failed'), { target: { value: '4' } });
    expect(screen.getByText(/Every server is down/)).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    const chart = screen.getByRole('img', { name: /Average server load as traffic grows/ });
    expect(chart.querySelector('path.line')?.getAttribute('d') ?? '').not.toMatch(/^L/);     // never an invalid path
  });

  it('completes all three tasks, records the lab once, and the lesson still needs the quiz', async () => {
    go('#/learn/lesson/load-balancing'); render(<App />); await screen.findByText(/Lab: Servers behind a balancer/);
    expect(screen.getByText('Your tasks (0 of 3)')).toBeInTheDocument();
    await click('Balancing becomes uneven'); expect(task(/Make the balancing uneven/)).toHaveClass('done');
    await click('Back to normal');
    fireEvent.change(slider('Servers that have failed'), { target: { value: '1' } }); fireEvent.change(slider('Traffic'), { target: { value: '8000' } });
    expect(task(/Fail a server and still keep/)).toHaveClass('done');
    await click('Back to normal'); fireEvent.change(slider('Capacity of one server'), { target: { value: '3500' } });
    expect(await screen.findByText('Your tasks (3 of 3)')).toBeInTheDocument();
    await waitFor(async () => expect((await api.getProgress()).filter((e) => e.type === 'lab_completed' && e.nodeId === 'load-balancing')).toHaveLength(1));
    expect(screen.queryByText('✓ Lesson complete')).not.toBeInTheDocument();                  // the quiz is still to do
  });

  it('a quiz-only lesson is complete as soon as the quiz is passed', async () => {
    go('#/learn/lesson/l4-vs-l7'); render(<App />); await screen.findByText('Quick check');
    expect(screen.queryByText(/Lab:/)).not.toBeInTheDocument();
    for (const a of ['Layer 7, because it can read the request path', 'Layer 4, which forwards connections without parsing them', 'It reads every request, so it uses more processing and adds some delay']) await userEvent.click(screen.getByLabelText(a));
    await click('Check my answers');
    expect(await screen.findByText('✓ Lesson complete')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Health checks and failover' })).toBeInTheDocument();   // the next lesson in the same group
  });
});

describe('the health checks lab', () => {
  it('shows the trade-off in words when the settings are changed, with each unit shown once', async () => {
    go('#/learn/lesson/health-checks'); render(<App />); await screen.findByText(/Lab: Detecting a dead server/);
    expect(screen.getByText(/A dead server is noticed within 17 s, about 25,500 requests fail in that time/)).toBeInTheDocument();
    await click('Fast but jumpy'); expect(screen.getByText('Problem.')).toBeInTheDocument(); expect(screen.getByText(/That is flapping/)).toBeInTheDocument();
    expect(screen.getByText(/One failed check removes a server/)).toBeInTheDocument();
    await click('Slow but calm'); expect(screen.getByText('Careful.')).toBeInTheDocument(); expect(screen.getByText(/Detection is slow/)).toBeInTheDocument();
    await click('Balanced'); expect(screen.getByText('Healthy.')).toBeInTheDocument();
    expect(screen.queryByText(/requests requests|per day a day/)).not.toBeInTheDocument();
  });
  it('the learner can find a setting that is both quick and calm, and finish the lab', async () => {
    go('#/learn/lesson/health-checks'); render(<App />); await screen.findByText(/Lab: Detecting a dead server/);
    await click('Fast but jumpy');                                                                    // tasks 1 and 2
    fireEvent.change(screen.getByRole('slider', { name: 'Check every' }), { target: { value: '3' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Failures in a row to remove' }), { target: { value: '3' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Check timeout' }), { target: { value: '2' } });   // task 3: 11 s and well under once a day
    expect(await screen.findByText('Your tasks (3 of 3)')).toBeInTheDocument();
    expect(await screen.findByText('✓ Completed')).toBeInTheDocument();
  });
});
