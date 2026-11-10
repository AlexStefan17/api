import { positiveIntFromEnv, standardThresholds, summaryTrendStats } from './lib/config.js';
import { getTotal } from './lib/total-request.js';
import { buildSummary } from './lib/report.js';
import { preflight } from './lib/preflight.js';

// Stress (RPS) test: ramp the arrival rate past the measured capacity.
//
// Unlike stress.js, which controls concurrent VUs, this keeps the offered load
// fixed in requests per second. That is the right shape for the question "at
// how many req/s does the service miss its SLO?". If k6 reports
// dropped_iterations, the service could not keep up even with STRESS_RPS_MAX_VUS.

const START_RATE = positiveIntFromEnv('STRESS_RPS_START', 25);
const STEP_RATE = positiveIntFromEnv('STRESS_RPS_STEP', 25);
const PEAK_RATE = positiveIntFromEnv('STRESS_RPS_PEAK', 400);
const STEP_RAMP = __ENV.STRESS_RPS_RAMP || '15s';
const STEP_DURATION = __ENV.STRESS_RPS_STEP_DURATION || '1m';
const RAMP_DOWN = __ENV.STRESS_RPS_RAMP_DOWN || '20s';
const PRE_ALLOCATED_VUS = positiveIntFromEnv('STRESS_RPS_PRE_ALLOCATED_VUS', 50);
const MAX_VUS = positiveIntFromEnv('STRESS_RPS_MAX_VUS', 1000);

function rpsStages() {
  const stages = [
    { duration: STEP_RAMP, target: START_RATE },
    { duration: STEP_DURATION, target: START_RATE },
  ];

  if (START_RATE < PEAK_RATE) {
    for (let target = START_RATE + STEP_RATE; target <= PEAK_RATE; target += STEP_RATE) {
      stages.push({ duration: STEP_RAMP, target });
      stages.push({ duration: STEP_DURATION, target });
    }

    if ((PEAK_RATE - START_RATE) % STEP_RATE !== 0) {
      stages.push({ duration: STEP_RAMP, target: PEAK_RATE });
      stages.push({ duration: STEP_DURATION, target: PEAK_RATE });
    }
  }

  stages.push({ duration: RAMP_DOWN, target: 0 });

  return stages;
}

export const options = {
  scenarios: {
    stress_rps: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: PRE_ALLOCATED_VUS,
      maxVUs: MAX_VUS,
      stages: rpsStages(),
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
  return buildSummary('stress_rps', data);
}
