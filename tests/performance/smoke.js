import { positiveIntFromEnv, standardThresholds, summaryTrendStats } from './lib/config.js';
import { getTotal } from './lib/total-request.js';
import { buildSummary } from './lib/report.js';
import { preflight } from './lib/preflight.js';

// Smoke test: does the endpoint work at all?
//
// A single (or few) virtual user for a few seconds. This is a functional check
// under minimal load, not a performance measurement. Run it before every other
// test type, and after any deployment.

const VUS = positiveIntFromEnv('SMOKE_VUS', 1);
const DURATION = __ENV.SMOKE_DURATION || '10s';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      gracefulStop: '5s',
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
  return buildSummary('smoke', data);
}
