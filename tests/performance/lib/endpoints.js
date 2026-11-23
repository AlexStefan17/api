// Endpoint configurations for the performance test framework.
//
// Each endpoint has a display name (for reports/tags), a response body validator,
// and a description of the expected shape. Adding a new endpoint means adding an
// entry here — the request logic, error logging and tags pick it up automatically.
//
// Validation functions receive the parsed JSON body and return true/false.

// /v1/total/ returns { total: { jobs: <number>, companies: <number> } }
function validateTotal(body) {
  return (
    body !== null &&
    typeof body === 'object' &&
    body.total !== null &&
    typeof body.total === 'object' &&
    Number.isFinite(body.total.jobs) &&
    Number.isFinite(body.total.companies)
  );
}

// /v1/random/ returns a single random job object:
//   { title, company, location, workmode, url, salary, tags, cif, date, status }
function validateRandom(body) {
  return (
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    typeof body.title === 'string' &&
    typeof body.company === 'string' &&
    Array.isArray(body.location) &&
    Array.isArray(body.tags)
  );
}

const ENDPOINTS = {
  '/v1/total/': {
    name: 'total',
    validate: validateTotal,
    description: '{ total: { jobs: <number>, companies: <number> } }',
  },
  '/v1/random/': {
    name: 'random',
    validate: validateRandom,
    description: '{ title, company, location: [], tags: [], ... } (random job object)',
  },
};

// Look up the configuration for a given endpoint path.
// Unknown endpoints get a permissive passthrough config so that new endpoints
// can be tested without editing this file — they just won't have body validation.
export function getEndpointConfig(endpointPath) {
  if (ENDPOINTS[endpointPath]) {
    return ENDPOINTS[endpointPath];
  }

  return {
    name: endpointPath
      .replace(/^\/+|\/+$/g, '')
      .replace(/\//g, '-') || 'root',
    validate: () => true,
    description: 'unknown endpoint (no validation configured)',
  };
}

export function getEndpointName(endpointPath) {
  return getEndpointConfig(endpointPath).name;
}

// All known endpoint paths, for documentation and tooling.
export function knownEndpoints() {
  return Object.keys(ENDPOINTS);
}
