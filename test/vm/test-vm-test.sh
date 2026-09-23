#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/repo/scripts" "$tmp/repo/test/vm" "$tmp/repo/.cache"
cp "$repo/scripts/vm-test.sh" "$tmp/repo/scripts/"
cp "$repo/test/vm/image.env" "$repo/test/vm/cloud-init.yaml" "$repo/test/vm/Containerfile" "$tmp/repo/test/vm/"
run(){ "$tmp/repo/scripts/vm-test.sh" "$@"; }
run self-test --json > "$tmp/out"
python3 - "$tmp/out" <<'PY'
import json,sys
v=json.load(open(sys.argv[1])); assert v['data']['launched'] is False and v['schema_version']==1 and v['warnings']==[]
PY
if run unknown --json > "$tmp/out" 2> "$tmp/err"; then exit 1; fi
python3 - "$tmp/err" <<'PY'
import json,sys
assert json.load(open(sys.argv[1]))['error']['code']=='invalid_scenario'
PY
printf '\nUNSAFE=$(touch /tmp/never-evaluate-image-env)\n' >> "$tmp/repo/test/vm/image.env"
if run self-test --json > "$tmp/out" 2> "$tmp/err"; then exit 1; fi
[[ ! -e /tmp/never-evaluate-image-env ]]
grep -q 'invalid_image_recipe' "$tmp/err"
cp "$repo/test/vm/image.env" "$tmp/repo/test/vm/image.env"
sed -i 's/^IMAGE_SHA256=.*/IMAGE_SHA256=invalid/' "$tmp/repo/test/vm/image.env"
if run self-test --json > "$tmp/out" 2> "$tmp/err"; then exit 1; fi
grep -q 'invalid_image_checksum' "$tmp/err"
cp "$repo/test/vm/image.env" "$tmp/repo/test/vm/image.env"
sed -i 's|/home/agent-b/SYNTHETIC-IDENTITY|/home/agent-b/INVALID|' "$tmp/repo/test/vm/cloud-init.yaml"
if run self-test --json > "$tmp/out" 2> "$tmp/err"; then exit 1; fi
grep -q 'invalid_cloud_init' "$tmp/err"
# Container-assisted tests remain offline: reject malformed YAML before download,
# and reject a poisoned cache before attempting to boot QEMU.
if command -v podman >/dev/null && podman image exists localhost/native-agent-host-vm-tools:prereq; then
  cp "$repo/test/vm/cloud-init.yaml" "$tmp/repo/test/vm/cloud-init.yaml"
  printf '\n: malformed: [\n' >> "$tmp/repo/test/vm/cloud-init.yaml"
  if run systemd-self-test --json > "$tmp/out" 2> "$tmp/err"; then exit 1; fi
  grep -q 'invalid_cloud_init' "$tmp/err"
  cp "$repo/test/vm/cloud-init.yaml" "$tmp/repo/test/vm/cloud-init.yaml"
  mkdir -p "$tmp/repo/.cache/vm"
  printf 'poison' > "$tmp/repo/.cache/vm/noble-server-cloudimg-amd64.img"
  if run systemd-self-test --json > "$tmp/out" 2> "$tmp/err"; then exit 1; fi
  grep -q 'image_checksum_mismatch' "$tmp/err"
  [[ $(find "$tmp/repo/.cache/vm" -maxdepth 1 -type d -name 'run.*' | wc -l) -eq 0 ]]
fi
# Guard the explicit timeout and kill/cleanup wiring against accidental removal.
grep -Fq 'timeout -k 10s 600s podman run' "$tmp/repo/scripts/vm-test.sh"
grep -Fq 'timeout -k 5s 360s podman run' "$tmp/repo/scripts/vm-test.sh"
grep -Fq 'trap cleanup EXIT' "$tmp/repo/scripts/vm-test.sh"
grep -Fq 'podman rm -f "vm-fixture-$$" "vm-download-$$"' "$tmp/repo/scripts/vm-test.sh"
echo 'VM parser/envelope/fixture/checksum/cleanup/timeout-wiring tests passed (offline; no boot)'
