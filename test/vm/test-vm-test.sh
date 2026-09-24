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
if run two-user-routing --json > "$tmp/out" 2> "$tmp/err"; then exit 1; fi
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
# Validate product seed rendering offline with a known injection payload (no boot).
mkdir -p "$tmp/product"
printf 'binary-fixture-bytes' > "$tmp/product/bin"
python3 "$repo/test/vm/product-fixture.py" "$tmp/product" "$tmp/product/bin"
if command -v podman >/dev/null && podman image exists localhost/native-agent-host-vm-tools:prereq; then
  cp "$tmp/product/bin" "$tmp/product/native-agent-host"
  podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --tmpfs /tmp:rw,size=16m --mount "type=bind,src=$tmp/product,dst=/run-data" localhost/native-agent-host-vm-tools:prereq genisoimage -quiet -R -V PRODUCT -o /run-data/product.iso /run-data/native-agent-host
  podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --mount "type=bind,src=$tmp/product,dst=/run-data,ro=true" localhost/native-agent-host-vm-tools:prereq isoinfo -R -i /run-data/product.iso -x /native-agent-host > "$tmp/extracted"
  cmp "$tmp/product/bin" "$tmp/extracted"
fi
python3 - "$tmp/product/product-cloud-init.yaml" "$repo" <<'PY'
import base64,json,sys
c=json.loads(open(sys.argv[1]).read().split('\n',1)[1]); files={f['path']:f for f in c['write_files']}
assert '/opt/native-agent-host/native-agent-host' not in files
assert base64.b64decode(files['/etc/native-agent-host/binary.sha256']['content']).decode().strip()==__import__('hashlib').sha256(b'binary-fixture-bytes').hexdigest()
assert any('/dev/disk/by-label/PRODUCT' in ' '.join(cmd) for cmd in c['runcmd'])
assert any(cmd[:2]==['install','-m'] and cmd[-1]=='/opt/native-agent-host/native-agent-host' for cmd in c['runcmd'])
assert len([p for p in files if p.endswith('daemon.sock')])==0
assert all(base64.b64decode(f['content']).find(b'PRODUCT_VM_TOKEN')==-1 for p,f in files.items() if p.startswith('/etc/native-agent-host/'))
assert c['runcmd'][-1]==['/usr/bin/python3','/usr/local/sbin/product-proof']
for name,uid in [('agent-a',21001),('agent-b',21002)]:
    sock=base64.b64decode(files[f'/etc/systemd/system/product-{name}.socket']['content']).decode()
    service=base64.b64decode(files[f'/etc/systemd/system/product-{name}.service']['content']).decode()
    assert sock.startswith('[Socket]\n') and sock.count('ListenStream=')==1
    assert f'ListenStream=/run/native-agent-host/users/{name}/daemon.sock\n' in sock
    assert all(x in sock for x in [f'SocketUser={name}\n','SocketGroup=native-agent-host-gateway\n','SocketMode=0660\n','DirectoryMode=0711\n','FileDescriptorName=daemon\n','Accept=no\n'])
    assert service.startswith('[Unit]\n') and f'User={name}\n' in service and f'Group={name}\n' in service
    assert f'ExecStart=/usr/bin/python3 /usr/local/sbin/product-daemon-launch daemon exec --config /etc/native-agent-host/daemon-{name}.json\n' in service
    cfg=json.loads(base64.b64decode(files[f'/etc/native-agent-host/daemon-{name}.json']['content']))
    assert (cfg['handoff']['uid'],cfg['handoff']['username'],cfg['handoff']['home'],cfg['handoff']['subject'])==(uid,name,'/home/'+name,str(31001+uid-21001))
# The separately generated VM fixture above is not the shipped package unit.
unit=open(sys.argv[2]+'/systemd/native-agent-host-daemon@.socket').read()
assert all(x in unit for x in ['SocketMode=0660\n','DirectoryMode=0710\n','FileDescriptorName=daemon\n','SocketGroup=native-agent-host-gateway\n'])
PY
[[ ! -e "$tmp/product/tls.key" && ! -e "$tmp/product/tls.crt" ]]
grep -Fq "'scope':'product-two-user-routing'" "$repo/test/vm/product-proof.py"
# Guard the explicit timeout and kill/cleanup wiring against accidental removal.
grep -Fq 'timeout -k 10s 600s podman run' "$tmp/repo/scripts/vm-test.sh"
grep -Fq 'genisoimage -quiet -R -V PRODUCT' "$tmp/repo/scripts/vm-test.sh"
grep -Fq 'timeout -k 5s 360s podman run' "$tmp/repo/scripts/vm-test.sh"
grep -Fq 'trap cleanup EXIT' "$tmp/repo/scripts/vm-test.sh"
grep -Fq 'podman rm -f "vm-fixture-$$" "vm-download-$$"' "$tmp/repo/scripts/vm-test.sh"
echo 'VM parser/envelope/fixture/checksum/cleanup/timeout-wiring tests passed (offline; no boot)'
