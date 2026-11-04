// Shared configuration for every k6 script in this directory.
//
// Everything can be overridden from the command line with `-e NAME=value`,
// which keeps the scripts usable both locally and in CI without edits.

export const BASE_URL = (__ENV.BASE_URL || 'http://192.168.122.252:8081').replace(/\/+$/, '');
export const ENDPOINT = `/${(__ENV.ENDPOINT || '/v1/total/').replace(/^\/+/, '')}`;
export const RESULTS_DIR = (__ENV.RESULTS_DIR || 'tests/performance/results').replace(/\/+$/, '');
export const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || '10s';

export function targetUrl() {
  return `${BASE_URL}${ENDPOINT}`;
}

export function numberFromEnv(name, fallback) {
  const raw = __ENV[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function positiveIntFromEnv(name, fallback) {
  return Math.max(1, Math.floor(numberFromEnv(name, fallback)));
}

export function standardThresholds() {
  const p95 = numberFromEnv('P95_MS', 800);
  const p99 = numberFromEnv('P99_MS', 1500);
  const maxFailRate = numberFromEnv('MAX_FAIL_RATE', 0.01);
  const minChecksRate = numberFromEnv('MIN_CHECKS_RATE', 0.99);

  return {
    http_req_failed: [`rate<${maxFailRate}`],
    http_req_duration: [`p(95)<${p95}`, `p(99)<${p99}`],
    checks: [`rate>${minChecksRate}`],
  };
}

export const summaryTrendStats = ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'];
