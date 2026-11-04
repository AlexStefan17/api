import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

import { REQUEST_TIMEOUT, targetUrl } from './config.js';

// Status-code counters make a failing run easy to diagnose: a 100% failure
// rate with all requests in 4xx means a wrong URL, not a slow endpoint.
const status2xx = new Counter('http_status_2xx');
const status3xx = new Counter('http_status_3xx');
const status4xx = new Counter('http_status_4xx');
const status5xx = new Counter('http_status_5xx');
const statusOther = new Counter('http_status_other');

function recordStatus(status) {
  if (status >= 200 && status < 300) {
    status2xx.add(1);
  } else if (status >= 300 && status < 400) {
    status3xx.add(1);
  } else if (status >= 400 && status < 500) {
    status4xx.add(1);
  } else if (status >= 500 && status < 600) {
    status5xx.add(1);
  } else {
    statusOther.add(1);
  }
}

// One iteration of the test: call GET /v1/total/ and validate the response.
// Shared by every scenario so the assertions stay in one place.
export function getTotal() {
  const response = http.get(targetUrl(), {
    timeout: REQUEST_TIMEOUT,
    headers: {
      Accept: 'application/json',
    },
    tags: {
      endpoint: 'total',
    },
  });

  recordStatus(response.status);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'content-type is application/json': (r) =>
      String(r.headers['Content-Type'] || '').includes('application/json'),
    'body reports numeric totals': (r) => {
      try {
        const body = r.json();

        return (
          body !== null &&
          typeof body === 'object' &&
          body.total !== null &&
          typeof body.total === 'object' &&
          Number.isFinite(body.total.jobs) &&
          Number.isFinite(body.total.companies)
        );
      } catch (error) {
        return false;
      }
    },
  });
}
