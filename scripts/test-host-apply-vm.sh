#!/usr/bin/env bash
# Product-only guest installation on an independently trusted isolated VM runner.
set -euo pipefail
if [[ ! ${BASH_EXECUTION_STRING+x} ]]; then exec bash -c "$(cat -- "$0")" "$0" "$@"; fi
export TMPDIR=/var/tmp
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ $# == 3 ]] || { echo 'usage: test-host-apply-vm.sh RELEASE_DIRECTORY TRUSTED_PUBLIC_KEY TRUSTED_VM_RUNNER' >&2; exit 1; }
release=$(realpath "$1"); key=$(realpath "$2"); runner=$(realpath "$3")
[[ -x $runner ]] || exit 1
mkdir -p "$repo/.cache/vm"
run=$(mktemp -d "$repo/.cache/vm/core.XXXXXXXX")
source_commit=$(git -C "$repo" rev-parse HEAD)
source_tree=$(git -C "$repo" rev-parse HEAD^{tree})
source_dirty=false
if [[ -n $(git -C "$repo" status --porcelain) ]]; then source_dirty=true; fi
trap 'rm -f "$run/product.iso" "$run/seed.img"' EXIT
version=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$release/release.json")
digest=$(sha256sum "$release/release.json" | awk '{print $1}')
image="$repo/.cache/vm/apply-image/noble-server-cloudimg-amd64.img"
sha=$(sed -n 's/^IMAGE_SHA256=//p' "$repo/test/vm/profile-image.env")
echo "$sha  $image" | sha256sum -c --status
modules="$repo/.cache/apply-vm-modules"
echo "6d5206a8ae384b03ec41b11e3be5a4a13ff30cbaefe4a6d2ce62bf6fc062b216  $modules/quota_tree.ko.zst" | sha256sum -c --status
echo "a54b39dc4719e7a2dd407acfa0ff913da311b374761ef5e25eff0c8f607436bd  $modules/quota_v2.ko.zst" | sha256sum -c --status
"$repo/scripts/package-release.sh" --version 0.0.0-test --target linux-amd64 --web-dir "$repo/web/dist" --output "$run/package" > "$run/package.log"
archive=$(find "$run/package" -maxdepth 1 -name '*.tar.gz' -print)
"$repo/scripts/verify-release.sh" --archive "$archive" >> "$run/package.log"
mkdir "$run/product"
tar --same-permissions -xzf "$archive" -C "$run/product" --strip-components=1
mkdir "$run/product/release"
cp "$release/release.json" "$release/release.sig" "$release/core.tar.gz" "$run/product/release/"
cp "$modules/quota_tree.ko.zst" "$modules/quota_v2.ko.zst" "$run/product/"
cp "$repo/test/vm/qemu-launch.sh" "$run/qemu-launch.sh"
python3 - "$run" "$key" "$version" "$digest" "$repo/test/vm/host-apply-proof.py" <<'PY'
import base64,json,pathlib,sys
run,key,version,digest,proof=sys.argv[1:];run=pathlib.Path(run)
files=[]
for path,data,mode in [('/etc/open-habitat/release-key.pub',pathlib.Path(key).read_bytes(),'0644'),('/usr/local/sbin/host-apply-proof',pathlib.Path(proof).read_bytes(),'0755'),('/etc/fixture-target.json',json.dumps(dict(version=version,manifest_sha256=digest)).encode(),'0644'),('/etc/systemd/system/fixture-host-apply.service',b'''[Unit]
Description=Disposable host apply boot acceptance
After=open-habitat-broker.service
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /usr/local/sbin/host-apply-proof
StandardOutput=journal+console
StandardError=journal+console
TimeoutStartSec=30min
[Install]
WantedBy=multi-user.target
''','0644')]:
 files.append(dict(path=path,encoding='b64',content=base64.b64encode(data).decode(),permissions=mode))
seed=dict(users=['default'],write_files=files,runcmd=[['/usr/bin/python3','/usr/local/sbin/host-apply-proof']])
(run/'cloud.yaml').write_text('#cloud-config\n'+json.dumps(seed)+'\n')
(run/'meta-data').write_text('instance-id: host-apply-disposable\nlocal-hostname: apply-fixture\n')
PY
# Assembly is local and bounded; QEMU runs only in the supplied isolated runner.
tag=localhost/open-habitat-vm-tools:prereq
podman run --rm --network none --userns=keep-id -v "$run:/run-data" "$tag" genisoimage -quiet -R -uid 0 -gid 0 -V PRODUCT -o /run-data/product.iso /run-data/product
podman run --rm --network none --userns=keep-id -v "$run:/run-data" "$tag" cloud-localds /run-data/seed.img /run-data/cloud.yaml /run-data/meta-data
exec {vm_lock}>"$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)/runtime-vm.lock"
flock -n "$vm_lock" || { echo 'runtime_vm_busy' >&2; exit 1; }
set +e
timeout -k 10s 3600s "$runner" "$run" "$image" "$run/qemu-launch.sh" 2>&1 | python3 "$repo/scripts/vm-serial-drain.py" "$run/serial.log" "$run/serial-receipt.json"
status=${PIPESTATUS[0]} drain=${PIPESTATUS[1]}
set -e
printf 'VM evidence: %s\n' "$run"
[[ $status == 0 && $drain == 0 ]] && grep -q HOST_APPLY_PASS "$run/serial.log" && ! grep -q HOST_APPLY_FAIL "$run/serial.log" || exit 1
python3 - "$run" "$repo" "$release" "$key" "$image" "$source_commit" "$source_tree" "$source_dirty" <<'PY'
import hashlib,json,pathlib,subprocess,sys
run,repo,release,key,image,commit,tree,dirty=sys.argv[1:];run=pathlib.Path(run)
def sha(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
serial=json.loads((run/'serial-receipt.json').read_text());assert not serial['capped'] and not serial['token_leaked'],serial
proof=None
for line in (run/'serial.log').read_text().splitlines():
 if 'HOST_APPLY_RECEIPT ' in line:proof=json.loads(line.split('HOST_APPLY_RECEIPT ',1)[1])
required=('fresh_install','repeat_no_change','stale_refused','interrupted_continuation','broker_not_reseeded','cold_reboot','quota_default_readback','quota_override_preserved','administrators_deferred_then_granted','admission_remove_and_readmit')
assert proof and proof['status']=='passed' and all(proof.get(k) is True for k in required),proof
assert proof.get('browser_signin') is False and proof.get('pid1')=='systemd',proof
assert proof.get('native_daemon_uids')==[21032,21033],proof
result=dict(schema_version=1,source_commit=commit,source_tree=tree,source_dirty=dirty=="true",manifest_sha256=sha(pathlib.Path(release)/'release.json'),public_key_sha256=sha(key),base_image_sha256=sha(image),product_binary_sha256=sha(run/'product/bin/open-habitat'),serial_sha256=sha(run/'serial.log'),serial=serial,guest=proof)
(run/'apply-receipt.json').write_text(json.dumps(result,indent=2)+'\n')
PY
