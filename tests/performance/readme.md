# Performance tests (k6)

Load tests for `GET /v1/total/`, one script per test type. They run locally,
from Docker, or in CI, and write their reports to `tests/performance/results/`.

## Test types

| Script | Type | Default profile | Purpose | Duration |
|---|---|---|---|---|
| `smoke.js` | smoke | 1 VU, constant | Does the endpoint work at all? | ~10s |
| `baseline.js` | baseline | 0 → 10 VUs, 3m hold | Repeatable reference run to compare against | ~3m 20s |
| `stress.js` | stress | 25 → 50 → … → 300 VUs | Find where the service stops meeting its SLOs | ~28m 30s |
| `soak.js` | soak | 10 VUs, 30m hold | Find leaks / degradation over time | ~31m |
| `spike.js` | spike | 2 → 50 → 2 VUs | Survive a traffic burst and recover | ~1m 45s |

Run the smoke test first, then baseline, then the others.

Before each run, a **preflight** request checks the effective URL and aborts
immediately with a clear message if it does not return 2xx — so a wrong
`BASE_URL`/`ENDPOINT` costs one request, not ten seconds of 404s. The effective
target is also printed at the start of every run.

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

# against a remote API behind a /api prefix
./tests/performance/run.sh smoke \
  -e BASE_URL=http://192.168.122.252:8081/api

# one of each type
./tests/performance/run.sh baseline
./tests/performance/run.sh stress
./tests/performance/run.sh soak
./tests/performance/run.sh spike
```

`run.sh` is just a wrapper; the direct equivalents work too:

```bash
k6 run tests/performance/smoke.js
k6 run -e BASE_URL=http://192.168.122.252:8081/api tests/performance/smoke.js
```

## Smoke

Checks that the API responds and that the body has the expected shape. Use it
after every deploy and before any heavier test.

```bash
./tests/performance/run.sh smoke
./tests/performance/run.sh smoke -e SMOKE_VUS=2 -e SMOKE_DURATION=30s
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

## Soak

Moderate load for a long time. Compare the first minutes with the last minutes
of the run: if latency and error rate stay flat, the service is stable.

```bash
./tests/performance/run.sh soak
./tests/performance/run.sh soak -e SOAK_DURATION=2h -e SOAK_VUS=20
```

## Spike

Jumps from low to high load and back. `SPIKE_VUS` should be clearly above
`SPIKE_BASE_VUS`:

```bash
./tests/performance/run.sh spike
./tests/performance/run.sh spike -e SPIKE_BASE_VUS=2 -e SPIKE_VUS=100
```

## Reports

Unlike Locust, k6 has no report file by default: it only prints a terminal
summary. `run.sh` therefore enables k6's web dashboard export, which produces
the equivalent of `locust --html`. Every run writes, inside
`tests/performance/results/`:

- `<test>-report.html` — self-contained HTML report with the summary tables and
  time-series charts (latency, request rate, VUs). This is the Locust-style
  view. Disable it with `NO_HTML=1`, or choose another path with
  `REPORT_HTML=...`. It follows `-e RESULTS_DIR=...` so it stays next to the
  other files.
- `<test>-summary.json` — full k6 summary, for later analysis (pandas, jq, diffing runs)
- `<test>-summary.txt` — compact human-readable summary, including the status
  code distribution (2xx/3xx/4xx/5xx) to make failures obvious
- the same summary is printed to stdout

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
- `stress` — find the breaking point
- `spike` — traffic burst and recovery
- `soak` — 30m endurance run; the job timeout is 60m, so it is opt-in
- `none` — only the functional checks
- `php_workers` — PHP server concurrency (`1`, `2` or `4`)

`stress` and `spike` run with `--no-thresholds`, because a failed threshold is
the expected outcome of those tests. The `php_workers` input selects how many
PHP workers serve the API; with one worker the load tests measure the request
queue rather than the service ceiling. Every run uploads
`tests/performance/results/` as the `performance-<type>-<fixture>` artifact:
the artifact contains `<type>-report.html` with the dashboard charts, plus the
JSON/TXT summaries. The text summary is also written to the workflow run page.

## Configuration

Global settings, passed with `-e NAME=value`:

| Variable | Default | Meaning |
|---|---|---|
| `BASE_URL` | `http://127.0.0.1:8000` | API under test |
| `ENDPOINT` | `/v1/total/` | Request path; use it when the API sits behind a prefix |
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
| `baseline.js` | `BASELINE_VUS` (10), `BASELINE_RAMP_UP` (10s), `BASELINE_DURATION` (3m), `BASELINE_RAMP_DOWN` (10s) |
| `stress.js` | `STRESS_STEP_VUS` (25), `STRESS_PEAK_VUS` (300), `STRESS_RAMP` (20s), `STRESS_STEP_DURATION` (2m), `STRESS_RAMP_DOWN` (30s) |
| `soak.js` | `SOAK_VUS` (10), `SOAK_RAMP_UP` (30s), `SOAK_DURATION` (30m), `SOAK_RAMP_DOWN` (15s) |
| `spike.js` | `SPIKE_BASE_VUS` (2), `SPIKE_VUS` (50), `SPIKE_WARMUP` (10s), `SPIKE_HOLD` (30s), `SPIKE_RAMP` (5s), `SPIKE_RECOVERY` (30s) |

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

## Notes

- `php -S` is single-threaded by default. For real measurements start it with
  `PHP_CLI_SERVER_WORKERS=4 php -S 127.0.0.1:8000 -t .`, otherwise you measure
  the PHP request queue rather than the endpoint.
- The scenarios are **closed-loop** (`ramping-vus`): VUs are concurrent users,
  not a fixed request rate. Throughput follows from latency. For a fixed RPS
  target, add a `constant-arrival-rate` executor.
- Do not run load tests against production without coordinating with the owners;
  use local or staging.
- `tests/performance/results/.gitkeep` keeps the output directory in git, because
  k6 does not create missing directories. Generated files are git-ignored.
