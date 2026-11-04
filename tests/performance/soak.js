import { positiveIntFromEnv, standardThresholds, summaryTrendStats } from './lib/config.js';
import { getTotal } from './lib/total-request.js';
import { buildSummary } from './lib/report.js';
import { preflight } from './lib/preflight.js';

// Soak (endurance) test: moderate load for a long time.
//
// Finds problems that only appear after a while: memory leaks, growing queues,
// cache degradation, connection pool exhaustion. Compare the first minutes with
// the last minutes of the same run: stable latency means the service is stable.

const VUS = positiveIntFromEnv('SOAK_VUS', 10);
const RAMP_UP = __ENV.SOAK_RAMP_UP || '30s';
const DURATION = __ENV.SOAK_DURATION || '30m';
const RAMP_DOWN = __ENV.SOAK_RAMP_DOWN || '15s';

export const options = {
  scenarios: {
    soak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP, target: VUS },
        { duration: DURATION, target: VUS },
        { duration: RAMP_DOWN, target: 0 },
      ],
      gracefulRampDown: '10s',
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
