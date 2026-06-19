#!/usr/bin/env bash
# End-to-end oracle check: fetch lobogrande's engine (once), run every scenario
# through their engine and ours, and diff the derived stats. Exit nonzero on any
# divergence beyond rounding tolerance.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "${HERE}/vendor/core/player.py" ] || bash "${HERE}/fetch-engine.sh"
python3 "${HERE}/run_theirs.py"
node "${HERE}/run_ours.mjs"
node "${HERE}/compare.mjs"
