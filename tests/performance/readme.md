# Performance tests (k6)

Load tests for the peviitor API, one script per test type. They run locally,
from Docker, or in CI, and write their reports to `tests/performance/results/`.

## Supported endpoints

| Endpoint | Description | Response shape |
|---|---|---|
| `/v1/total/` (default) | Total jobs and companies count | `{ total: { jobs: <number>, companies: <number> } }` |
| `/v1/random/` | A single random job listing | `{ title, company, location, workmode, url, ... }` |

Switch endpoints with `-e ENDPOINT=/v1/random/`. Results are saved separately
(e.g. `smoke-total-summary.json` vs `smoke-random-summary.json`).

## Test types

| Script | Type | Default profile | Purpose | Duration |
|---|---|---|---|---|
| `smoke.js` | smoke | 1 VU, constant | Does the endpoint work at all? | ~10s |
| `baseline.js` | baseline | 90 req/s, 3m | Repeatable reference run to compare against | ~3m 30s |
| `stress.js` | stress | 25 → 50 → … → 300 VUs | Find where the service stops meeting its SLOs | ~28m 30s |
| `stress_rps.js` | stress (RPS) | 25 → 50 → … → 400 req/s | Find the max request rate before the SLO breaks | ~20m 20s |
| `soak.js` | soak | 90 req/s, 30m | Find leaks / degradation over time | ~30m 30s |
| `spike.js` | spike | 90 → 270 → 90 req/s | Survive a traffic burst and recover | ~1m 55s |

Run the smoke test first, then baseline, then the others.

Before each run, a **preflight** request checks the effective URL and aborts
immediately with a clear message if it does not return 2xx — so a wrong
`BASE_URL`/`ENDPOINT` costs one request, not ten seconds of 404s. The effective
target is also printed at the start of every run.

## Features

### Multi-endpoint testing

Test any supported endpoint with a single test file. The `ENDPOINT` environment
variable selects which endpoint to test:

```bash
# Test /v1/total/ (default)
./tests/performance/run.sh smoke

# Test /v1/random/
./tests/performance/run.sh smoke -e ENDPOINT=/v1/random/

# Baseline for /v1/random/
./tests/performance/run.sh baseline -e ENDPOINT=/v1/random/
```

Each endpoint has its own response validation logic (defined in
`lib/endpoints.js`), and results are saved with endpoint-specific names:

- `smoke-total-summary.json` / `smoke-total-summary.txt`
- `smoke-random-summary.json` / `smoke-random-summary.txt`

Adding a new endpoint: edit `lib/endpoints.js` and add an entry with a
validation function. Unknown endpoints still work but skip body validation.

### Enhanced error logging

When checks fail, detailed error information is logged to help diagnose the
issue:

- **Status mismatch**: logs expected vs actual status code, URL, and body preview
- **Content-Type mismatch**: logs expected vs actual content type
- **Body validation failure**: logs the response body and expected shape
- **JSON parse errors**: logs the parse error and body preview
- **Slow requests**: warns when response time exceeds 1000ms
- **Connection errors**: logs connection timeouts and network errors

Example error output:
```
total: Expected status 200, got 503
   URL: http://127.0.0.1:8000/v1/total/
   Body: {"error":"Job core unavailable","details":"SOLR_SERVER not set"}
```

### Test data variation

Each request uses randomized headers and includes a random delay (0–2 seconds)
to simulate real user traffic and avoid cache effects:

- **Accept-Language**: rotates between `en-US`, `ro-RO`, `de-DE`, `fr-FR`, `en-GB`
- **User-Agent**: varies between common browser strings
- **Cache-Control**: sometimes `no-cache`, `max-age=0`, `max-age=60`, or absent
- **Think time**: 0–2 second random delay between requests

This prevents caches from serving identical responses and produces more
realistic latency measurements.

## Install k6

Linux:

```bash
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69

echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list

sudo apt-get update
sudo apt-get install k6
```

macOS: `brew install k6`

## Quick start

Start the API first (see the repository README), then from the `api/` directory:

```bash
# smoke test against a local API
./tests/performance/run.sh smoke

# smoke test for /v1/random/
./tests/performance/run.sh smoke -e ENDPOINT=/v1/random/

# against a remote API behind a /api prefix
./tests/performance/run.sh smoke \
  -e BASE_URL=http://192.168.122.252:8081/api

# one of each type
./tests/performance/run.sh baseline
./tests/performance/run.sh stress
./tests/performance/run.sh stress_rps
./tests/performance/run.sh soak
./tests/performance/run.sh spike
```

`run.sh` is just a wrapper; the direct equivalents work too:

```bash
k6 run tests/performance/smoke.js
k6 run -e BASE_URL=http://192.168.122.252:8081/api tests/performance/smoke.js
k6 run -e ENDPOINT=/v1/random/ tests/performance/smoke.js
```

## Smoke

Checks that the API responds and that the body has the expected shape. Use it
after every deploy and before any heavier test.

```bash
./tests/performance/run.sh smoke
./tests/performance/run.sh smoke -e SMOKE_VUS=2 -e SMOKE_DURATION=30s
./tests/performance/run.sh smoke -e ENDPOINT=/v1/random/
```

## Baseline

A baseline is a **repeatable** run, saved as a reference. To make it valid:

- use the same machine, fixture and parameters every time
- make sure nothing else is using the machine
- run it three times, in separate result directories
- keep the values that are consistent across runs (not a lucky single run)

```bash
for i in 1 2 3; do
  ./tests/performance/run.sh baseline \
    -e RESULTS_DIR=tests/performance/results/baseline-$i
done
```

Then compare `baseline-summary.json` from the three directories: p95, p99,
requests/s and failure rate should be close. If they are not, the environment is
not stable and the baseline is not usable.

The default rate is 90 req/s, roughly 50% of the ~183 req/s measured with one
worker; with four workers use `BASELINE_RATE=190` for a similar utilization.
Because the load is an arrival rate, it does not drop when the service slows
down, so results are comparable across runs.

## Stress

Ramps past the expected load in steps. The thresholds are the normal service
level, so a `FAIL` here means you found the breaking point, not that the test is
broken. The defaults use 25-VU steps and 2m holds, so every level reaches a
steady state before the next one (~28m30s total). Adjust the step size, hold and
peak to match the capacity you want to explore:

```bash
# quick profile: 50-VU steps, 30s holds
./tests/performance/run.sh stress \
  -e STRESS_STEP_VUS=50 -e STRESS_PEAK_VUS=150 \
  -e STRESS_STEP_DURATION=30s
```

## Stress (RPS)

Ramps the arrival rate (req/s) past the measured capacity. Unlike `stress.js`,
which controls concurrent VUs, this keeps the offered load fixed, so it answers
"at how many requests per second does the service miss its SLO?". If k6 reports
`dropped_iterations`, it could not keep up even with `STRESS_RPS_MAX_VUS`.

Defaults are 25 → 50 → … → 400 req/s with 1m holds (~20m20s). Adjust the step,
hold and peak to the capacity you want to explore:

```bash
./tests/performance/run.sh stress_rps
./tests/performance/run.sh stress_rps \
  -e STRESS_RPS_PEAK=600 -e STRESS_RPS_MAX_VUS=2000
```

## Soak

A fixed request rate for a long time. The load is set with `SOAK_RATE`
(requests/s), not with VUs, so it does not silently drop when the service slows
down. Compare the first minutes with the last minutes of the run: if latency and
error rate stay flat, the service is stable.

```bash
# default 90 req/s ≈ 50% of the ~183 req/s measured with one worker
./tests/performance/run.sh soak
# 190 req/s ≈ 50% of the ~389 req/s measured with four workers
./tests/performance/run.sh soak -e SOAK_RATE=190 -e SOAK_DURATION=2h
```

If k6 reports `dropped_iterations`, the service could not keep up with the
requested rate; lower `SOAK_RATE` or raise `SOAK_MAX_VUS`.

## Spike

Jumps from the baseline rate to a burst rate and back. The load is an arrival
rate, so the burst is applied even when the service slows down. The default
spike is 90 → 270 req/s, below the ~389 req/s measured with four workers, so it
is an acceptance spike rather than a breaking one. For a breaking spike, raise
`SPIKE_RATE` and expect queueing/timeouts on the current `php -S` stack:

```bash
./tests/performance/run.sh spike
./tests/performance/run.sh spike -e SPIKE_RATE=400 -e SPIKE_PRE_ALLOCATED_VUS=1200
```

The 900 preallocated VUs cover 270 req/s at a ~3.3s tail. If you raise
`SPIKE_RATE`, size `SPIKE_PRE_ALLOCATED_VUS` at peak rate × worst latency, or
set it equal to `SPIKE_MAX_VUS` to avoid allocation drops entirely.

## Reports

Unlike Locust, k6 has no report file by default: it only prints a terminal
summary. `run.sh` therefore enables k6's web dashboard export, which produces
the equivalent of `locust --html`. Every run writes, inside
`tests/performance/results/`:

- `<test>-<endpoint>-report.html` — self-contained HTML report with the summary
  tables and time-series charts (latency, request rate, VUs). This is the
  Locust-style view. Disable it with `NO_HTML=1`, or choose another path with
  `REPORT_HTML=...`. It follows `-e RESULTS_DIR=...` so it stays next to the
  other files. The endpoint name is included when not `/v1/total/` (e.g.
  `smoke-random-report.html`).
- `<test>-<endpoint>-summary.json` — full k6 summary, for later analysis (pandas, jq, diffing runs)
- `<test>-<endpoint>-summary.txt` — compact human-readable summary, including the status
  code distribution (2xx/3xx/4xx/5xx) and `dropped_iterations` for arrival-rate
  tests, to make failures obvious
- the same summary is printed to stdout

For the default `/v1/total/` endpoint, the `-total-` infix is omitted for
backward compatibility:

```
smoke-summary.json          # /v1/total/ (default)
smoke-random-summary.json   # /v1/random/
```

```bash
# HTML report (default behavior of run.sh)
./tests/performance/run.sh smoke

# skip the HTML report
NO_HTML=1 ./tests/performance/run.sh smoke

# custom location, or a persistent copy of the last run
REPORT_HTML=/tmp/smoke.html ./tests/performance/run.sh smoke
```

k6 skips report generation when the run is shorter than three times the
dashboard's sampling period (10s by default), so `run.sh` sets
`K6_WEB_DASHBOARD_PERIOD` to `1s`. If you call `k6 run` directly, do the same:

```bash
K6_WEB_DASHBOARD=true \
K6_WEB_DASHBOARD_PERIOD=1s \
K6_WEB_DASHBOARD_EXPORT=tests/performance/results/smoke-report.html \
k6 run tests/performance/smoke.js
```

Other outputs, all native to k6, if you call `k6 run` directly or want more:

```bash
# live dashboard while the test runs: http://127.0.0.1:5665
K6_WEB_DASHBOARD=true k6 run tests/performance/smoke.js

# per-request CSV for spreadsheet / pandas analysis (Locust's CSV download)
k6 run --out csv=tests/performance/results/smoke.csv tests/performance/smoke.js

# every metric as JSON lines, for custom tooling
k6 run --out json=tests/performance/results/smoke.jsonl tests/performance/smoke.js
```

## CI

`api/.github/workflows/test_env.yml` starts Solr, loads one of the fixtures and
runs the API locally, so the k6 scripts can run in CI without touching
production. Trigger the workflow manually and pick the `performance` input:

- `smoke` (default) — quick check that the endpoint responds
- `baseline` — reference run at 90 req/s
- `stress` — find the breaking point in VUs
- `stress_rps` — find the maximum request rate before the SLO breaks
- `spike` — traffic burst and recovery
- `soak` — 30m endurance run at 90 req/s; the job timeout is 60m, so it is opt-in
- `none` — only the functional checks
- `php_workers` — PHP server concurrency (`1`, `2`, `3` or `4`)

`stress`, `stress_rps` and `spike` run with `--no-thresholds`, because a failed
threshold is the expected outcome of those tests. The `php_workers` input
selects how many PHP workers serve the API; with one worker the load tests
measure the request queue rather than the service ceiling. Every run uploads
`tests/performance/results/` as the `performance-<type>-<fixture>` artifact:
the artifact contains `<type>-report.html` with the dashboard charts, plus the
JSON/TXT summaries. The text summary is also written to the workflow run page.

Before the selected test, the workflow runs a short 15s smoke warm-up (results
in `/tmp/warmup`, thresholds disabled) so cold-start latency does not
contaminate the percentiles. `baseline` runs with `continue-on-error`, so a
threshold FAIL stays visible in the log without failing the job.

## Configuration

Global settings, passed with `-e NAME=value`:

| Variable | Default | Meaning |
|---|---|---|
| `BASE_URL` | `http://127.0.0.1:8000` | API under test |
| `ENDPOINT` | `/v1/total/` | Endpoint path to test (`/v1/total/` or `/v1/random/`) |
| `REQUEST_TIMEOUT` | `10s` | Per-request timeout |
| `P95_MS` | `800` | p95 latency threshold (ms) |
| `P99_MS` | `1500` | p99 latency threshold (ms) |
| `MAX_FAIL_RATE` | `0.01` | Max failed-request rate (1%) |
| `MIN_CHECKS_RATE` | `0.99` | Min checks pass rate (99%) |
| `RESULTS_DIR` | `tests/performance/results` | Where reports are written |
| `SKIP_PREFLIGHT` | unset | Set to `1` to skip the preflight request |

Per test type:

| Script | Variables (defaults) |
|---|---|
| `smoke.js` | `SMOKE_VUS` (1), `SMOKE_DURATION` (10s) |
| `baseline.js` | `BASELINE_RATE` (90), `BASELINE_DURATION` (3m), `BASELINE_PRE_ALLOCATED_VUS` (50), `BASELINE_MAX_VUS` (500) |
| `stress.js` | `STRESS_STEP_VUS` (25), `STRESS_PEAK_VUS` (300), `STRESS_RAMP` (20s), `STRESS_STEP_DURATION` (2m), `STRESS_RAMP_DOWN` (30s) |
| `stress_rps.js` | `STRESS_RPS_START` (25), `STRESS_RPS_STEP` (25), `STRESS_RPS_PEAK` (400), `STRESS_RPS_RAMP` (15s), `STRESS_RPS_STEP_DURATION` (1m), `STRESS_RPS_RAMP_DOWN` (20s), `STRESS_RPS_PRE_ALLOCATED_VUS` (50), `STRESS_RPS_MAX_VUS` (1000) |
| `soak.js` | `SOAK_RATE` (90), `SOAK_DURATION` (30m), `SOAK_PRE_ALLOCATED_VUS` (50), `SOAK_MAX_VUS` (500) |
| `spike.js` | `SPIKE_BASE_RATE` (90), `SPIKE_RATE` (270), `SPIKE_WARMUP` (10s), `SPIKE_HOLD` (30s), `SPIKE_RAMP` (5s), `SPIKE_RECOVERY` (30s), `SPIKE_PRE_ALLOCATED_VUS` (900), `SPIKE_MAX_VUS` (2000) |

Thresholds are intentionally generous for shared CI runners; tighten them once
you have a baseline from your own machine.

## Docker

The scripts import shared modules from `lib/`, so mount the repository instead
of piping the file to stdin:

```bash
docker run --rm -i --network host \
  --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" -w /work \
  grafana/k6 run -e BASE_URL=http://127.0.0.1:8000 \
  tests/performance/smoke.js
```

`--network host` lets the container reach an API bound to `127.0.0.1` on the
host (Linux). On macOS/Windows use `-e BASE_URL=http://host.docker.internal:8000`
instead.

## Troubleshooting

- **`Preflight GET ... returned HTTP 404`** — the run aborts before sending load.
  The URL is wrong. If the API is behind `/api`, use
  `-e BASE_URL=http://host:8081/api` (or `-e ENDPOINT=/api/v1/total/`).
  Remember that k6 also reads exported shell variables: check `echo $BASE_URL`.
- **`Failed: 100%`, checks 0%, latency under 1 ms** — the requests never reached
  the endpoint. Usually a wrong `BASE_URL`: if the API is behind `/api`, use
  `-e BASE_URL=http://host:8081/api` (or `-e ENDPOINT=/api/v1/total/`). The
  status code section of the summary shows `4xx` in this case.
- **`Failed: 100%`, latency around the timeout** — the connection is refused or
  blocked. Check that the API is running and reachable from where k6 runs.
- **Thresholds fail while checks pass** — the endpoint works but is slower than
  the configured `P95_MS` / `P99_MS`. Re-run to confirm, then tune the threshold
  or investigate the service.
- **`could not open 'tests/performance/results/...'`** — the results directory is
  missing. Run the test through `run.sh` (it creates the directory) or create it
  with `mkdir -p tests/performance/results` before calling `k6 run` directly.
- **Error logs show errors but tests pass** — the error logs are informational.
  They fire when individual checks fail during the run, but the overall test
  result depends on the thresholds. If most requests succeed but a few fail, you
  will see error logs but the test may still pass.
- **Slow request warnings** — requests taking longer than 1000ms are logged
  to help identify performance issues. These are warnings, not failures.

## File structure

```
tests/performance/
├── lib/
│   ├── config.js        # Shared configuration (BASE_URL, ENDPOINT, thresholds)
│   ├── endpoints.js     # Endpoint definitions and validation logic
│   ├── preflight.js     # Pre-test URL check
│   ├── report.js        # Summary report generation
│   ├── request.js       # Main request function with error logging
│   ├── test-data.js     # Random headers and delays for realistic load
│   └── total-request.js # Backward-compatible re-export of request.js
├── results/             # Output directory (git-ignored)
├── run.sh               # Convenience wrapper for k6
├── smoke.js             # Smoke test
├── baseline.js          # Baseline reference run
├── stress.js            # Stress test (VU ramp)
├── stress_rps.js        # Stress test (RPS ramp)
├── soak.js              # Endurance test
├── spike.js             # Spike test (traffic burst)
└── readme.md            # This file
```

## Notes

- `php -S` is single-threaded by default. On the shared 4-vCPU CI runner, one
  worker serves ~183 req/s and four workers ~389 req/s; past that, extra workers
  mostly add contention and Solr timeouts rather than throughput. For real
  measurements use a dedicated environment, ideally with php-fpm and OPcache.
- Arrival-rate tests (`baseline`, `soak`, `stress_rps`, `spike`) need enough
  `*_MAX_VUS` to sustain the target rate. If k6 reports `dropped_iterations`, the
  service could not keep up.
- `smoke` and `stress` are **closed-loop** (`constant-vus` / `ramping-vus`):
  VUs are concurrent users, not a fixed request rate, so throughput follows from
  latency. `baseline`, `soak`, `stress_rps` and `spike` are **open-loop**
  (`*-arrival-rate`): the requested RPS stays fixed.
- Do not run load tests against production without coordinating with the owners;
  use local or staging.
- `run.sh` creates `tests/performance/results/` if it is missing; generated files
  are git-ignored.
