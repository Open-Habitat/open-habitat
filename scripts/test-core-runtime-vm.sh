#!/usr/bin/env bash
# Reuses the repository's immutable noble image and networkless QEMU recipe.
set -euo pipefail
export TMPDIR=/var/tmp
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ $# == 4 || $# == 5 ]] || { echo 'usage: test-core-runtime-vm.sh RELEASE_DIR TRUSTED_PUBLIC_KEY VERSION MANIFEST_SHA256 [PROFILE_PROOF_SCRIPT]' >&2; exit 1; }
release=$(realpath "$1"); key=$(realpath "$2"); version=$3; digest=$4
[[ $digest =~ ^[0-9a-f]{64}$ ]] || exit 1
mkdir -p "$repo/.cache/vm"
run=$(mktemp -d "$repo/.cache/vm/core.XXXXXXXX")
# Keep serial and receipts, discard only large disposable disks at exit.
cleanup(){ rm -f "$run/overlay.qcow2" "$run/seed.img" "$run/product.iso"; }
trap cleanup EXIT
image=$repo/.cache/vm/noble-server-cloudimg-amd64.img
[[ -f $image ]] || cp "$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)/../.cache/vm/noble-server-cloudimg-amd64.img" "$image"
sha=$(sed -n 's/^IMAGE_SHA256=//p' "$repo/test/vm/image.env")
echo "$sha  $image" | sha256sum -c --status
# Explicit toolchain choice is caller-owned; no host installation.
CGO_ENABLED=0 go build -o "$run/verifier" ./cmd/runtime-release
CGO_ENABLED=0 go build -o "$run/product" ./cmd/open-habitat
CGO_ENABLED=0 go build -o "$run/container-probe" ./test/vm/container-probe
chmod 755 "$run/verifier" "$run/product" "$run/container-probe"
python3 - "$run" "$key" "$version" "$digest" "$repo/test/vm/core-runtime-proof.py" "${5:-}" <<'PY'
import base64,json,pathlib,sys
run,key,version,digest,proof,profile_proof=sys.argv[1:]
files=[]
for path,source,mode in [('/etc/core-runtime-key.pub',key,'0644'),('/usr/local/sbin/core-proof',proof,'0755')]:
 files.append(dict(path=path,encoding='b64',content=base64.b64encode(pathlib.Path(source).read_bytes()).decode(),permissions=mode))
files.append(dict(path='/etc/core-runtime-target.json',content=json.dumps(dict(version=version,manifest_sha256=digest)),permissions='0644'))
if profile_proof:
 files.append(dict(path='/usr/local/sbin/profile-proof',encoding='b64',content=base64.b64encode(pathlib.Path(profile_proof).read_bytes()).decode(),permissions='0755'))
seed=dict(users=['default'],write_files=files,runcmd=[['/usr/bin/python3','/usr/local/sbin/core-proof']])
pathlib.Path(run,'cloud.yaml').write_text('#cloud-config\n'+json.dumps(seed)+'\n')
pathlib.Path(run,'meta-data').write_text('instance-id: core-runtime-disposable\nlocal-hostname: runtime-fixture\n')
PY
tag=localhost/open-habitat-vm-tools:prereq
mkdir "$run/bundle"
cp "$release/"*.tar.gz "$release/release.json" "$release/release.sig" "$run/bundle/"
podman run --rm --network none --userns=keep-id -v "$run:/run-data" "$tag" genisoimage -quiet -R -graft-points -V PRODUCT -o /run-data/product.iso /release=/run-data/bundle /verifier=/run-data/verifier /product=/run-data/product /container-probe=/run-data/container-probe
podman run --rm --network none --userns=keep-id -v "$run:/run-data" "$tag" cloud-localds /run-data/seed.img /run-data/cloud.yaml /run-data/meta-data
cp "$repo/test/vm/qemu-launch.sh" "$run/qemu-launch.sh"
set +e
timeout -k 10s 900s podman run --rm --network none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --memory=4g --cpus=2 -v "$repo/.cache/vm:/cache:ro" -v "$run:/run-data" "$tag" sh /run-data/qemu-launch.sh core-runtime /run-data 2>&1 | python3 "$repo/scripts/vm-serial-drain.py" "$run/serial.log" "$run/serial-receipt.json"
status=${PIPESTATUS[0]} drain=${PIPESTATUS[1]}
set -e
printf 'VM evidence: %s\n' "$run"
if [[ $status != 0 || $drain != 0 ]] || ! grep -q CORE_RUNTIME_PASS "$run/serial.log" || grep -q CORE_RUNTIME_FAIL "$run/serial.log"; then
  echo 'error: fresh runtime guest did not complete' >&2
  exit 1
fi
python3 - "$run/serial-receipt.json" <<'PY'
import json,sys
r=json.load(open(sys.argv[1])); assert not r['capped'] and not r['token_leaked'], r
PY
