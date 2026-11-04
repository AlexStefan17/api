import { BASE_URL, ENDPOINT, RESULTS_DIR } from './config.js';

// Builds the object k6 expects from `handleSummary`. Each test type writes its
// own <test>-summary.json / <test>-summary.txt so runs never overwrite each
// other unless they share the same RESULTS_DIR and test type on purpose.
export function buildSummary(testName, data) {
  const summary = buildTextSummary(testName, data);

  return {
    [`${RESULTS_DIR}/${testName}-summary.json`]: JSON.stringify(data, null, 2),
    [`${RESULTS_DIR}/${testName}-summary.txt`]: summary,
    stdout: `\n${summary}\n`,
  };
}

function metricValues(data, name) {
  const metric = data.metrics && data.metrics[name];
  return metric && metric.values ? metric.values : {};
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function buildTextSummary(testName, data) {
  const duration = metricValues(data, 'http_req_duration');
  const failed = metricValues(data, 'http_req_failed');
  const checks = metricValues(data, 'checks');
  const requests = metricValues(data, 'http_reqs');
  const status2xx = metricValues(data, 'http_status_2xx').count || 0;
  const status3xx = metricValues(data, 'http_status_3xx').count || 0;
  const status4xx = metricValues(data, 'http_status_4xx').count || 0;
  const status5xx = metricValues(data, 'http_status_5xx').count || 0;
  const statusOther = metricValues(data, 'http_status_other').count || 0;
  const runMs = data.state && data.state.testRunDurationMs ? data.state.testRunDurationMs : 0;

  const lines = [
    `${testName.toUpperCase()} - GET ${BASE_URL}${ENDPOINT}`,
    `Duration: ${formatNumber(runMs / 1000, 1)}s`,
    '',
    `Requests: ${requests.count || 0} (${formatNumber(requests.rate)}/s)`,
    `Failed: ${formatNumber((failed.rate || 0) * 100)}%`,
    '',
    'Status codes',
    `  2xx    ${status2xx}`,
    `  3xx    ${status3xx}`,
    `  4xx    ${status4xx}`,
    `  5xx    ${status5xx}`,
    `  other  ${statusOther}`,
    '',
    'Latency (ms)',
  ];

  ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'].forEach((name) => {
    lines.push(`  ${name.padEnd(5)} ${formatNumber(duration[name])}`);
  });

  lines.push('');
  lines.push(`Checks passed: ${formatNumber((checks.rate || 0) * 100)}%`);
  lines.push('');
  lines.push('Thresholds');

  Object.keys(data.metrics).forEach((metricName) => {
    const thresholds = data.metrics[metricName].thresholds;
    if (!thresholds) {
      return;
    }

    Object.keys(thresholds).forEach((expression) => {
      const ok = thresholds[expression].ok;
      lines.push(`  ${ok ? 'PASS' : 'FAIL'} ${metricName}: ${expression}`);
    });
  });

  return lines.join('\n');
}
