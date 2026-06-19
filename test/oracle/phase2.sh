#!/usr/bin/env bash
# Phase 2: run-results comparison (average floor) between our simulation and
# lobogrande's combat_loop. Fetches their engine if needed.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "${HERE}/vendor/engine/combat_loop.py" ] || bash "${HERE}/fetch-engine.sh"
python3 "${HERE}/run_theirs_runs.py"
node "${HERE}/run_ours_runs.mjs"
node "${HERE}/compare_runs.mjs"
