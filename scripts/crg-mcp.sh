#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/scripts/crg-env.sh"
cd "${ROOT}"
exec uvx code-review-graph serve
