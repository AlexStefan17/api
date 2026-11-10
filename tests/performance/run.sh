#!/usr/bin/env bash
#
# Convenience wrapper: ./run.sh <test-type> [k6 options...]
#
# Examples:
#   ./run.sh smoke -e BASE_URL=http://127.0.0.1:8000
#   ./run.sh baseline -e BASELINE_DURATION=5m
#   ./run.sh stress -e STRESS_PEAK_VUS=100
#
# Every run also writes an HTML report with charts (the Locust `--html`
# equivalent). Disable it with NO_HTML=1, or set REPORT_HTML=<path> to choose
# the location. See the Reports section of readme.md.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is not installed. See tests/performance/readme.md or run with Docker." >&2
  exit 1
fi

TYPE="${1:-}"
shift || true

case "$TYPE" in
  smoke)      NAME=smoke;    SCRIPT="$SCRIPT_DIR/smoke.js" ;;
  baseline)   NAME=baseline; SCRIPT="$SCRIPT_DIR/baseline.js" ;;
  stress)     NAME=stress;   SCRIPT="$SCRIPT_DIR/stress.js" ;;
  stress_rps) NAME=stress_rps; SCRIPT="$SCRIPT_DIR/stress_rps.js" ;;
  soak)       NAME=soak;     SCRIPT="$SCRIPT_DIR/soak.js" ;;
  spike)      NAME=spike;    SCRIPT="$SCRIPT_DIR/spike.js" ;;
  *)
    echo "Usage: $0 {smoke|baseline|stress|stress_rps|soak|spike} [k6 options...]" >&2
    exit 1
    ;;
esac

# The HTML report must land next to the JSON/TXT summaries written by
# lib/report.js, so mirror the RESULTS_DIR passed through the k6 options.
RESULTS_DIR="${RESULTS_DIR:-tests/performance/results}"
expect_results_dir=0
for arg in "$@"; do
  case "$arg" in
    -e|--env)
      expect_results_dir=1
      ;;
    RESULTS_DIR=*)
      if [ "$expect_results_dir" = 1 ]; then
        RESULTS_DIR="${arg#RESULTS_DIR=}"
        expect_results_dir=0
      fi
      ;;
    --env=RESULTS_DIR=*)
      RESULTS_DIR="${arg#--env=RESULTS_DIR=}"
      ;;
    *)
      expect_results_dir=0
      ;;
  esac
done
RESULTS_DIR="${RESULTS_DIR%/}"

# k6 has no report file by default: the web dashboard has to be enabled, and
# its HTML export is what produces the charts and tables Locust shows out of
# the box. Both variables stay overridable from the environment.
#
# k6 skips report generation when the run is shorter than three times the
# sampling period (10s by default), which would silently drop the report for
# the 10s smoke test, so the period defaults to 1s here.
if [ "${NO_HTML:-0}" != "1" ]; then
  export K6_WEB_DASHBOARD="${K6_WEB_DASHBOARD:-true}"
  export K6_WEB_DASHBOARD_EXPORT="${K6_WEB_DASHBOARD_EXPORT:-${REPORT_HTML:-$RESULTS_DIR/$NAME-report.html}}"
  export K6_WEB_DASHBOARD_PERIOD="${K6_WEB_DASHBOARD_PERIOD:-1s}"
fi

cd "$API_DIR"

# k6 does not create missing directories for the handleSummary outputs, and
# the results directory is not tracked (only .gitkeep), so a fresh checkout
# would otherwise lose every report.
mkdir -p "$RESULTS_DIR"

exec k6 run "$@" "$SCRIPT"
