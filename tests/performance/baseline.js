import { positiveIntFromEnv, standardThresholds, summaryTrendStats } from './lib/config.js';
import { getTotal } from './lib/total-request.js';
import { buildSummary } from './lib/report.js';
import { preflight } from './lib/preflight.js';

// Baseline test: a repeatable reference run at a fixed request rate.
//
// Run it on an otherwise idle machine, with a fixed fixture and fixed
// parameters, three times. Keep the results and use them as the reference for
// future comparisons. The load is an arrival rate, so it stays the same when
// the service slows down. Not a "pass/fail" test in itself: the thresholds only
// tell you whether the run met the expected service level.

const RATE = positiveIntFromEnv('BASELINE_RATE', 90);
const DURATION = __ENV.BASELINE_DURATION || '3m';
const PRE_ALLOCATED_VUS = positiveIntFromEnv('BASELINE_PRE_ALLOCATED_VUS', 50);
const MAX_VUS = positiveIntFromEnv('BASELINE_MAX_VUS', 500);

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: PRE_ALLOCATED_VUS,
      maxVUs: MAX_VUS,
      gracefulStop: '30s',
    },
  },
  thresholds: standardThresholds(),
  summaryTrendStats,
  tags: {
    endpoint: 'total',
  },
};

export function setup() {
  return preflight();
}

export default function () {
  getTotal();
}

export function handleSummary(data) {
  return buildSummary('baseline', data);
}
