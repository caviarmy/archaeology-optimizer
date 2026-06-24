#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "${HERE}/vendor/core/player.py" ] || bash "${HERE}/fetch-engine.sh"
python3 "${HERE}/run_theirs.py"
node "${HERE}/run_ours.mjs"
node "${HERE}/compare.mjs"
