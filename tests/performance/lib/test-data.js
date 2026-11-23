// Test data variation for more realistic load simulation.
//
// Real users vary their headers (Accept-Language, User-Agent) and think time
// (delay between requests). Fixed headers and zero delays let caches serve
// every request identically, which hides real-world latency.

const languages = ['en-US', 'ro-RO', 'de-DE', 'fr-FR', 'en-GB'];
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 k6-test/1.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 k6-test/1.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 k6-test/1.0',
  'k6-load-test/1.0',
];
const cacheControls = ['no-cache', 'max-age=0', 'max-age=60', undefined];

// Randomize headers to avoid cache effects and simulate diverse clients.
// Always sets Accept: application/json; other headers rotate randomly.
export function getRandomHeaders() {
  const headers = {
    Accept: 'application/json',
    'Accept-Language': languages[Math.floor(Math.random() * languages.length)],
    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
  };

  // Cache-Control is sometimes absent (most real requests) and sometimes set
  const cacheControl = cacheControls[Math.floor(Math.random() * cacheControls.length)];
  if (cacheControl) {
    headers['Cache-Control'] = cacheControl;
  }

  return headers;
}

// Random delay (think time) between requests, 0-2 seconds.
// Simulates the time a real user spends reading / deciding the next action.
export function getRandomDelay() {
  return Math.floor(Math.random() * 2000) / 1000; // 0.0 - 2.0 seconds
}
