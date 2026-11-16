import { positiveIntFromEnv, standardThresholds, summaryTrendStats } from './lib/config.js';
import { getTotal } from './lib/total-request.js';
import { buildSummary } from './lib/report.js';
import { preflight } from './lib/preflight.js';

// Spike test: a sudden jump from the baseline rate to a burst rate, then back.
//
// The load is an arrival rate, so the burst is applied even when the service
// slows down. Unlike a ramping-vus spike, this does not quietly reduce traffic
// while the service is struggling. Keep SPIKE_RATE above SPIKE_BASE_RATE.

const BASE_RATE = positiveIntFromEnv('SPIKE_BASE_RATE', 90);
const SPIKE_RATE = positiveIntFromEnv('SPIKE_RATE', 270);
const WARMUP = __ENV.SPIKE_WARMUP || '10s';
const HOLD = __ENV.SPIKE_HOLD || '30s';
const RAMP = __ENV.SPIKE_RAMP || '5s';
const RECOVERY = __ENV.SPIKE_RECOVERY || '30s';
// Preallocate enough VUs for the burst: at 270 req/s and a ~3.3s tail the
// spike needs ~900 VUs. Preallocating avoids allocation drops.
const PRE_ALLOCATED_VUS = positiveIntFromEnv('SPIKE_PRE_ALLOCATED_VUS', 900);
const MAX_VUS = positiveIntFromEnv('SPIKE_MAX_VUS', 2000);

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: PRE_ALLOCATED_VUS,
      maxVUs: MAX_VUS,
      stages: [
        { duration: WARMUP, target: BASE_RATE },
        { duration: HOLD, target: BASE_RATE },
        { duration: RAMP, target: SPIKE_RATE },
        { duration: HOLD, target: SPIKE_RATE },
        { duration: RAMP, target: BASE_RATE },
        { duration: RECOVERY, target: BASE_RATE },
        { duration: '5s', target: 0 },
      ],
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
  return buildSummary('spike', data);
}
