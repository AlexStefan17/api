import { positiveIntFromEnv, standardThresholds, summaryTrendStats } from './lib/config.js';
import { getTotal } from './lib/total-request.js';
import { buildSummary } from './lib/report.js';
import { preflight } from './lib/preflight.js';

// Baseline test: a repeatable reference run.
//
// Run it on an otherwise idle machine, with a fixed fixture and fixed
// parameters, three times. Keep the results and use them as the reference for
// future comparisons. Not a "pass/fail" test in itself: the thresholds only
// tell you whether the run met the expected service level.

const VUS = positiveIntFromEnv('BASELINE_VUS', 10);
const RAMP_UP = __ENV.BASELINE_RAMP_UP || '10s';
const DURATION = __ENV.BASELINE_DURATION || '3m';
const RAMP_DOWN = __ENV.BASELINE_RAMP_DOWN || '10s';

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP, target: VUS },
        { duration: DURATION, target: VUS },
        { duration: RAMP_DOWN, target: 0 },
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
  return buildSummary('baseline', data);
}
