import { positiveIntFromEnv, standardThresholds, summaryTrendStats } from './lib/config.js';
import { getTotal } from './lib/total-request.js';
import { buildSummary } from './lib/report.js';
import { preflight } from './lib/preflight.js';

// Soak (endurance) test: a controlled request rate for a long time.
//
// Finds problems that only appear after a while: memory leaks, growing queues,
// cache degradation, connection pool exhaustion. The arrival rate stays fixed
// even when the service slows down; if maxVUs is exhausted, k6 reports
// dropped_iterations. Compare the first minutes with the last minutes of the
// run: stable latency means the service is stable.

const RATE = positiveIntFromEnv('SOAK_RATE', 90);
const DURATION = __ENV.SOAK_DURATION || '30m';
const PRE_ALLOCATED_VUS = positiveIntFromEnv('SOAK_PRE_ALLOCATED_VUS', 10);
const MAX_VUS = positiveIntFromEnv('SOAK_MAX_VUS', 200);

export const options = {
  scenarios: {
    soak: {
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
  return buildSummary('soak', data);
}
