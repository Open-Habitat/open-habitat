#!/usr/bin/env bash
# Reuses the repository's immutable noble image and networkless QEMU recipe.
set -euo pipefail
# Long guest runs must not resume at a changed byte offset if the developer
# edits this script while QEMU is running. Execute one immutable source string.
if [[ ! ${BASH_EXECUTION_STRING+x} ]]; then
  exec bash -c "$(cat -- "$0")" "$0" "$@"
fi
export TMPDIR=/var/tmp
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ $# == 4 || $# == 5 || $# == 6 ]] || { echo 'usage: test-core-runtime-vm.sh RELEASE_DIR TRUSTED_PUBLIC_KEY VERSION MANIFEST_SHA256 [PROFILE_PROOF_SCRIPT [TRUSTED_VM_RUNNER]]' >&2; exit 1; }
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
source_commit=$(git -C "$repo" rev-parse HEAD)
source_tree=$(git -C "$repo" rev-parse HEAD^{tree})
source_dirty=false
if ! git -C "$repo" diff --quiet || ! git -C "$repo" diff --cached --quiet; then source_dirty=true; fi
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
# A TCG guest consumes more host RSS than its emulated RAM. Admit only one
# runtime guest per checkout family, with room left for unrelated services.
exec {vm_lock}>"$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)/runtime-vm.lock"
flock -n "$vm_lock" || { echo 'runtime_vm_busy: another runtime guest holds the shared test lock' >&2; exit 1; }
seconds=900
[[ -z ${5:-} ]] || seconds=3600
if [[ $# == 6 ]]; then
  # Operator-supplied test transport, never a bundle executable. It receives
  # only the assembled synthetic run, pinned base image and launch recipe;
  # it owns remote capacity admission/cleanup and streams the guest serial.
  [[ $6 == /* && -f $6 && -x $6 ]] || { echo 'error: trusted VM runner must be an absolute executable path' >&2; exit 1; }
  command=(timeout -k 10s "${seconds}s" "$6" "$run" "$image" "$run/qemu-launch.sh")
else
  available_kib=$(awk '$1 == "MemAvailable:" {print $2}' /proc/meminfo)
  [[ $available_kib =~ ^[0-9]+$ && $available_kib -ge 6291456 ]] || { echo 'runtime_vm_capacity_unavailable: require 6 GiB available RAM; retry after other guests finish' >&2; exit 1; }
  command=(timeout -k 10s "${seconds}s" podman run --rm --network none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --memory=3500m --cpus=2 -v "$repo/.cache/vm:/cache:ro" -v "$run:/run-data" "$tag" sh /run-data/qemu-launch.sh core-runtime /run-data)
fi
set +e
"${command[@]}" 2>&1 | python3 "$repo/scripts/vm-serial-drain.py" "$run/serial.log" "$run/serial-receipt.json"
status=${PIPESTATUS[0]} drain=${PIPESTATUS[1]}
set -e
printf 'VM evidence: %s\n' "$run"
if [[ $status != 0 || $drain != 0 ]] || ! grep -q CORE_RUNTIME_PASS "$run/serial.log" || grep -q CORE_RUNTIME_FAIL "$run/serial.log"; then
  echo 'error: fresh runtime guest did not complete' >&2
  exit 1
fi
python3 - "$run" "$release" "$key" "$version" "$digest" "$source_commit" "$source_tree" "$source_dirty" "${5:-}" <<'PY'
import hashlib,json,pathlib,re,sys
run,release,key,version,digest,commit,tree,dirty,profiles=sys.argv[1:]
run=pathlib.Path(run); release=pathlib.Path(release)
receipt=json.loads((run/'serial-receipt.json').read_text())
assert not receipt['capped'] and not receipt['token_leaked'],receipt
lines={re.sub(r'^\[\s*[0-9]+\.[0-9]+\] cloud-init\[[0-9]+\]: ', '', line.strip()) for line in (run/'serial.log').read_text().splitlines()}
assert 'CORE_RUNTIME_PASS' in lines and 'CORE_RUNTIME_FAIL' not in lines
manifest=(release/'release.json').read_bytes()
assert hashlib.sha256(manifest).hexdigest()==digest
m=json.loads(manifest)
assert m['version']==version and m['commit']==commit
if profiles:
 assert 'PROFILE_RUNTIME_PASS' in lines
 for a in m['artifacts']:
  if a['profile']!='core':
   for uid in (21001,21002):
    name='agent-a' if uid==21001 else 'agent-b'
    assert f"PROFILE_RUNTIME_ACCEPTED profile={a['profile']} uid={uid} HOME=/home/{name} PATH=/usr/bin:/bin" in lines

def sha(path):
 h=hashlib.sha256()
 with pathlib.Path(path).open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
archives={a['archive']:sha(release/a['archive']) for a in m['artifacts']}
assert all(archives[a['archive']]==a['sha256'] for a in m['artifacts'])
result=dict(schema_version=1,source_commit=commit,source_tree=tree,source_dirty=dirty=='true',version=version,manifest_commit=m['commit'],manifest_sha256=digest,public_key_sha256=sha(key),archives=archives,binaries={name:sha(run/name) for name in ('verifier','product','container-probe')},serial_sha256=sha(run/'serial.log'),serial=receipt,profiles_checked=bool(profiles))
(run/'runtime-receipt.json').write_text(json.dumps(result,indent=2)+'\n')
PY
