#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REF="${LOBO_REF:-main}"
REPO="lobogrande/IoM-Arch-Optimizer-Web"
BASE="https://raw.githubusercontent.com/${REPO}/${REF}"
VENDOR="${HERE}/vendor"
mkdir -p "${VENDOR}/core" "${VENDOR}/engine"

files=(core/player.py core/block.py core/skills.py engine/combat_loop.py engine/floor_map.py project_config.py)
for f in "${files[@]}"; do
  echo "fetching $f"
  curl -fsSL "${BASE}/public/${f}" -o "${VENDOR}/${f}"
done
curl -fsSL "${BASE}/LICENSE" -o "${VENDOR}/LICENSE"
printf 'Vendored from https://github.com/%s @ %s (MIT). Not part of this repo; fetched for testing only.\n' "${REPO}" "${REF}" > "${VENDOR}/PROVENANCE.txt"
echo "done -> ${VENDOR} (ref ${REF})"
