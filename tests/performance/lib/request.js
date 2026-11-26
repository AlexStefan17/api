// Shared request function for all k6 scenarios.
//
// Every scenario calls this function instead of making its own http.get() so
// the assertions, error logging and metrics stay consistent. The endpoint to
// test is selected via the ENDPOINT env var (defaults to /v1/total/).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

import { REQUEST_TIMEOUT, targetUrl, ENDPOINT } from './config.js';
import { getEndpointConfig, getEndpointName } from './endpoints.js';
import { getRandomHeaders, getRandomDelay } from './test-data.js';

// Status-code counters make a failing run easy to diagnose: a 100% failure
// rate with all requests in 4xx means a wrong URL, not a slow endpoint.
const status2xx = new Counter('http_status_2xx');
const status3xx = new Counter('http_status_3xx');
const status4xx = new Counter('http_status_4xx');
const status5xx = new Counter('http_status_5xx');
const statusOther = new Counter('http_status_other');

const endpointName = getEndpointName(ENDPOINT);
const endpointConfig = getEndpointConfig(ENDPOINT);

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

// One iteration of the test: call GET <endpoint> and validate the response.
// Shared by every scenario so the assertions stay in one place.
export function makeRequest() {
  const url = targetUrl();
  
  // Vary headers to simulate real user traffic and avoid cache effects
  const headers = getRandomHeaders();

  const response = http.get(url, {
    timeout: REQUEST_TIMEOUT,
    headers: headers,
    tags: {
      endpoint: endpointName,
    },
  });

  recordStatus(response.status);

  // Enhanced error logging: log detailed information when checks fail
  check(response, {
    'status is 200': (r) => {
      if (r.status !== 200) {
        console.error(`${endpointName}: Expected status 200, got ${r.status}`);
        console.error(`   URL: ${url}`);
        console.error(`   Body: ${r.body.substring(0, 200)}`);
      }
      return r.status === 200;
    },
    'content-type is application/json': (r) => {
      const contentType = String(r.headers['Content-Type'] || '');
      if (!contentType.includes('application/json')) {
        console.error(`${endpointName}: Expected Content-Type application/json, got "${contentType}"`);
        console.error(`   URL: ${url}`);
      }
      return contentType.includes('application/json');
    },
    'response body is valid': (r) => {
      try {
        const body = r.json();
        
        // Use endpoint-specific validation
        const isValid = endpointConfig.validate(body);
        
        if (!isValid) {
          console.error(`${endpointName}: Response body failed validation`);
          console.error(`   URL: ${url}`);
          console.error(`   Body: ${r.body.substring(0, 500)}`);
          console.error(`   Expected shape: ${endpointConfig.description}`);
        }
        
        return isValid;
      } catch (error) {
        console.error(`${endpointName}: Failed to parse JSON response`);
        console.error(`   URL: ${url}`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Body: ${r.body.substring(0, 200)}`);
        return false;
      }
    },
  });

  // Log slow requests for debugging performance issues
  if (response.timings.duration > 1000) {
    console.warn(`${endpointName}: Slow request (${response.timings.duration.toFixed(0)}ms)`);
    console.warn(`   URL: ${url}`);
  }

  // Log connection errors
  if (response.error) {
    console.error(`${endpointName}: Request error`);
    console.error(`   URL: ${url}`);
    console.error(`   Error: ${response.error}`);
  }
}

// Backward compatibility alias for existing tests
export function getTotal() {
  makeRequest();
}
