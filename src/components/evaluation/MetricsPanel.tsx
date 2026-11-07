import { question, useStudio } from '../../features/architecture/architecture.store';
import { analyzeCapacity, SAFE_UTILIZATION, type CapacityAnalysis, type CapacityRow } from '../../features/evaluation/capacity';
import { analyzeRateLimiter } from '../../features/evaluation/rlCapacity';
import { estimateRedirectLatency } from '../../features/evaluation/latency';

const STATUS = { ok: 'Healthy', high: 'Getting full', over: 'Over capacity', 'not-modeled': 'Capacity not set' } as const;
const n0 = (n: number | null) => (n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 0 }));
const GROWTH = [1, 2, 5, 10];

function Row({ r }: { r: CapacityRow }) {
  const pct = r.utilization === null ? null : Math.round(r.utilization * 100);
  return (
    <div className={`mp-row ${r.status}`}>
      <div className="mp-row-head"><b>{r.label}</b><span className={`badge ${r.status}`}>{STATUS[r.status]}</span></div>
      {pct !== null && <div className="bar" role="img" aria-label={`${pct}% of capacity used`}><i style={{ width: `${Math.min(100, pct)}%` }} /></div>}
      <div className="mp-row-nums">
        {r.capacity !== null && r.load !== null
          ? <span><b>{n0(r.load)}</b> of {n0(r.capacity)} req/s{pct !== null && <> · <b>{pct}%</b> used</>}</span>
          : <span><b>{n0(r.load)}</b> req/s routed here</span>}
      </div>
      <p className="mp-note">{r.note}</p>
    </div>
  );
}

export default function MetricsPanel() {
  const { doc, workload, scenario, setWorkload, setScenario, setHighlight } = useStudio();
  let a: CapacityAnalysis | null = null; let err = '';
  const isRL = question.question.id === 'hld-rate-limiter-001';
  try { a = (isRL ? analyzeRateLimiter : analyzeCapacity)(question, doc, workload, scenario); } catch (e) { err = (e as Error).message; }
  const app = isRL ? doc.nodes.find((n) => n.componentType === 'rate-limiter') : doc.nodes.find((n) => n.componentType === 'application-server' && doc.edges.some((e) => e.source === n.id && e.connectionTypeId === 'EDGE-DB-READ'));
  const lat = app && !isRL ? estimateRedirectLatency(question, doc, app.id) : null;
  const worst = a?.rows.find((r) => r.nodeId === a?.bottleneckNodeId);

  return (
    <div className="mp">
      <p className="mp-intro">Try “what if” scenarios and see which part of your design fills up first. Numbers use the capacities you configured, not benchmarks.</p>

      <section className="mp-card" aria-label="Scenario">
        <h3>Scenario</h3>
        <label className="mp-line"><span>{isRL ? 'Requests per second' : 'Redirects per second'}</span>
          <input type="number" name="load" autoComplete="off" inputMode="numeric" min={0} value={workload.redirectRps} onChange={(e) => setWorkload({ redirectRps: Number(e.target.value) })} /></label>
        <div className="mp-line"><span id="growth-label">Traffic growth</span>
          <div className="seg" role="group" aria-labelledby="growth-label">
            {GROWTH.map((m) => <button key={m} aria-pressed={workload.multiplier === m} onClick={() => setWorkload({ multiplier: m })}>{m}×</button>)}
          </div></div>
        <label className="switch"><input type="checkbox" checked={scenario.cacheDown} onChange={(e) => setScenario({ cacheDown: e.target.checked })} /><i aria-hidden /><span>{isRL ? 'Counter store is unavailable' : 'Cache is unavailable'}</span></label>
        <div className="mp-line"><span id="lost-label">{isRL ? 'Limiter servers lost' : 'Servers lost'}</span>
          <div className="stepper" role="group" aria-labelledby="lost-label">
            <button aria-label="Fewer servers lost" onClick={() => setScenario({ lostInstances: Math.max(0, scenario.lostInstances - 1) })}>−</button>
            <output aria-live="polite">{scenario.lostInstances}</output>
            <button aria-label="More servers lost" onClick={() => setScenario({ lostInstances: scenario.lostInstances + 1 })}>+</button>
          </div></div>
        {err && <p className="err" role="alert">{err}</p>}
      </section>

      {!app && !err && <div className="callout"><b>Nothing to measure yet</b><p>{isRL ? 'Add a Rate Limiter to see capacity estimates.' : 'Add an Application Server and connect it to a database to see capacity estimates.'}</p></div>}

      {a && a.rows.length > 0 && (
        <>
          <div className="mp-stats">
            <div><b>{n0(a.redirectRps)}</b><span>{isRL ? 'requests / s' : 'redirects / s'}</span></div>
            {!isRL && <div><b>{n0(a.createRps)}</b><span>new URLs / s</span></div>}
          </div>
          {worst && worst.status !== 'ok' && (
            <div className="callout"><b>Fills up first: {worst.label}</b><p>{Math.round((worst.utilization ?? 0) * 100)}% of its configured capacity.</p>
              <button onClick={() => setHighlight(worst.nodeId ? [worst.nodeId] : [])}>Show on canvas</button></div>
          )}
          <section className="mp-card" aria-label="Where the load lands">
            <h3>Where the load lands</h3>
            {a.rows.map((r) => <Row key={r.id} r={r} />)}
          </section>
        </>
      )}

      {app && !isRL && (
        <section className="mp-card" aria-label="Modeled latency">
          <h3>Modeled redirect time</h3>
          {!lat ? <p className="muted">No client reaches the Application Server, so this can’t be modeled.</p> : (
            <>
              <ul className="mp-stages">
                {lat.stages.map((s) => <li key={s.nodeId + s.role}><span>{s.role === 'database' ? 'On a cache miss: ' : ''}{s.label}</span><b>{s.ms === null ? 'unknown' : `${s.ms} ms`}</b></li>)}
              </ul>
              {lat.expectedMs === null ? <p className="err">Not evaluated: missing a latency value for {lat.unknowns.join(', ')}.</p> : (
                <div className="mp-stats three">
                  <div><b>{lat.hitMs === null ? '—' : `${lat.hitMs.toFixed(0)} ms`}</b><span>cache hit</span></div>
                  <div><b>{lat.missMs?.toFixed(0)} ms</b><span>{lat.hasCache ? 'cache miss' : 'database path'}</span></div>
                  <div className="hl"><b>{lat.expectedMs.toFixed(0)} ms</b><span>expected</span></div>
                </div>
              )}
              <p className="mp-note">A modeled sum of average latencies against the 200 ms goal. It is not a measured p95.</p>
            </>
          )}
        </section>
      )}

      <details className="sec">
        <summary>How to read this</summary>
        <ul className="muted">
          <li>“Getting full” means above {Math.round(SAFE_UTILIZATION * 100)}% of configured capacity, a modelling convention rather than a universal rule.</li>
          <li>Server capacity assumes traffic is spread perfectly evenly.</li>
          <li>Queueing, network delay and slow-tail requests are not modeled.</li>
          <li>Having several servers in the diagram does not prove an availability percentage.</li>
        </ul>
      </details>
    </div>
  );
}
