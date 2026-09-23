#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
scenario=${1:-}
json=false
[[ ${2:-} == --json ]] && json=true
fail(){ if $json; then printf '{"schema_version":1,"error":{"code":"%s","message":"%s"}}\n' "$1" "$2" >&2; else printf 'error: %s\n' "$2" >&2; fi; exit "$3"; }
[[ $scenario == self-test ]] || fail invalid_scenario "Foundation supports only self-test; full systemd scenarios belong to their owning slices" 1
# Validate pinned, synthetic inputs without downloading an image or touching a host home.
source "$repo/test/vm/image.env"
[[ $IMAGE_URL == https://cloud-images.ubuntu.com/noble/20260911/* ]] || fail invalid_image_recipe "VM URL is not immutable" 1
[[ $IMAGE_SHA256 =~ ^[0-9a-f]{64}$ ]] || fail invalid_image_checksum "VM checksum is malformed" 1
grep -q 'name: agent-a' "$repo/test/vm/cloud-init.yaml"
grep -q 'name: agent-b' "$repo/test/vm/cloud-init.yaml"
if $json; then printf '{"schema_version":1,"data":{"status":"fixture-valid","launched":false,"reason":"QEMU launch is not part of the credential-free foundation gate","image_sha256":"%s"},"warnings":[]}\n' "$IMAGE_SHA256"; else echo 'VM fixture valid (image not launched)'; fi
