#!/usr/bin/env bash
set -euo pipefail
# Podman/QEMU subprocesses may allocate large host-side scratch files; they go
# to the disk-backed scratch root that scratch.sh describes.
source "$(dirname "$0")/scratch.sh"
TMPDIR=$(oh_scratch_root); export TMPDIR
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
[[ $# -eq 1 || ( $# -eq 2 && ${2:-} == --json ) ]] || fail invalid_arguments 'Expected self-test|systemd-self-test|two-user-routing|broker-guest|jit-provision|jit-login|jit-concurrent|jit-broker-crash|jit-reboot-diagnostic|host-boot-binding|host-runtime-admission|host-boot-storage|host-prepare|host-prepare-probe|host-shared-home [--json]' 1
[[ $scenario == host-boot-binding || $scenario == host-runtime-admission || $scenario == host-boot-storage || $scenario == host-prepare || $scenario == host-prepare-probe || $scenario == host-shared-home || $scenario == self-test || $scenario == systemd-self-test || $scenario == two-user-routing || $scenario == broker-guest || $scenario == jit-provision || $scenario == jit-login || $scenario == jit-concurrent || $scenario == jit-broker-crash || $scenario == jit-reboot-diagnostic ]] || fail invalid_scenario 'Expected self-test, systemd-self-test, two-user-routing, broker-guest, jit-provision or jit-login or jit-concurrent or jit-broker-crash or jit-reboot-diagnostic or host-boot-binding or host-runtime-admission or host-boot-storage or host-prepare or host-prepare-probe or host-shared-home' 1
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
  python3 "$repo/test/vm/test-qemu-launch.py" >/dev/null || fail invalid_fixture 'QEMU argument recipe regression failed' 2
  grep -q 'name: agent-a' "$repo/test/vm/cloud-init.yaml" && grep -q 'name: agent-b' "$repo/test/vm/cloud-init.yaml" && grep -q 'path: /home/agent-b/SYNTHETIC-IDENTITY' "$repo/test/vm/cloud-init.yaml" || fail invalid_cloud_init 'Synthetic fixture markers are missing' 1
  if $json; then printf '{"schema_version":1,"data":{"status":"fixture-valid","launched":false,"reason":"Explicit systemd-self-test required for boot proof","image_sha256":"%s"},"warnings":[]}\n' "$image_sha"; else echo 'VM fixture valid (image not launched)'; fi
  exit 0
fi
# These legacy proofs require private, digest-pinned policy blobs. Do not
# download images or start a guest when the optional source is absent.
if [[ $scenario == jit-* ]] && [[ -z ${FLEETREPO_JIT_SOURCE:-} || ! -d $FLEETREPO_JIT_SOURCE ]]; then
  reason='Private JIT policy source absent; set FLEETREPO_JIT_SOURCE to run this proof'
  if $json; then
    printf '{"schema_version":1,"data":{"status":"skipped","launched":false,"reason":"%s"},"warnings":[]}\n' "$reason"
  else
    printf 'SKIP: %s\n' "$reason"
  fi
  exit 0
fi
command -v timeout >/dev/null || fail missing_timeout 'GNU timeout is required' 2
command -v podman >/dev/null || fail missing_podman 'Rootless Podman is required for full VM run' 2
[[ $(podman info --format '{{.Host.Security.Rootless}}' 2>/dev/null) == true ]] || fail podman_unavailable 'Rootless Podman is unavailable; check storage and user namespace' 2
# Build is disposable, pinned at the base manifest. No host package installation.
tag=localhost/open-habitat-vm-tools:prereq
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
if ! podman_run cloud-init schema --config-file /fixture/cloud-init.yaml >/dev/null 2>&1 || ! podman_run python3 -c 'import yaml; c=yaml.safe_load(open("/fixture/cloud-init.yaml")); assert isinstance(c,dict) and c.get("users") and c.get("write_files") and c.get("runcmd"); assert [(u["name"],u["uid"]) for u in c["users"] if isinstance(u,dict)] == [("agent-a",21001),("agent-b",21002),("open-habitat-gateway",21003)]; assert {f["path"] for f in c["write_files"]} >= {"/home/agent-a/SYNTHETIC-IDENTITY","/home/agent-b/SYNTHETIC-IDENTITY","/usr/local/sbin/fixture-proof"}' 2>/dev/null; then
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
binary_sha= product_commit= archive_sha= embedded_commit=
if [[ $scenario == host-boot-binding || $scenario == host-runtime-admission || $scenario == host-boot-storage || $scenario == host-prepare || $scenario == host-prepare-probe || $scenario == host-shared-home || $scenario == two-user-routing || $scenario == broker-guest || $scenario == jit-provision || $scenario == jit-login || $scenario == jit-concurrent || $scenario == jit-broker-crash || $scenario == jit-reboot-diagnostic ]]; then
  command -v go >/dev/null || fail missing_go 'Go is required to build product fixture' 2
  command -v openssl >/dev/null || fail missing_openssl 'OpenSSL is required for fixture TLS' 2
  product_commit=$(git -C "$repo" rev-parse HEAD)
  if [[ $scenario == host-boot-binding || $scenario == host-runtime-admission || $scenario == host-boot-storage || $scenario == host-prepare || $scenario == host-shared-home ]]; then
    (cd "$repo" && CGO_ENABLED=0 go build -trimpath -o "$run/open-habitat" ./cmd/open-habitat) || fail product_build_failed 'Could not build host operator' 2
  elif [[ $scenario == host-prepare-probe ]]; then
    (cd "$repo" && CGO_ENABLED=0 go test -c -trimpath -o "$run/open-habitat" ./internal/host) || fail product_build_failed 'Could not build host probe test binary' 2
  elif [[ $scenario == jit-concurrent ]]; then
    [[ -z $(git -C "$repo" status --porcelain) ]] || fail dirty_tree 'Exact release archive requires a clean committed tree' 1
    (cd "$repo" && npm run build --prefix web >"$run/web-build.log" 2>&1) || fail product_build_failed 'Could not build production web assets' 2
    [[ -f $repo/web/dist/index.html && -z $(git -C "$repo" status --porcelain) ]] || fail dirty_tree 'Production web build changed committed source' 1
    mkdir -p "$run/release"
    archive=$("$repo/scripts/package-release.sh" --version 0.0.0-test --target linux-amd64 --web-dir "$repo/web/dist" --output "$run/release") || fail product_build_failed 'Could not package release' 2
    "$repo/scripts/verify-release.sh" --archive "$archive" --json > "$run/verify.json" || fail invalid_release 'Packaged archive failed release verification' 2
    archive_sha=$(sha256sum "$archive" | cut -d' ' -f1)
    # verify-release validates entry types, inventory and checksums before extraction.
    tar -xzf "$archive" -C "$run/release" || fail invalid_release 'Verified release extraction failed' 2
    release_root="$run/release/open-habitat-0.0.0-test-linux-amd64"
    cp "$release_root/bin/open-habitat" "$run/open-habitat"
    embedded_commit=$("$run/open-habitat" --json version | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["commit"])') || fail invalid_release 'Embedded commit unavailable' 2
    [[ $embedded_commit == "$product_commit" ]] || fail invalid_release 'Embedded release commit differs from committed tree' 2
  else
    overlay=()
    if [[ $scenario == jit-broker-crash ]]; then
      python3 "$repo/test/vm/jit-crash-overlay.py" "$repo" "$run" || fail product_build_failed 'Could not prepare disposable guest build overlay' 2
      overlay=(-overlay "$run/guest-overlay.json")
    fi
    (cd "$repo" && GOFLAGS= CGO_ENABLED=0 go build -trimpath "${overlay[@]}" -o "$run/open-habitat" ./cmd/open-habitat) || fail product_build_failed 'Could not build product binary' 2
    if [[ $scenario == jit-broker-crash ]]; then
      # A release compiled from committed source cannot include the overlay,
      # even if a caller sets the formerly dangerous guest build tag.
      (cd "$repo" && GOFLAGS=-tags=oh_guest_fault CGO_ENABLED=0 go build -trimpath -o "$run/release-comparison" ./cmd/open-habitat) || fail product_build_failed 'Could not build release-comparison binary' 2
      ! grep -aqE 'oh-guest-broker-crash|OH_GUEST_PENDING_REFUSED' "$run/release-comparison" || fail product_build_failed 'Guest fault or diagnostic leaked into ordinary build' 2
      grep -aq 'oh-guest-broker-crash' "$run/open-habitat" && grep -aq 'OH_GUEST_PENDING_REFUSED' "$run/open-habitat" || fail product_build_failed 'Guest fixture binary lacks crash hook or pending diagnostic' 2
    fi
  fi
  binary_sha=$(sha256sum "$run/open-habitat" | cut -d' ' -f1)
  if [[ $scenario == jit-provision || $scenario == jit-login || $scenario == jit-concurrent || $scenario == jit-broker-crash || $scenario == jit-reboot-diagnostic ]]; then
    # Read only: exact landed Fleetrepo checkout and reviewed policy hashes are
    # checked by the renderer before any private bytes reach the disposable ISO.
    jit_args=()
    [[ $scenario == jit-login ]] && jit_args=(login)
    [[ $scenario == jit-concurrent ]] && jit_args=(concurrent)
    [[ $scenario == jit-broker-crash ]] && jit_args=(broker-crash)
    [[ $scenario == jit-reboot-diagnostic ]] && jit_args=(reboot)
    PRODUCT_RELEASE_ROOT=${release_root:-} FLEETREPO_JIT_SOURCE=$FLEETREPO_JIT_SOURCE python3 "$repo/test/vm/jit-fixture.py" "$run" "$run/open-habitat" "${jit_args[@]}" >"$run/fixture.log" 2>&1 || fail invalid_policy_input 'Pinned Fleetrepo commit or reviewed JIT gate blob unavailable or invalid' 1
    seed_file=/run-data/jit-cloud-init.yaml
  elif [[ $scenario == host-boot-binding ]]; then
    python3 "$repo/test/vm/host-boot-binding-fixture.py" "$run" "$repo" || fail invalid_product_fixture 'Could not render binding/session guest' 2
    seed_file=/run-data/host-boot-binding-cloud-init.yaml
  elif [[ $scenario == host-runtime-admission ]]; then
    python3 "$repo/test/vm/host-runtime-admission-fixture.py" "$run" "$repo" || fail invalid_product_fixture 'Could not render runtime admission guest' 2
    seed_file=/run-data/host-runtime-admission-cloud-init.yaml
  elif [[ $scenario == host-boot-storage ]]; then
    python3 "$repo/test/vm/host-boot-storage-fixture.py" "$run" "$repo" || fail invalid_product_fixture 'Could not render storage boot guest' 2
    seed_file=/run-data/host-boot-storage-cloud-init.yaml
  elif [[ $scenario == host-prepare ]]; then
    python3 "$repo/test/vm/host-prepare-fixture.py" "$run" "$repo" || fail invalid_product_fixture 'Could not render prepare guest' 2
    seed_file=/run-data/host-prepare-cloud-init.yaml
  elif [[ $scenario == host-shared-home ]]; then
    python3 "$repo/test/vm/host-shared-home-fixture.py" "$run" "$repo" || fail invalid_product_fixture 'Could not render single-filesystem guest' 2
    seed_file=/run-data/host-shared-home-cloud-init.yaml
  elif [[ $scenario == host-prepare-probe ]]; then
    python3 "$repo/test/vm/host-prepare-probe-fixture.py" "$run" || fail invalid_product_fixture 'Could not render probe guest' 2
    seed_file=/run-data/host-prepare-probe-cloud-init.yaml
  elif [[ $scenario == broker-guest ]]; then
    python3 "$repo/test/vm/broker-fixture.py" "$run" "$run/open-habitat" || fail invalid_product_fixture 'Could not render broker seed' 2
    seed_file=/run-data/broker-cloud-init.yaml
  else
    python3 "$repo/test/vm/product-fixture.py" "$run" "$run/open-habitat" || fail invalid_product_fixture 'Could not render private product seed' 2
    seed_file=/run-data/product-cloud-init.yaml
  fi
  if [[ $scenario == host-boot-binding || $scenario == host-runtime-admission || $scenario == host-boot-storage || $scenario == host-prepare || $scenario == host-prepare-probe || $scenario == host-shared-home || $scenario == two-user-routing || $scenario == jit-provision || $scenario == jit-login || $scenario == jit-concurrent || $scenario == jit-broker-crash || $scenario == jit-reboot-diagnostic ]]; then
    # The pinned noble cloud image lacks the ACL utilities required by the
    # broker's existing-binding verifier. Carry guest-local tools from the
    # disposable pinned image; never install a host package or relax ACLs.
    if ! podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --mount "type=bind,src=$run,dst=/run-data" "$image_id" sh -c 'cp /usr/bin/setfacl /usr/bin/getfacl /lib/x86_64-linux-gnu/libacl.so.1 /run-data/'; then fail product_iso_failed 'Could not stage guest ACL utilities' 2; fi
    for entry in 'setfacl 8c6e90b674671cd3b9d0e61d9177cbd022e1eb9380a2241a189c3d9a51d15922' 'getfacl 91e889370c104d40a4f812c1a4527cfae01a6ab6b6ffa1f8f8a52cdeff7ef96f' 'libacl.so.1 1f5247285409ec89990e9fe384d78dfb2ae6ec8e210a2657073babc8d6b7e54f'; do
      read -r filename digest <<< "$entry"
      echo "$digest  $run/$filename" | sha256sum -c --status || fail product_iso_failed 'Pinned guest ACL utility digest mismatch' 2
    done
    iso_files=(/open-habitat=/run-data/open-habitat /setfacl=/run-data/setfacl /getfacl=/run-data/getfacl /libacl.so.1=/run-data/libacl.so.1)
    if [[ $scenario == two-user-routing || $scenario == host-boot-binding || $scenario == host-runtime-admission || $scenario == host-boot-storage || $scenario == host-prepare || $scenario == host-prepare-probe ]]; then
      podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --mount "type=bind,src=$run,dst=/run-data" "$image_id" sh -ec 'cp /opt/fixture-quota-modules/quota_tree.ko.zst /opt/fixture-quota-modules/quota_v2.ko.zst /run-data/' || fail product_iso_failed 'Could not stage pinned guest quota modules' 2
      for entry in 'quota_tree.ko.zst cfd540f904666ed7bb0d8138761ded1510b0937432c22c7a3d287047eef606e7' 'quota_v2.ko.zst e1d1218bee7062f7b904c3c5ba138540b18c3f26836c8e11620fc1f24c8ab383'; do
        read -r filename digest <<< "$entry"
        echo "$digest  $run/$filename" | sha256sum -c --status || fail product_iso_failed 'Pinned guest quota module digest mismatch' 2
      done
      iso_files+=(/quota_tree.ko.zst=/run-data/quota_tree.ko.zst /quota_v2.ko.zst=/run-data/quota_v2.ko.zst)
    fi
  else
    iso_files=(/open-habitat=/run-data/open-habitat)
  fi
  if ! timeout -k 5s 60s podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --tmpfs /tmp:rw,size=64m --mount "type=bind,src=$run,dst=/run-data" "$image_id" genisoimage -quiet -R -graft-points -V PRODUCT -o /run-data/product.iso "${iso_files[@]}"; then fail product_iso_failed 'Could not seal read-only product ISO' 2; fi
  if ! podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --tmpfs /tmp:rw,size=32m --mount "type=bind,src=$run,dst=/run-data,ro=true" "$image_id" cloud-init schema --config-file "$seed_file" >/dev/null 2>&1; then fail invalid_product_fixture 'Product cloud-init schema invalid' 1; fi
fi
# Seed and writable overlay are private to this invocation.
if ! timeout -k 5s 60s podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --tmpfs /tmp:rw,size=128m --mount "type=bind,src=$repo/test/vm,dst=/fixture,ro=true" --mount "type=bind,src=$run,dst=/run-data" "$image_id" cloud-localds /run-data/seed.img "$seed_file" /run-data/meta-data; then fail seed_failed 'cloud-localds failed' 2; fi
cp "$repo/test/vm/qemu-launch.sh" "$run/qemu-launch.sh"
start=$(date +%s)
# All VM devices are emulated; no KVM, USB or guest/host shared filesystem.
# QEMU user-mode DHCP is required by cloud-init, but the container has --network=none
# and restrict=on prevents guest forwarding beyond the emulated subnet.
# Serial is capped at 2 MiB; bounded process lifetime and overlay allocation.
set +e
vm_limit=600
[[ $scenario == host-boot-storage || $scenario == host-shared-home ]] && vm_limit=900
[[ $scenario == host-boot-binding ]] && vm_limit=1200
[[ $scenario == jit-reboot-diagnostic ]] && vm_limit=430
timeout -k 10s "${vm_limit}s" podman run --rm --name "vm-fixture-$$" --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --pids-limit=256 --memory=4g --cpus=2 --mount "type=bind,src=$cache,dst=/cache,ro=true" --mount "type=bind,src=$run,dst=/run-data" "$image_id" sh /run-data/qemu-launch.sh "$scenario" /run-data 2>&1 | python3 "$repo/scripts/vm-serial-drain.py" "$run/serial.log" "$run/serial-receipt.json"
vm_status=${PIPESTATUS[0]} drain_status=${PIPESTATUS[1]}
set -e
duration=$(($(date +%s)-start))
if [[ $scenario == jit-reboot-diagnostic && -f $run/serial-receipt.json ]]; then
  mkdir -p "$repo/history/jit-reboot-diagnostics"
  diagnostic_log="$repo/history/jit-reboot-diagnostics/$(date -u +%Y%m%dT%H%M%SZ)-$$.log"
  python3 - "$run/serial-receipt.json" "$diagnostic_log" <<'DIAG'
import json,os,sys
r=json.load(open(sys.argv[1])); fd=os.open(sys.argv[2],os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:
 json.dump({k:r[k] for k in ('bytes','capped','token_leaked','markers')},f);f.write('\n')
DIAG
fi
# A missing receipt means the drainer died or could not flush. Never evaluate
# a prefix proof in that case, nor when bytes beyond the cap went unretained.
if [[ $drain_status -ne 0 || ! -f $run/serial-receipt.json ]] || ! python3 - "$run/serial-receipt.json" <<'SERIAL_CHECK'
import json,sys
try:
 r=json.load(open(sys.argv[1]))
 if r['capped'] or r['token_leaked'] or r['bytes']<0: sys.exit(1)
except (ValueError,KeyError,TypeError,OSError): sys.exit(1)
SERIAL_CHECK
then
  markers=$(python3 - "$run/serial-receipt.json" <<'MARKERS'
import json,sys
try:
 r=json.load(open(sys.argv[1]));print(','.join(r['markers']))
except (ValueError,KeyError,OSError): print('unavailable')
MARKERS
)
  fail serial_incomplete "Guest serial invalid (VM exit $vm_status, drainer exit $drain_status, ${duration}s; allowlisted_markers=${markers:-none}); capped, leaked or unscanned bytes cannot prove success" 2
fi
# Require clean guest poweroff and an exact proof; a timeout is always failure.
proof=$(tr -d '\r' < "$run/serial.log" | grep -a 'VM_PROOF=' | tail -n 1 | sed 's/.*VM_PROOF=//' || :)
if [[ $scenario == host-boot-binding ]]; then
  cp "$run/serial.log" "$cache/last-host-boot-binding.log"
  chmod 0600 "$cache/last-host-boot-binding.log"
  if [[ $vm_status -ne 0 ]] || ! python3 - "$proof" <<'BOOT_BINDING_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1])
 if p != {'status':'passed','scope':'host-boot-binding-session','cold_boots':5,'both_listeners':True,'broker_restore':True,'named_acl':True,'pending_refused':True,'revoked_refused':True,'foreign_refused':True,'proc_isolation':True,'logind_polkit':True,'linger_user_manager':True,'pid1':'systemd'}:sys.exit(1)
except Exception:sys.exit(1)
BOOT_BINDING_CHECK
  then fail binding_proof_failed "Binding/session guest failed (VM exit $vm_status; serial=$cache/last-host-boot-binding.log)" 2; fi
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","scope":"host-boot-binding-session","product_commit":"%s","binary_sha256":"%s","duration_seconds":%d,"guest":%s},"warnings":[]}\n' "$product_commit" "$binary_sha" "$duration" "$proof"; else echo 'Production binding and session boot proof passed'; fi
  exit 0
fi
if [[ $scenario == host-shared-home ]]; then
  cp "$run/serial.log" "$cache/last-host-shared-home.log"
  chmod 0600 "$cache/last-host-shared-home.log"
  if [[ $vm_status -ne 0 ]] || ! python3 - "$proof" <<'SHARED_HOME_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1])
 if p != {'status':'passed','scope':'host-shared-home','home_on_root':True,'quota_site_refused':True,'prepared_without_probe':True,'policy_without_quota':True,'no_change':True,'first_login_without_limit':True,'limits_not_in_use':True,'cold_boot_gate':True,'broker_restore':True,'named_acl':True,'wrong_uuid_refused':True,'pid1':'systemd'}:sys.exit(1)
except Exception:sys.exit(1)
SHARED_HOME_CHECK
  then fail shared_home_proof_failed "Single-filesystem guest failed (VM exit $vm_status; serial=$cache/last-host-shared-home.log)" 2; fi
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","scope":"host-shared-home","product_commit":"%s","binary_sha256":"%s","duration_seconds":%d,"guest":%s},"warnings":[]}\n' "$product_commit" "$binary_sha" "$duration" "$proof"; else echo 'Single-filesystem installation without user quotas passed (no apply, runtime or browser)'; fi
  exit 0
fi
if [[ $scenario == host-runtime-admission ]]; then
  cp "$run/serial.log" "$cache/last-host-runtime-admission.log"
  chmod 0600 "$cache/last-host-runtime-admission.log"
  if [[ $vm_status -ne 0 ]] || ! python3 - "$proof" <<'RUNTIME_ADMISSION_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1])
 if p != {'status':'passed','scope':'host-runtime-admission','login_shell':True,'distinct_uids':True,'gateway_uid_only':True,'operator_protected':True,'withdraw_keeps_account':True,'restart_closed':True,'restore_rebuilds_runtime':True,'restore_same_uid':True,'never_bound_clean':True,'switch_off_refused':True,'pid1':'systemd'}:sys.exit(1)
except Exception:sys.exit(1)
RUNTIME_ADMISSION_CHECK
  then fail runtime_admission_proof_failed "Runtime admission guest failed (VM exit $vm_status; serial=$cache/last-host-runtime-admission.log)" 2; fi
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","scope":"host-runtime-admission","product_commit":"%s","binary_sha256":"%s","duration_seconds":%d,"guest":%s},"warnings":[]}\n' "$product_commit" "$binary_sha" "$duration" "$proof"; else echo 'Runtime admission two-UID broker proof passed'; fi
  exit 0
fi
if [[ $scenario == host-boot-storage ]]; then
  cp "$run/serial.log" "$cache/last-host-boot-storage.log"
  chmod 0600 "$cache/last-host-boot-storage.log"
  if [[ $vm_status -ne 0 ]] || ! python3 - "$proof" <<'BOOT_STORAGE_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1])
 if p != {'status':'passed','scope':'host-boot-storage-only','cold_boots':4,'good_boot':True,'quota_off_refused':True,'missing_home_refused':True,'wrong_uuid_refused':True,'both_listeners':True,'broker_ordering':True,'pid1':'systemd'}:sys.exit(1)
except (ValueError,TypeError):sys.exit(1)
BOOT_STORAGE_CHECK
  then fail boot_proof_failed "Storage boot guest failed (VM exit $vm_status; serial=$cache/last-host-boot-storage.log)" 2; fi
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","scope":"host-boot-storage-only","product_commit":"%s","binary_sha256":"%s","duration_seconds":%d,"guest":%s},"warnings":[]}\n' "$product_commit" "$binary_sha" "$duration" "$proof"; else echo 'Storage boot ordering passed (broker body and binding ACL restoration not tested)'; fi
  exit 0
fi
if [[ $scenario == host-prepare ]]; then
  cp "$run/serial.log" "$cache/last-host-prepare.log"
  chmod 0600 "$cache/last-host-prepare.log"
  if [[ $vm_status -ne 0 ]] || ! python3 - "$proof" <<'PREPARE_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1])
 if p != {'status':'passed','scope':'host-prepare-no-boot','edquot':True,'cleanup':True,'no_change':True,'missing_mount_refused':True,'unenforced_refused':True,'stale_refused':True,'policies':True,'pid1':'systemd'}:sys.exit(1)
except (ValueError,TypeError):sys.exit(1)
PREPARE_CHECK
  then fail boot_proof_failed "Prepare guest failed (VM exit $vm_status; serial=$cache/last-host-prepare.log)" 2; fi
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","scope":"host-prepare-no-boot","product_commit":"%s","binary_sha256":"%s","duration_seconds":%d,"guest":%s},"warnings":[]}\n' "$product_commit" "$binary_sha" "$duration" "$proof"; else echo 'Host preparation passed (no boot acceptance)'; fi
  exit 0
fi
if [[ $scenario == host-prepare-probe ]]; then
  cp "$run/serial.log" "$cache/last-host-prepare-probe.log"
  chmod 0600 "$cache/last-host-prepare-probe.log"
  if [[ $vm_status -ne 0 ]] || ! python3 - "$proof" <<'PROBE_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1])
 if p != {'status':'passed','scope':'host-prepare-probe-only','edquot':True,'cleanup':True,'fenced':True,'pid1':'systemd'}:sys.exit(1)
except (ValueError,TypeError):sys.exit(1)
PROBE_CHECK
  then fail boot_proof_failed "Quota probe guest failed (VM exit $vm_status; synthetic serial=$cache/last-host-prepare-probe.log)" 2; fi
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","scope":"host-prepare-probe-only","product_commit":"%s","binary_sha256":"%s","duration_seconds":%d,"guest":%s},"warnings":[]}\n' "$product_commit" "$binary_sha" "$duration" "$proof"; else echo 'Native quota probe passed (not host prepare acceptance)'; fi
  exit 0
fi
if [[ $scenario == jit-reboot-diagnostic ]]; then
  origin=$(tr -d '\r' < "$run/serial.log" | grep -aE '^VM_REBOOT_ORIGIN=[0-9a-f]{64}$' | sed 's/^VM_REBOOT_ORIGIN=//' || :)
  phase_count=$(tr -d '\r' < "$run/serial.log" | grep -ac '^VM_PHASE=real_reboot_requested$' || :)
  proof_count=$(grep -ac 'VM_PROOF=' "$run/serial.log" || :)
  if [[ $(printf '%s\n' "$origin" | grep -Ec '^[0-9a-f]{64}$' || :) != 1 || $phase_count != 1 || $proof_count != 1 ]]; then
    fail boot_proof_failed "JIT reboot diagnostic incomplete (VM exit $vm_status, ${duration}s; origin_count=$(printf '%s\n' "$origin" | grep -Ec '^[0-9a-f]{64}$' || :), phase_count=$phase_count, proof_count=$proof_count; private=$diagnostic_log)" 2
  fi
  # A proof printed before shutdown scheduling is not a completed unit. Accept
  # only one clean ExecStopPost receipt, strictly after the unique proof.
  if ! python3 - "$run/serial.log" <<'REBOOT_UNIT_CHECK'
import pathlib,sys
lines=pathlib.Path(sys.argv[1]).read_bytes().replace(b'\r',b'').splitlines()
proof=[i for i,line in enumerate(lines) if b'VM_PROOF=' in line]
exit_lines=[(i,line) for i,line in enumerate(lines) if line.startswith(b'VM_REBOOT_UNIT_EXIT=')]
if len(proof)!=1 or len(exit_lines)!=1: sys.exit(1)
if exit_lines[0][1]!=b'VM_REBOOT_UNIT_EXIT=success:exited:0' or exit_lines[0][0]<=proof[0]: sys.exit(1)
REBOOT_UNIT_CHECK
  then fail boot_proof_failed "JIT reboot unit completion missing or failed (VM exit $vm_status, ${duration}s; private=$diagnostic_log)" 2; fi
  if [[ $vm_status -ne 0 || -z $proof ]] || ! python3 - "$proof" "$origin" <<'REBOOT_CHECK'
import json,sys,re
try:
 p=json.loads(sys.argv[1])
 if type(p) is not dict or p.get('status')!='passed' or p.get('scope')!='jit-reboot-diagnostic' or p.get('pid1')!='systemd': sys.exit(1)
 if p.get('uids')!=[21032,21033,21003] or p.get('epoch')!=4 or type(p.get('generation')) is not int or p['generation']<3: sys.exit(1)
 ids=p.get('boot_ids')
 if type(ids) is not list or len(ids)!=2 or any(type(x) is not str or re.fullmatch('[0-9a-f]{64}',x) is None for x in ids) or ids[0]==ids[1] or ids[0]!=sys.argv[2]:sys.exit(1)
 for key in ('persistent_bindings','persistent_credentials','sockets_disabled_before_prepare','preflight_ready','boot_acl_unprepared','no_pending'):
  if p.get(key) is not True: sys.exit(1)
except (ValueError,TypeError,KeyError):sys.exit(1)
REBOOT_CHECK
  then
    reason=$(python3 - "$proof" <<'REBOOT_REASON'
import json,re,sys
try: print(re.sub('[^A-Za-z0-9 _./:-]',' ',str(json.loads(sys.argv[1]).get('reason','missing/invalid proof')))[:240])
except (ValueError,TypeError):print('missing proof')
REBOOT_REASON
)
    fail boot_proof_failed "JIT reboot diagnostic failed closed (VM exit $vm_status, ${duration}s; check=$reason; private=$diagnostic_log)" 2
  fi
  # No synthetic credential may appear in serial output or binary.
  if ! python3 - "$run/serial.log" "$run/open-habitat" <<'REBOOT_SCAN'
import pathlib,sys
for name in ('guestone','guesttwo','UNKNOWN'):
 token=('PRODUCT_VM_TOKEN_'+name+'_FIXTURE_ONLY_92764').encode()
 if any(token in pathlib.Path(p).read_bytes() for p in sys.argv[1:]):sys.exit(1)
REBOOT_SCAN
  then fail token_scan_failed 'Synthetic token found in reboot output' 2; fi
  fleetrepo_receipt=$(python3 - "$run/jit-receipt.json" <<'RECEIPT_CHECK'
import json,sys
try:
 p=json.load(open(sys.argv[1]))
 if type(p) is not dict or p.get('commit')!='e044c03133074db3bb37d64e1e03c0bf4b9ade7d' or type(p.get('sha256')) is not dict:sys.exit(1)
 print(json.dumps(p,separators=(',',':')))
except (OSError,ValueError,TypeError):sys.exit(1)
RECEIPT_CHECK
) || fail invalid_policy_input 'Pinned Fleetrepo receipt is missing or invalid' 2
  cleanup; trap - EXIT
  [[ ! -e $run ]] || fail cleanup_failed 'Private guest run directory remains' 2
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","launched":true,"scope":"jit-reboot-diagnostic","product_commit":"%s","binary_sha256":"%s","image_sha256":"%s","tool_image_id":"%s","fleetrepo":%s,"duration_seconds":%d,"guest":%s},"warnings":[]}\n' "$product_commit" "$binary_sha" "$image_sha" "$image_id" "$fleetrepo_receipt" "$duration" "$proof"; else echo "JIT reboot passed (${duration}s)"; fi
  exit 0
fi
if [[ $scenario == jit-broker-crash ]]; then
  if [[ $vm_status -ne 0 || -z $proof ]] || ! python3 - "$proof" <<'CRASH_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1])
 if p.get('status')!='passed' or p.get('scope')!='jit-broker-crash' or p.get('pid1')!='systemd' or p.get('phase')!='account':sys.exit(1)
 if not all(p.get(k) is True for k in ('real_sigkill','account_exists','pending_retained','restart_refused','no_route','no_session','no_executor_after_crash','other_user_native_unaffected')):sys.exit(1)
 if p.get('callback_status') not in (403,503) or p.get('session_status')!=401 or p.get('other_session_status')!=401 or p.get('other_snapshot_status')!=401:sys.exit(1)
except (ValueError,TypeError,AttributeError):sys.exit(1)
CRASH_CHECK
  then
    reason=$(python3 - "$proof" <<'CRASH_REASON'
import json,re,sys
try: print(re.sub('[^A-Za-z0-9 _./:-]',' ',str(json.loads(sys.argv[1]).get('reason','receipt rejected')))[:220])
except (ValueError,TypeError):print('missing proof')
CRASH_REASON
)
    fail boot_proof_failed "JIT broker crash guest refused proof (VM exit $vm_status, ${duration}s; check=$reason)" 2
  fi
  if ! python3 - "$run/serial.log" "$run/open-habitat" <<'CRASH_SCAN'
import pathlib,sys
for name in ('guestone','guesttwo','guestthree','UNKNOWN'):
 token=('PRODUCT_VM_TOKEN_'+name+'_FIXTURE_ONLY_92764').encode()
 if any(token in pathlib.Path(p).read_bytes() for p in sys.argv[1:]):sys.exit(1)
CRASH_SCAN
  then fail token_scan_failed 'Synthetic token found in crash output or binary' 2; fi
  fleetrepo_receipt=$(cat "$run/jit-receipt.json")
  cleanup; trap - EXIT
  [[ ! -e $run ]] || fail cleanup_failed 'Private guest run directory remains' 2
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","launched":true,"scope":"jit-broker-crash","product_commit":"%s","binary_sha256":"%s","image_sha256":"%s","tool_image_id":"%s","fleetrepo":%s,"duration_seconds":%d,"guest":%s},"warnings":[]}\n' "$product_commit" "$binary_sha" "$image_sha" "$image_id" "$fleetrepo_receipt" "$duration" "$proof"; else echo "JIT broker crash guest passed (${duration}s)"; fi
  exit 0
fi
if [[ $scenario == jit-concurrent ]]; then
  if [[ $vm_status -ne 0 || -z $proof ]] || ! python3 - "$proof" <<'CONCURRENT_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1])
 if p.get('status')!='passed' or p.get('scope')!='jit-concurrent' or p.get('pid1')!='systemd':sys.exit(1)
 if p.get('uids')!=[21032,21033,21034,21003]:sys.exit(1)
 if not all(p.get(k) is True for k in ('unique_bindings','cross_uid_denied','same_id_idempotent','provider_rendezvous','binary_digest_verified','nss_drift_denied','head_corrupt_denied','head_generation_mismatch_denied','epoch_rollback_denied')):sys.exit(1)
 rounds=p.get('rounds')
 if not isinstance(rounds,list) or len(rounds)!=2 or [r.get('ids') for r in rounds]!=[['a','a'],['b','c']]:sys.exit(1)
 if any(r.get('statuses')!=[303,303] for r in rounds):sys.exit(1)
except (ValueError,TypeError,AttributeError,KeyError):sys.exit(1)
CONCURRENT_CHECK
  then
    reason=$(python3 - "$proof" <<'CONCURRENT_REASON'
import json,re,sys
try:
 p=json.loads(sys.argv[1]);d=p.get('diagnostic_round',{})
 print(re.sub('[^A-Za-z0-9 _./:;,=-]',' ',str(p.get('reason','receipt rejected'))[:150]+' ids='+str(d.get('ids','?'))+' statuses='+str(d.get('statuses','?'))+' errors='+str(d.get('errors','?'))+' credentials='+str(d.get('credentials_present','?'))+' bindings='+str(d.get('binding_count','?'))))
except (ValueError,TypeError):print('missing proof')
CONCURRENT_REASON
)
    # Private diagnostic only; never echo the raw serial (it may contain secrets).
    debug_log=$(mktemp "$cache/jit-concurrent-debug.XXXXXXXX")
    chmod 600 "$debug_log"; cp "$run/serial.log" "$debug_log"
    fail boot_proof_failed "JIT concurrent guest failed closed (VM exit $vm_status, ${duration}s; check=$reason; private=$debug_log)" 2
  fi
  if ! python3 - "$run/serial.log" "$run/open-habitat" <<'CONCURRENT_TOKEN_SCAN'
import pathlib,sys
for name in ('guestone','guesttwo','guestthree','UNKNOWN'):
 token=('PRODUCT_VM_TOKEN_'+name+'_FIXTURE_ONLY_92764').encode()
 if any(token in pathlib.Path(p).read_bytes() for p in sys.argv[1:]):sys.exit(1)
CONCURRENT_TOKEN_SCAN
  then fail token_scan_failed 'Synthetic token found in concurrent output or binary' 2; fi
  fleetrepo_receipt=$(cat "$run/jit-receipt.json")
  cleanup; trap - EXIT
  [[ ! -e $run ]] || fail cleanup_failed 'Private guest run directory remains' 2
  if $json; then printf '{"schema_version":1,"data":{"status":"passed","scope":"jit-concurrent","product_commit":"%s","embedded_commit":"%s","archive_sha256":"%s","binary_sha256":"%s","image_sha256":"%s","tool_image_id":"%s","fleetrepo":%s,"duration_seconds":%d,"guest":%s},"warnings":[]}\n' "$product_commit" "$embedded_commit" "$archive_sha" "$binary_sha" "$image_sha" "$image_id" "$fleetrepo_receipt" "$duration" "$proof"; else echo "JIT concurrent guest passed (${duration}s)"; fi
  exit 0
fi
if [[ $scenario == jit-login ]]; then
  if [[ $vm_status -ne 0 || -z $proof ]] || ! python3 - "$proof" <<'LOGIN_CHECK'
import json,sys
try:
 p=json.loads(sys.argv[1])
 if not isinstance(p,dict) or p.get('status')!='passed' or p.get('scope')!='jit-login-slice' or p.get('pid1')!='systemd': sys.exit(1)
 if p.get('uids')!=[21032,21033,21003] or [r.get('uid') for r in p.get('routes',[])]!=[21032,21033]: sys.exit(1)
 if not all(p.get(k) is True for k in ('pool_vacant_before_login','new_accounts','committed_bindings','root_ledger','pinned_policy_gate','socket_activation')): sys.exit(1)
 keys={'native_gh':{'stdin_only','exact_argv','protected_file','credential_isolated'},
       'denials':{'cross_user_broker','unknown_identity','unknown_session','state_replay','root_peer','cross_user_home','cross_user_socket','gateway_home','gateway_credential','forged_headers','symlink_excluded'}}
 for key, expected in keys.items():
  values=p.get(key)
  if not isinstance(values,dict) or set(values)!=expected or not all(v is True for v in values.values()): sys.exit(1)
 if not isinstance(p.get('token_scan'),dict) or p['token_scan'].get('passed') is not True: sys.exit(1)
 rev=p.get('revocation',{}); rename=p.get('rename',{})
 if rev.get('existing_denied_statuses') != [401]*4 or rev.get('new_denied_status') != 403: sys.exit(1)
 if not all(rev.get(k) is True for k in ('atomic_fsynced','other_uid_reauthorized','ledger_account_credential_preserved')): sys.exit(1)
 if rename != {'same_uid':True,'no_second_gh_login':True}: sys.exit(1)
 failures=p.get('gh_failures',{})
 if set(failures)!= {'fail-login','wrong-id'} or any(v != {'callback_status':503,'session_status':401,'replay_status':403,'credential_absent':True} for v in failures.values()): sys.exit(1)
 if p.get('lost_ack') != {'callback_status':503,'session_status':401,'snapshot_status':401,'replay_status':403,'one_daemon_gh_call_observed':True,'daemon_killed_before_ack':True,'credential_preserved':True}: sys.exit(1)
 if p.get('post_install_lost_ack') != {'callback_status':503,'session_status':401,'snapshot_status':401,'replay_status':403,'one_shot_child_calls':2,'daemon_pid_changed':True,'protected_credential_retained':True,'other_uid_reauthenticated':True}: sys.exit(1)
 if p.get('revoked_sibling_stopped_before_c') is not True: sys.exit(1)
 units=p.get('post_install_units',{})
 if units.get('start_ok') is not True or units.get('after_service',{}).get('ActiveState')!='active' or units.get('after_socket',{}).get('ActiveState')!='active': sys.exit(1)
 if not isinstance(units.get('after_service',{}).get('MainPID'),int) or units['after_service']['MainPID']<=1: sys.exit(1)
except (ValueError,TypeError,AttributeError): sys.exit(1)
LOGIN_CHECK
  then
    reason=$(python3 - "$proof" <<'REASON'
import json,re,sys
try:
 p=json.loads(sys.argv[1]); diagnostic=p.get('diagnostic',{})
 if 'post_install_units' in p: diagnostic={'post_install_units':p['post_install_units']}
 if p.get('status')=='passed':
  print('guest receipt rejected revocation.new_denied_status='+str(p.get('revocation',{}).get('new_denied_status'))+' lost_ack_keys='+','.join(sorted(p.get('lost_ack',{}))))
 else:
  print(re.sub('[^A-Za-z0-9 _=./;:-]',' ',str(p.get('reason','failed proof'))+' diagnostic='+json.dumps(diagnostic,sort_keys=True))[:500])
except (ValueError,TypeError):print('missing proof')
REASON
)
    # Only literal fixture phase markers are surfaced; never echo serial logs
    # or guest diagnostics that could contain an OAuth token.
    if [[ -z $proof ]]; then
      phases=$(grep -aEo 'VM_PHASE=(lost_ack_callback_start|lost_ack_callback_returned|lost_ack_assertions_passed|post_install_callback_start|post_install_callback_returned|post_install_assertions_passed)' "$run/serial.log" | sort -u | tr '\n' ',' || :)
      reason="missing proof serial_bytes=$(wc -c < "$run/serial.log") phases=${phases:-none}"
    fi
    fail boot_proof_failed "JIT login guest failed closed (VM exit $vm_status, ${duration}s; check=$reason)" 2
  fi
  if ! python3 - "$repo" "$run/serial.log" "$run/open-habitat" <<'TOKEN_SCAN'
import pathlib,sys
repo=pathlib.Path(sys.argv[1]);tokens=[('PRODUCT_VM_TOKEN_'+n+'_FIXTURE_ONLY_92764').encode() for n in ('guestone','guesttwo','guestthree','UNKNOWN')]
output=[pathlib.Path(sys.argv[2]),pathlib.Path(sys.argv[3])]
source=[repo/'scripts/vm-test.sh',*list((repo/'test/vm').glob('*.py'))]
# UNKNOWN is intentionally a literal in the historical fake provider's source.
if any(t in f.read_bytes() for f in output for t in tokens):sys.exit(1)
if any(t in f.read_bytes() for f in source for t in tokens[:3]):sys.exit(1)
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
 if p.get('uids')!=[21032,21033,21003] or p.get('binary_path')!='/opt/open-habitat/current/open-habitat': sys.exit(1)
 if not all(p.get(k) is True for k in ('pool_vacant_before_seed','new_accounts','committed_bindings','concurrent_clients_released','rerun_idempotent','wrong_peer_denied','wrong_uid_denied','pending_denied','boot_acl_denied','prepared_socket_started','cross_uid_denied','broker_config_drift_denied')): sys.exit(1)
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
    # Bounded synthetic-only diagnostic; the normal cleanup still removes
    # disks and seed. Never print serial bytes (they may include fixture tokens).
    cp "$run/serial.log" "$cache/last-product-boot-failure.log"
    chmod 0600 "$cache/last-product-boot-failure.log"
    fail boot_proof_failed "Product guest failed closed (VM exit $vm_status, ${duration}s; check=$reason; synthetic serial=$cache/last-product-boot-failure.log)" 2
  fi
  if ! python3 - "$repo" "$run/serial.log" "$run/open-habitat" <<'TOKEN_SCAN'
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
