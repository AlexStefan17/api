import { positiveIntFromEnv, standardThresholds, summaryTrendStats } from './lib/config.js';
import { getTotal } from './lib/total-request.js';
import { buildSummary } from './lib/report.js';
import { preflight } from './lib/preflight.js';

// Spike test: a sudden jump from low load to high load, then back down.
//
// Checks whether the service survives a traffic burst and how quickly it
// recovers afterwards. Keep SPIKE_VUS clearly above SPIKE_BASE_VUS.

const BASE_VUS = positiveIntFromEnv('SPIKE_BASE_VUS', 2);
const SPIKE_VUS = positiveIntFromEnv('SPIKE_VUS', 50);
const WARMUP = __ENV.SPIKE_WARMUP || '10s';
const HOLD = __ENV.SPIKE_HOLD || '30s';
const RAMP = __ENV.SPIKE_RAMP || '5s';
const RECOVERY = __ENV.SPIKE_RECOVERY || '30s';

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: WARMUP, target: BASE_VUS },
        { duration: HOLD, target: BASE_VUS },
        { duration: RAMP, target: SPIKE_VUS },
        { duration: HOLD, target: SPIKE_VUS },
        { duration: RAMP, target: BASE_VUS },
        { duration: RECOVERY, target: BASE_VUS },
        { duration: '5s', target: 0 },
      ],
      gracefulRampDown: '5s',
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
  return buildSummary('spike', data);
}
