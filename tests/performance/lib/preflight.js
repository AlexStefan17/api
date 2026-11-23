import http from 'k6/http';

import { REQUEST_TIMEOUT, targetUrl, ENDPOINT_NAME } from './config.js';

// Runs once, before the scenarios start. Catches a wrong BASE_URL/ENDPOINT
// before the load test wastes time sending thousands of 404s, and prints the
// effective target so the report is unambiguous.
export function preflight() {
  const url = targetUrl();

  if (__ENV.SKIP_PREFLIGHT === '1') {
    console.log(`Preflight skipped. Target: ${url}`);
    return { url, status: null };
  }

  const response = http.get(url, {
    timeout: REQUEST_TIMEOUT,
    headers: {
      Accept: 'application/json',
    },
    tags: {
      phase: 'preflight',
      endpoint: ENDPOINT_NAME,
    },
  });

  if (response.status < 200 || response.status >= 300) {
    console.error(`Preflight FAILED: GET ${url} returned HTTP ${response.status}`);
    console.error(`   Body: ${response.body.substring(0, 300)}`);
    throw new Error(
      `Preflight GET ${url} returned HTTP ${response.status}. ` +
        'Check BASE_URL and ENDPOINT; for an API behind /api use ' +
        'BASE_URL=http://host:8081/api (or ENDPOINT=/api/v1/total/).',
    );
  }

  console.log(`Preflight OK (HTTP ${response.status}, endpoint: ${ENDPOINT_NAME}): ${url}`);

  return { url, status: response.status };
}
