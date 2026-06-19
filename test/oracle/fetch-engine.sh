#!/usr/bin/env bash
# Fetch lobogrande's pure-Python engine (MIT licensed) into vendor/ so it can be
# used as an oracle for our math. We do NOT commit their code; this pulls it on
# demand. Pin REF to a commit SHA for reproducibility once the API is reachable;
# "main" tracks their latest.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REF="${LOBO_REF:-main}"
REPO="lobogrande/IoM-Arch-Optimizer-Web"
BASE="https://raw.githubusercontent.com/${REPO}/${REF}"
VENDOR="${HERE}/vendor"
mkdir -p "${VENDOR}/core" "${VENDOR}/engine"

# core/player.py is self-contained (imports only math/struct) and is all the
# stat-level oracle needs. The rest support the combat-loop oracle (phase 2).
files=(core/player.py core/block.py core/skills.py engine/combat_loop.py engine/floor_map.py project_config.py)
for f in "${files[@]}"; do
  echo "fetching $f"
  curl -fsSL "${BASE}/public/${f}" -o "${VENDOR}/${f}"
done
curl -fsSL "${BASE}/LICENSE" -o "${VENDOR}/LICENSE"
printf 'Vendored from https://github.com/%s @ %s (MIT). Not part of this repo; fetched for testing only.\n' "${REPO}" "${REF}" > "${VENDOR}/PROVENANCE.txt"
echo "done -> ${VENDOR} (ref ${REF})"
