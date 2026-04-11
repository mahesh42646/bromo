#!/usr/bin/env bash
# Called from Claude Code hooks; args are forwarded to code-review-graph.
set -euo pipefail
# Command hooks pass JSON on stdin; drain it so the CLI never misreads the payload.
if [ ! -t 0 ]; then cat >/dev/null || true; fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/scripts/crg-env.sh"
cd "${ROOT}"
if ! command -v code-review-graph >/dev/null 2>&1; then
  exit 0
fi
exec code-review-graph "$@"
