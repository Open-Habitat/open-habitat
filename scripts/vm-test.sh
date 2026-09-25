#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd -P)
scenario=${1:-}
json=false
# Preserve the requested error envelope even when argv validation fails.
[[ ${2:-} == --json ]] && json=true
fail(){
  if $json; then python3 - "$1" "$2" <<'PY' >&2
import json,sys
print(json.dumps({'schema_version':1,'error':{'code':sys.argv[1],'message':sys.argv[2]}}))
PY
  else printf 'error: %s\n' "$2" >&2; fi
  exit "$3"
}
[[ $# -eq 1 || ( $# -eq 2 && ${2:-} == --json ) ]] || fail invalid_arguments 'Expected self-test|systemd-self-test|two-user-routing|broker-guest|jit-provision|jit-login [--json]' 1
[[ $scenario == self-test || $scenario == systemd-self-test || $scenario == two-user-routing || $scenario == broker-guest || $scenario == jit-provision || $scenario == jit-login ]] || fail invalid_scenario 'Expected self-test, systemd-self-test, two-user-routing, broker-guest, jit-provision or jit-login' 1
# Treat the recipe as data, never source executable text.
image_url= image_sha= image_arch=
while IFS= read -r line || [[ -n $line ]]; do
  case $line in
    \#*|'') ;;
    IMAGE_URL=*) [[ -z $image_url ]] || fail invalid_image_recipe 'Duplicate IMAGE_URL' 1; image_url=${line#*=} ;;
    IMAGE_SHA256=*) [[ -z $image_sha ]] || fail invalid_image_recipe 'Duplicate IMAGE_SHA256' 1; image_sha=${line#*=} ;;
    IMAGE_ARCH=*) [[ -z $image_arch ]] || fail invalid_image_recipe 'Duplicate IMAGE_ARCH' 1; image_arch=${line#*=} ;;
    *) fail invalid_image_recipe 'Unknown or malformed image.env entry' 1 ;;
  esac
done < "$repo/test/vm/image.env"
[[ $image_url == 'https://cloud-images.ubuntu.com/noble/20260911/noble-server-cloudimg-amd64.img' && $image_arch == amd64 ]] || fail invalid_image_recipe 'Image URL/architecture must match reviewed immutable noble image' 1
[[ $image_sha =~ ^[0-9a-f]{64}$ ]] || fail invalid_image_checksum 'Image SHA-256 must be 64 lowercase hex characters' 1
if [[ $scenario == self-test ]]; then
  grep -q 'name: agent-a' "$repo/test/vm/cloud-init.yaml" && grep -q 'name: agent-b' "$repo/test/vm/cloud-init.yaml" && grep -q 'path: /home/agent-b/SYNTHETIC-IDENTITY' "$repo/test/vm/cloud-init.yaml" || fail invalid_cloud_init 'Synthetic fixture markers are missing' 1
  if $json; then printf '{"schema_version":1,"data":{"status":"fixture-valid","launched":false,"reason":"Explicit systemd-self-test required for boot proof","image_sha256":"%s"},"warnings":[]}\n' "$image_sha"; else echo 'VM fixture valid (image not launched)'; fi
  exit 0
fi
command -v timeout >/dev/null || fail missing_timeout 'GNU timeout is required' 2
command -v podman >/dev/null || fail missing_podman 'Rootless Podman is required for full VM run' 2
[[ $(podman info --format '{{.Host.Security.Rootless}}' 2>/dev/null) == true ]] || fail podman_unavailable 'Rootless Podman is unavailable; check storage and user namespace' 2
# Build is disposable, pinned at the base manifest. No host package installation.
tag=localhost/native-agent-host-vm-tools:prereq
recipe_sha=$(sha256sum "$repo/test/vm/Containerfile" | cut -d' ' -f1)
current_recipe=$(podman image inspect "$tag" --format '{{index .Labels "fixture.recipe_sha"}}' 2>/dev/null || :)
if [[ $current_recipe != "$recipe_sha" ]]; then
  if ! timeout -k 10s 360s podman build --pull=never -q --label "fixture.recipe_sha=$recipe_sha" -t "$tag" -f "$repo/test/vm/Containerfile" "$repo/test/vm" >/dev/null; then
    fail tool_image_unavailable 'Could not build pinned rootless VM tools image; check network/storage' 2
  fi
fi
image_id=$(podman image inspect "$tag" --format '{{.Id}}')
[[ $image_id =~ ^[0-9a-f]{64}$ ]] || fail tool_image_unavailable 'Could not identify VM tools image' 2
podman_run(){ timeout -k 5s 30s podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --pids-limit=128 --memory=3g --cpus=2 --read-only --tmpfs /tmp:rw,size=256m --mount "type=bind,src=$repo/test/vm,dst=/fixture,ro=true" "$image_id" "$@"; }
if ! podman_run cloud-init schema --config-file /fixture/cloud-init.yaml >/dev/null 2>&1 || ! podman_run python3 -c 'import yaml; c=yaml.safe_load(open("/fixture/cloud-init.yaml")); assert isinstance(c,dict) and c.get("users") and c.get("write_files") and c.get("runcmd"); assert [(u["name"],u["uid"]) for u in c["users"] if isinstance(u,dict)] == [("agent-a",21001),("agent-b",21002),("native-agent-host-gateway",21003)]; assert {f["path"] for f in c["write_files"]} >= {"/home/agent-a/SYNTHETIC-IDENTITY","/home/agent-b/SYNTHETIC-IDENTITY","/usr/local/sbin/fixture-proof"}' 2>/dev/null; then
  fail invalid_cloud_init 'cloud-init YAML is invalid or synthetic identities/fixture paths are missing' 1
fi
cache=$repo/.cache/vm
[[ ! -L $repo/.cache && ! -L $cache ]] || fail invalid_cache_path 'Repository cache directories must not be symlinks' 1
mkdir -p "$cache" && chmod 700 "$cache"
run=$(mktemp -d "$cache/run.XXXXXXXX") || fail io_error 'Could not allocate private run directory' 2
chmod 700 "$run"
# Cleanup includes TERM/INT. podman run is foreground; timeout kills its process group.
cleanup(){ podman rm -f "vm-fixture-$$" "vm-download-$$" >/dev/null 2>&1 || :; rm -rf -- "$run"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
image=$cache/noble-server-cloudimg-amd64.img
if [[ ! -f $image ]]; then
  # Download to the isolated cache only; never promote an unverified partial image.
  if ! timeout -k 5s 360s podman run --rm --name "vm-download-$$" --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --pids-limit=64 --memory=512m --read-only --tmpfs /tmp:rw,size=16m --mount "type=bind,src=$run,dst=/run-data" "$image_id" curl --fail --location --max-time 330 --max-filesize 2147483648 --output /run-data/download.part "$image_url"; then
    fail image_download_failed 'Pinned image download failed (network, size or timeout)' 2
  fi
  if ! echo "$image_sha  $run/download.part" | sha256sum -c --status; then
    fail image_checksum_mismatch 'Downloaded image does not match pinned SHA-256' 1
  fi
  mv "$run/download.part" "$image"
fi
[[ ! -L $image && -f $image ]] || fail invalid_image_cache 'Cached image is not a regular non-symlink file' 1
[[ $(stat -c %s "$image") -le 2147483648 ]] || fail invalid_image_cache 'Cached image exceeds 2 GiB' 1
echo "$image_sha  $image" | sha256sum -c --status || fail image_checksum_mismatch 'Cached image does not match pinned SHA-256' 1
printf 'instance-id: synthetic-systemd-fixture\nlocal-hostname: fixture-vm\n' > "$run/meta-data"
seed_file=/fixture/cloud-init.yaml
binary_sha= product_commit=
if [[ $scenario == two-user-routing || $scenario == broker-guest || $scenario == jit-provision || $scenario == jit-login ]]; then
  command -v go >/dev/null || fail missing_go 'Go is required to build product fixture' 2
  command -v openssl >/dev/null || fail missing_openssl 'OpenSSL is required for fixture TLS' 2
  product_commit=$(git -C "$repo" rev-parse HEAD)
  (cd "$repo" && CGO_ENABLED=0 go build -trimpath -o "$run/native-agent-host" ./cmd/native-agent-host) || fail product_build_failed 'Could not build product binary' 2
  binary_sha=$(sha256sum "$run/native-agent-host" | cut -d' ' -f1)
  if [[ $scenario == jit-provision || $scenario == jit-login ]]; then
    # Read only: exact landed Fleetrepo checkout and reviewed policy hashes are
    # checked by the renderer before any private bytes reach the disposable ISO.
    jit_args=()
    [[ $scenario == jit-login ]] && jit_args=(login)
    FLEETREPO_JIT_SOURCE=${FLEETREPO_JIT_SOURCE:-/home/maintainer/Sources/fleetrepo} python3 "$repo/test/vm/jit-fixture.py" "$run" "$run/native-agent-host" "${jit_args[@]}" >"$run/fixture.log" 2>&1 || fail invalid_policy_input 'Pinned Fleetrepo commit or reviewed JIT gate blob unavailable or invalid' 1
    seed_file=/run-data/jit-cloud-init.yaml
  elif [[ $scenario == broker-guest ]]; then
    python3 "$repo/test/vm/broker-fixture.py" "$run" "$run/native-agent-host" || fail invalid_product_fixture 'Could not render broker seed' 2
    seed_file=/run-data/broker-cloud-init.yaml
  else
    python3 "$repo/test/vm/product-fixture.py" "$run" "$run/native-agent-host" || fail invalid_product_fixture 'Could not render private product seed' 2
    seed_file=/run-data/product-cloud-init.yaml
  fi
  if [[ $scenario == two-user-routing || $scenario == jit-provision || $scenario == jit-login ]]; then
    # The pinned noble cloud image lacks the ACL utilities required by the
    # broker's existing-binding verifier. Carry guest-local tools from the
    # disposable pinned image; never install a host package or relax ACLs.
    if ! podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --mount "type=bind,src=$run,dst=/run-data" "$image_id" sh -c 'cp /usr/bin/setfacl /usr/bin/getfacl /lib/x86_64-linux-gnu/libacl.so.1 /run-data/'; then fail product_iso_failed 'Could not stage guest ACL utilities' 2; fi
    for entry in 'setfacl 8c6e90b674671cd3b9d0e61d9177cbd022e1eb9380a2241a189c3d9a51d15922' 'getfacl 91e889370c104d40a4f812c1a4527cfae01a6ab6b6ffa1f8f8a52cdeff7ef96f' 'libacl.so.1 1f5247285409ec89990e9fe384d78dfb2ae6ec8e210a2657073babc8d6b7e54f'; do
      read -r filename digest <<< "$entry"
      echo "$digest  $run/$filename" | sha256sum -c --status || fail product_iso_failed 'Pinned guest ACL utility digest mismatch' 2
    done
    iso_files=(/native-agent-host=/run-data/native-agent-host /setfacl=/run-data/setfacl /getfacl=/run-data/getfacl /libacl.so.1=/run-data/libacl.so.1)
  else
    iso_files=(/native-agent-host=/run-data/native-agent-host)
  fi
  if ! timeout -k 5s 60s podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --tmpfs /tmp:rw,size=64m --mount "type=bind,src=$run,dst=/run-data" "$image_id" genisoimage -quiet -R -graft-points -V PRODUCT -o /run-data/product.iso "${iso_files[@]}"; then fail product_iso_failed 'Could not seal read-only product ISO' 2; fi
  if ! podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --tmpfs /tmp:rw,size=32m --mount "type=bind,src=$run,dst=/run-data,ro=true" "$image_id" cloud-init schema --config-file "$seed_file" >/dev/null 2>&1; then fail invalid_product_fixture 'Product cloud-init schema invalid' 1; fi
fi
# Seed and writable overlay are private to this invocation.
if ! timeout -k 5s 60s podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --tmpfs /tmp:rw,size=128m --mount "type=bind,src=$repo/test/vm,dst=/fixture,ro=true" --mount "type=bind,src=$run,dst=/run-data" "$image_id" cloud-localds /run-data/seed.img "$seed_file" /run-data/meta-data; then fail seed_failed 'cloud-localds failed' 2; fi
start=$(date +%s)
# All VM devices are emulated; no KVM, USB or guest/host shared filesystem.
# QEMU user-mode DHCP is required by cloud-init, but the container has --network=none
# and restrict=on prevents guest forwarding beyond the emulated subnet.
# Serial is capped at 2 MiB; bounded process lifetime and overlay allocation.
set +e
timeout -k 10s 600s podman run --rm --name "vm-fixture-$$" --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --pids-limit=256 --memory=4g --cpus=2 --mount "type=bind,src=$cache,dst=/cache,ro=true" --mount "type=bind,src=$run,dst=/run-data" "$image_id" sh -c 'qemu-img create -q -f qcow2 -F qcow2 -b /cache/noble-server-cloudimg-amd64.img /run-data/overlay.qcow2 && { set --; if test -f /run-data/product.iso; then set -- -drive file=/run-data/product.iso,media=cdrom,readonly=on; fi; exec qemu-system-x86_64 -accel tcg -machine q35 -m 2048 -smp 2 -display none -monitor none -serial stdio -no-reboot -nic user,model=virtio-net-pci,restrict=on -drive file=/run-data/overlay.qcow2,if=virtio,format=qcow2 -drive file=/run-data/seed.img,if=virtio,format=raw,readonly=on "$@"; }' 2>&1 | head -c 2097152 > "$run/serial.log"
vm_status=${PIPESTATUS[0]}
set -e
duration=$(($(date +%s)-start))
# Require clean guest poweroff and an exact proof; a timeout is always failure.
proof=$(tr -d '\r' < "$run/serial.log" | grep -a 'VM_PROOF=' | tail -n 1 | sed 's/.*VM_PROOF=//' || :)
if [[ $scenario == jit-login ]]; then
  if [[ $vm_status -ne 0 || -z $proof ]] || ! python3 - "$proof" <<'LOGIN_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1])
 if not isinstance(p,dict) or p.get('status')!='passed' or p.get('scope')!='jit-login-slice' or p.get('pid1')!='systemd': sys.exit(1)
 if p.get('uids')!=[21032,21033,21003] or [r.get('uid') for r in p.get('routes',[])]!=[21032,21033]: sys.exit(1)
 if not all(p.get(k) is True for k in ('pool_vacant_before_login','new_accounts','committed_bindings','root_ledger','pinned_policy_gate','socket_activation')): sys.exit(1)
 if not all(v is True for key in ('native_gh','denials','token_scan') for v in (p.get(key) or {}).values()): sys.exit(1)
 if p.get('token_scan',{}).get('passed') is not True: sys.exit(1)
except (ValueError,TypeError,AttributeError): sys.exit(1)
LOGIN_CHECK
  then
    reason=$(python3 - "$proof" <<'REASON'
import json,re,sys
try:
 p=json.loads(sys.argv[1]);print(re.sub('[^A-Za-z0-9 _=./;:-]',' ',str(p.get('reason','missing proof')))[:300])
except (ValueError,TypeError):print('missing proof')
REASON
)
    fail boot_proof_failed "JIT login guest failed closed (VM exit $vm_status, ${duration}s; check=$reason)" 2
  fi
  if ! python3 - "$repo" "$run/serial.log" "$run/native-agent-host" <<'TOKEN_SCAN'
import pathlib,sys
repo=pathlib.Path(sys.argv[1]);tokens=[('PRODUCT_VM_TOKEN_'+n+'_FIXTURE_ONLY_92764').encode() for n in ('guestone','guesttwo')]
files=[pathlib.Path(sys.argv[2]),pathlib.Path(sys.argv[3]),repo/'scripts/vm-test.sh',*list((repo/'test/vm').glob('*.py'))]
if any(t in f.read_bytes() for f in files for t in tokens):sys.exit(1)
TOKEN_SCAN
  then fail token_scan_failed 'Token found in host source, binary or serial output' 2; fi
  fleetrepo_receipt=$(cat "$run/jit-receipt.json")
  cleanup; trap - EXIT
  [[ ! -e $run ]] || fail cleanup_failed 'Private guest run directory remains' 2
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","launched":true,"scope":"jit-login-slice","product_commit":"%s","binary_sha256":"%s","image_sha256":"%s","tool_image_id":"%s","fleetrepo":%s,"duration_seconds":%d,"guest":%s},"warnings":[]}\n' "$product_commit" "$binary_sha" "$image_sha" "$image_id" "$fleetrepo_receipt" "$duration" "$proof"; else echo "JIT login slice passed (${duration}s)"; fi
  exit 0
fi
if [[ $scenario == jit-provision ]]; then
  if [[ $vm_status -ne 0 || -z $proof ]] || ! python3 - "$proof" <<'JIT_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1])
 if not isinstance(p,dict) or p.get('status')!='passed' or p.get('scope')!='jit-provision' or p.get('pid1')!='systemd': sys.exit(1)
 if p.get('uids')!=[21032,21033,21003] or p.get('binary_path')!='/opt/native-agent-host/current/native-agent-host': sys.exit(1)
 if not all(p.get(k) is True for k in ('pool_vacant_before_seed','new_accounts','committed_bindings','rerun_idempotent','wrong_peer_denied','wrong_uid_denied','pending_denied','boot_acl_denied','prepared_socket_started','cross_uid_denied')): sys.exit(1)
except (ValueError,TypeError): sys.exit(1)
JIT_CHECK
  then
    reason=$(python3 - "$proof" <<'PY'
import json,re,sys
try:
 p=json.loads(sys.argv[1]); print(re.sub('[^A-Za-z0-9 _=./;:-]',' ',str(p.get('reason','missing proof'))+' pending_phase='+str(p.get('pending_phase'))+' broker_state='+str(p.get('broker_state'))+' exchange_seconds='+str(p.get('exchange_seconds')))[:500])
except (ValueError,TypeError): print('missing proof')
PY
)
    fail boot_proof_failed "JIT guest failed closed (VM exit $vm_status, ${duration}s; check=$reason)" 2
  fi
  fleetrepo_receipt=$(cat "$run/jit-receipt.json")
  cleanup
  trap - EXIT
  [[ ! -e $run ]] || fail cleanup_failed 'Private guest run directory remains' 2
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","launched":true,"scope":"jit-provision","product_commit":"%s","binary_sha256":"%s","image_sha256":"%s","tool_image_id":"%s","fleetrepo":%s,"duration_seconds":%d,"guest":%s},"warnings":[]}\n' "$product_commit" "$binary_sha" "$image_sha" "$image_id" "$fleetrepo_receipt" "$duration" "$proof"; else echo "JIT guest passed (${duration}s)"; fi
  exit 0
fi
if [[ $scenario == broker-guest ]]; then
  if [[ $vm_status -ne 0 || -z $proof ]] || ! python3 - "$proof" <<'BROKER_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1]); assert p['status']=='passed' and p['scope']=='broker-private-guest' and p['pid1']=='systemd'
 assert p['uids']==[0,21003,21005]
 assert all(p[k] is True for k in ('wrong_uid_denied','wrong_peer_denied','pending_symlink_denied','head_symlink_denied','restart_drift_denied'))
except (ValueError,KeyError,AssertionError,TypeError): sys.exit(1)
BROKER_CHECK
  then
    # Broker seed contains no credentials; preserve the bounded serial tail so
    # a failed proof is diagnosable instead of waiting for a blind retry.
    tail -c 4096 "$run/serial.log" >&2
    reason=$(python3 - "$proof" <<'REASON'
import json, re, sys
try:
    value = json.loads(sys.argv[1]).get('reason', 'missing proof')
    print(re.sub('[^A-Za-z0-9 _-]', ' ', str(value))[:220])
except (ValueError, TypeError):
    print('missing proof')
REASON
)
    fail boot_proof_failed "Broker guest failed closed (VM exit $vm_status, ${duration}s; check=$reason)" 2
  fi
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","launched":true,"scope":"broker-private-guest","product_commit":"%s","binary_sha256":"%s","image_sha256":"%s","duration_seconds":%d,"guest":%s},"warnings":[]}\n' "$product_commit" "$binary_sha" "$image_sha" "$duration" "$proof"; else echo "Broker guest passed (${duration}s)"; fi
  exit 0
fi
if [[ $scenario == two-user-routing ]]; then
  if [[ $vm_status -ne 0 || -z $proof ]] || ! python3 - "$proof" <<'PRODUCT_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1]); assert p['status']=='passed' and p['scope']=='product-two-user-routing' and p['pid1']=='systemd'
 assert p['uids']==[21001,21002,21003] and p['socket_mode']=='0660' and p['socket_activation'] is True
 assert len(p['routes'])==2 and [r['uid'] for r in p['routes']]==[21001,21002]
 assert all(v is True for v in p['native_gh'].values()) and all(v is True for v in p['denials'].values()) and p['token_scan']['passed'] is True
except (ValueError,KeyError,AssertionError,TypeError): sys.exit(1)
PRODUCT_CHECK
  then
    reason=$(python3 - "$proof" <<'REASON'
import json,re,sys
try:
 p=json.loads(sys.argv[1]); v=p.get('reason','unknown')
 if not isinstance(v,str):v='unknown'
 if isinstance(p.get('diagnostic'),dict): v+=' diagnostic '+json.dumps(p['diagnostic'],sort_keys=True)
 for n in ('agent_a','agent_b','UNKNOWN'):
  v=v.replace('PRODUCT_VM_TOKEN_'+n+'_FIXTURE_ONLY_92764','[redacted]')
 print(re.sub('[^A-Za-z0-9 _=./;:-]',' ',v)[:2000])
except (ValueError,TypeError): print('unknown')
REASON
)
    fail boot_proof_failed "Product guest failed closed (VM exit $vm_status, ${duration}s; check=$reason)" 2
  fi
  if ! python3 - "$repo" "$run/serial.log" "$run/native-agent-host" <<'TOKEN_SCAN'
import pathlib,sys
repo=pathlib.Path(sys.argv[1]); tokens=[('PRODUCT_VM_TOKEN_'+n+'_FIXTURE_ONLY_92764').encode() for n in ('agent_a','agent_b')]
files=[pathlib.Path(sys.argv[2]),pathlib.Path(sys.argv[3]),repo/'scripts/vm-test.sh',*list((repo/'test/vm').glob('*.py'))]
for f in files:
 data=f.read_bytes()
 if any(t in data for t in tokens):sys.exit(1)
TOKEN_SCAN
  then fail token_scan_failed 'Token found in host source, binary or serial output' 2; fi
  cleanup
  trap - EXIT
  [[ ! -e $run ]] || fail cleanup_failed 'Private guest run directory remains' 2
  if podman ps -a --format '{{.Names}}' | grep -Fxq "vm-fixture-$$"; then fail cleanup_failed 'VM container remains' 2; fi
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","launched":true,"scope":"product-two-user-routing","product_commit":"%s","binary_sha256":"%s","image_sha256":"%s","tool_image_id":"%s","duration_seconds":%d,"boot_limit_seconds":600,"serial_limit_bytes":2097152,"guest":%s},"warnings":[]}\n' "$product_commit" "$binary_sha" "$image_sha" "$image_id" "$duration" "$proof"; else echo "Product two-user VM proof passed (${duration}s)"; fi
  exit 0
fi
if [[ $vm_status -ne 0 || -z $proof ]] || ! python3 - "$proof" <<'PY'
import json,sys
try:
 p=json.loads(sys.argv[1]); assert p == {'status':'passed','pid1':'systemd','uids':[21001,21002,21003],'socket_activation':True,'socket_mode':'0600','cross_user_marker_denied':True,'cross_user_route_denied':True,'scope':'synthetic-environment-only'}
except (ValueError,AssertionError): sys.exit(1)
PY
then
  tail -c 2048 "$run/serial.log" >&2
  fail boot_proof_failed "Guest did not produce expected systemd proof (VM exit $vm_status, ${duration}s); serial tail above" 2
fi
if $json; then printf '{"schema_version":1,"data":{"status":"passed","launched":true,"scope":"synthetic-environment-only","image_sha256":"%s","tool_image_id":"%s","duration_seconds":%d,"boot_limit_seconds":600,"serial_limit_bytes":2097152,"guest":%s},"warnings":[]}\n' "$image_sha" "$image_id" "$duration" "$proof"; else echo "Synthetic systemd VM proof passed (${duration}s; environment only)"; fi
