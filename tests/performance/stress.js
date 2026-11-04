import { positiveIntFromEnv, standardThresholds, summaryTrendStats } from './lib/config.js';
import { getTotal } from './lib/total-request.js';
import { buildSummary } from './lib/report.js';
import { preflight } from './lib/preflight.js';

// Stress test: ramp past the expected load in steps and watch where the
// service stops meeting its thresholds. The thresholds are the normal service
// level, so a FAIL here is the signal that the breaking point was reached, not
// a broken test.

const STEP_VUS = positiveIntFromEnv('STRESS_STEP_VUS', 20);
const PEAK_VUS = positiveIntFromEnv('STRESS_PEAK_VUS', 80);
const STEP_RAMP = __ENV.STRESS_RAMP || '10s';
const STEP_DURATION = __ENV.STRESS_STEP_DURATION || '30s';
const RAMP_DOWN = __ENV.STRESS_RAMP_DOWN || '15s';

function stressStages() {
  const stages = [];

  if (STEP_VUS >= PEAK_VUS) {
    stages.push({ duration: STEP_RAMP, target: PEAK_VUS });
    stages.push({ duration: STEP_DURATION, target: PEAK_VUS });
  } else {
    for (let target = STEP_VUS; target <= PEAK_VUS; target += STEP_VUS) {
      stages.push({ duration: STEP_RAMP, target });
      stages.push({ duration: STEP_DURATION, target });
    }

    if (PEAK_VUS % STEP_VUS !== 0) {
      stages.push({ duration: STEP_RAMP, target: PEAK_VUS });
      stages.push({ duration: STEP_DURATION, target: PEAK_VUS });
    }
  }

  stages.push({ duration: RAMP_DOWN, target: 0 });

  return stages;
}

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: stressStages(),
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
  return buildSummary('stress', data);
}
