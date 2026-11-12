#!/usr/bin/env bash
# Print the ID of the runtime builder image for this host's architecture,
# building it from runtime/builder/Containerfile when the recipe changed.
set -euo pipefail
source "$(dirname "$0")/scratch.sh"
TMPDIR=$(oh_scratch_root); export TMPDIR
repo=$(cd "$(dirname "$0")/.." && pwd)
tag=localhost/open-habitat-runtime-builder:latest
recipe=$(sha256sum "$repo/runtime/builder/Containerfile" | cut -d' ' -f1)
if [[ $(podman image inspect "$tag" --format '{{index .Labels "runtime.recipe_sha"}}' 2>/dev/null || :) != "$recipe" ]]; then
  podman build --pull=missing -q --label "runtime.recipe_sha=$recipe" -t "$tag" -f "$repo/runtime/builder/Containerfile" "$repo/runtime/builder" >/dev/null
fi
podman image inspect "$tag" --format '{{.Id}}'
