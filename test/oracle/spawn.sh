#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "${HERE}/vendor/engine/floor_map.py" ] || bash "${HERE}/fetch-engine.sh"
python3 "${HERE}/run_theirs_spawn.py"
node "${HERE}/run_ours_spawn.mjs"
node "${HERE}/compare_spawn.mjs"
