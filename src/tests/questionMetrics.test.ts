import { describe, expect, it } from 'vitest';
import { runQuestionMetrics, questionMetricsProviders } from '../features/evaluation/questionMetrics';
import { parseQuestion } from '../features/questions/questionLoader';
import urlRaw from '../data/questions/url-shortener.json';
import rateRaw from '../data/questions/rate-limiter.json';
import pollRaw from '../data/questions/voting-poll.json';
import pollEvaluationRaw from '../data/questions/voting-poll.evaluation.json';
import urlFixture from './fixtures/url-shortener-solved.json';
import rateFixture from './fixtures/rate-limiter-solved.json';
import pollFixture from './fixtures/voting-poll-solved.json';
import { validateEvaluationPackage, type QuestionMetricsDefinition } from '../features/evaluation/evaluationPackage';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';

const workload = { redirectRps: 10000, multiplier: 1 };
const scenario = { cacheDown: false, lostInstances: 0 };
const urlDefinition: QuestionMetricsDefinition = { modelId: 'url-shortener-v1', trafficLabel: 'Redirects per second', outageLabel: 'Cache is unavailable', lostInstancesLabel: 'Application servers lost', showCreateRate: true, latencyModel: 'redirect' };
const rateDefinition: QuestionMetricsDefinition = { modelId: 'rate-limiter-v1', trafficLabel: 'Requests per second', outageLabel: 'Counter store is unavailable', lostInstancesLabel: 'Limiter servers lost', showCreateRate: false };

describe('question metrics runtime', () => {
  it('registers stable providers for the current modeled questions', () => {
    expect(Object.keys(questionMetricsProviders).sort()).toEqual(['rate-limiter-v1', 'url-shortener-v1', 'voting-poll-v1']);
  });
  it('preserves URL Shortener capacity and latency outputs through the shared contract', () => {
    const spec = parseQuestion(urlRaw);
    const result = runQuestionMetrics({ spec, doc: urlFixture as ArchitectureDocument, definition: urlDefinition, workload, scenario });
    expect(result.modelId).toBe('url-shortener-v1');
    expect(result.capacity.redirectRps).toBe(10000);
    expect(result.capacity.rows.length).toBeGreaterThan(0);
    expect(result.latency).not.toBeNull();
  });
  it('preserves Rate Limiter capacity outputs through the shared contract', () => {
    const spec = parseQuestion(rateRaw);
    const result = runQuestionMetrics({ spec, doc: rateFixture as ArchitectureDocument, definition: rateDefinition, workload, scenario });
    expect(result.modelId).toBe('rate-limiter-v1');
    expect(result.capacity.redirectRps).toBe(10000);
    expect(result.capacity.rows.length).toBeGreaterThan(0);
    expect(result.latency).toBeNull();
  });

  it('accepts the Voting / Poll evaluation sidecar against its question specification', () => {
    expect(validateEvaluationPackage(parseQuestion(pollRaw), pollEvaluationRaw)).toEqual([]);
  });

  it('models Voting / Poll submissions, result reads, queue, workers and counter operations', () => {
    const spec = parseQuestion(pollRaw);
    const definition: QuestionMetricsDefinition = {
      modelId: 'voting-poll-v1',
      trafficLabel: 'Vote submissions per second',
      outageLabel: 'Counter store is unavailable',
      lostInstancesLabel: 'Aggregation workers lost',
      showCreateRate: true,
      secondaryTrafficLabel: 'Result queries per second',
    };
    const result = runQuestionMetrics({
      spec,
      doc: pollFixture as ArchitectureDocument,
      definition,
      workload,
      scenario,
    });
    expect(result.capacity.redirectRps).toBe(10000);
    expect(result.capacity.createRps).toBe(10000);
    expect(result.secondaryTrafficLabel).toBe('Result queries per second');
    expect(result.capacity.rows.find((row) => row.id === 'poll-api')?.load).toBe(20000);
    expect(result.capacity.rows.find((row) => row.id === 'poll-db-writes')?.load).toBe(10000);
    expect(result.capacity.rows.find((row) => row.id === 'poll-api')?.capacity).toBe(16000);
    expect(result.capacity.rows.find((row) => row.id === 'poll-api')?.load).toBe(20000);
    expect(result.capacity.rows.find((row) => row.id === 'poll-queue-ingress')?.capacity).toBe(6000);
    expect(result.capacity.rows.find((row) => row.id === 'poll-queue-processing')?.capacity).toBe(6000);
    expect(result.capacity.rows.find((row) => row.id === 'poll-counter')?.load).toBe(20000);
  });

  it('models lost aggregation workers and marks counter outage as unavailable', () => {
    const spec = parseQuestion(pollRaw);
    const definition: QuestionMetricsDefinition = {
      modelId: 'voting-poll-v1',
      trafficLabel: 'Vote submissions per second',
      outageLabel: 'Counter store is unavailable',
      lostInstancesLabel: 'Aggregation workers lost',
      showCreateRate: true,
      secondaryTrafficLabel: 'Result queries per second',
    };
    const result = runQuestionMetrics({
      spec,
      doc: pollFixture as ArchitectureDocument,
      definition,
      workload,
      scenario: { cacheDown: true, lostInstances: 2 },
    });
    const workers = result.capacity.rows.find((row) => row.id === 'poll-workers');
    const counter = result.capacity.rows.find((row) => row.id === 'poll-counter');
    expect(workers?.capacity).toBe(4800);
    expect(workers?.status).toBe('over');
    expect(counter?.status).toBe('not-modeled');
    expect(counter?.utilization).toBeNull();
  });

  it('rejects unknown metric providers instead of silently showing empty metrics', () => {
    const spec = parseQuestion(rateRaw);
    expect(() => runQuestionMetrics({ spec, doc: rateFixture as ArchitectureDocument, definition: { ...rateDefinition, modelId: 'missing-provider' }, workload, scenario })).toThrow(/No metrics provider registered/);
  });
});
