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
if run jit-provision --json > "$tmp/out" 2> "$tmp/err"; then exit 1; fi
grep -q 'invalid_image_checksum' "$tmp/err"
if run jit-login --json > "$tmp/out" 2> "$tmp/err"; then exit 1; fi
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
# Negative hash/source test runs offline even in CI without Fleetrepo.
mkdir -p "$tmp/jit" "$tmp/fake-fleetrepo"
printf 'binary-fixture-bytes' > "$tmp/jit/native-agent-host"
git -C "$tmp/fake-fleetrepo" init -q
if FLEETREPO_JIT_SOURCE="$tmp/fake-fleetrepo" python3 "$repo/test/vm/jit-fixture.py" "$tmp/jit" "$tmp/jit/native-agent-host" > "$tmp/out" 2> "$tmp/err"; then exit 1; fi
[[ ! -e "$tmp/jit/jit-cloud-init.yaml" && ! -e "$tmp/jit/jit-receipt.json" ]]
mkdir -p "$tmp/shim"
cat > "$tmp/shim/git" <<'GIT'
#!/bin/sh
case "$3" in
  rev-parse) echo e044c03133074db3bb37d64e1e03c0bf4b9ade7d ;;
  show) printf 'corrupt pinned policy bytes' ;;
  *) exit 1 ;;
esac
GIT
chmod +x "$tmp/shim/git"
if FLEETREPO_JIT_SOURCE="$tmp/fake-fleetrepo" PATH="$tmp/shim:$PATH" python3 "$repo/test/vm/jit-fixture.py" "$tmp/jit" "$tmp/jit/native-agent-host" > "$tmp/out" 2> "$tmp/err"; then exit 1; fi
grep -q 'Fleetrepo JIT policy hash mismatch' "$tmp/err"
[[ ! -e "$tmp/jit/jit-cloud-init.yaml" && ! -e "$tmp/jit/jit-receipt.json" ]]
# The guest proof acceptance parser must never turn a failed JSON proof into a
# success when a caller has PYTHONOPTIMIZE=1 (Python strips assert statements).
validator=$(sed -n "/<<'JIT_CHECK'/,/^JIT_CHECK$/p" "$repo/scripts/vm-test.sh" | sed '1d;$d')
failed='{"status":"failed","scope":"jit-provision","pending_phase":"account"}'
for mode in normal optimized; do
  python_flags=()
  [[ $mode == optimized ]] && python_flags=(-O)
  if python3 "${python_flags[@]}" -c "$validator" "$failed"; then echo 'failed JIT proof accepted' >&2; exit 1; fi
done
login_validator=$(sed -n "/<<'LOGIN_CHECK'/,/^LOGIN_CHECK$/p" "$repo/scripts/vm-test.sh" | sed '1d;$d')
for mode in normal optimized; do
  python_flags=()
  [[ $mode == optimized ]] && python_flags=(-O)
  if python3 "${python_flags[@]}" -c "$login_validator" '{"status":"failed","scope":"jit-login-slice","routes":[]}'; then echo 'failed login proof accepted' >&2; exit 1; fi
done
python3 - "$login_validator" <<'LOGIN_ORACLE'
import json,subprocess,sys
p={'status':'passed','scope':'jit-login-slice','pid1':'systemd','uids':[21032,21033,21003],
   'routes':[{'uid':21032},{'uid':21033}],
   'native_gh':dict.fromkeys(('stdin_only','exact_argv','protected_file','credential_isolated'),True),
   'denials':dict.fromkeys(('cross_user_broker','unknown_identity','unknown_session','state_replay','root_peer','cross_user_home','cross_user_socket','gateway_home','gateway_credential','forged_headers','symlink_excluded'),True),
   'token_scan':{'passed':True,'allowed':'protected credential','scanned':'captures'},
   'revocation':{'atomic_fsynced':True,'existing_denied_statuses':[401]*4,'new_denied_status':403,'other_uid_reauthorized':True,'ledger_account_credential_preserved':True},
   'rename':{'same_uid':True,'no_second_gh_login':True},
   'gh_failures':{mode:{'callback_status':503,'session_status':401,'replay_status':403,'credential_absent':True} for mode in ('fail-login','wrong-id')},
   'lost_ack':{'callback_status':503,'session_status':401,'snapshot_status':401,'replay_status':403,'one_daemon_gh_call_observed':True,'daemon_killed_before_ack':True,'credential_preserved':True},
   'post_install_lost_ack':{'callback_status':503,'session_status':401,'snapshot_status':401,'replay_status':403,'one_shot_child_calls':2,'daemon_pid_changed':True,'protected_credential_retained':True,'other_uid_reauthenticated':True},
   'revoked_sibling_stopped_before_c':True,
   'post_install_units':{'start_ok':True,'before_service':{'ActiveState':'activating','SubState':'auto-restart','Result':'signal','MainPID':0},'after_service':{'ActiveState':'active','SubState':'running','Result':'success','MainPID':2345},'after_socket':{'ActiveState':'active','SubState':'listening','Result':'success'}}}
for key in ('pool_vacant_before_login','new_accounts','committed_bindings','root_ledger','pinned_policy_gate','socket_activation'):p[key]=True
def accepted(proof):return subprocess.run(['python3','-c',sys.argv[1],json.dumps(proof)]).returncode==0
assert accepted(p),'valid guest proof rejected'
for key in ('native_gh','denials'):
 v=p.pop(key);assert not accepted(p),f'missing {key} accepted';p[key]={};assert not accepted(p),f'empty {key} accepted';p[key]=v
p['denials']['root_peer']=False;assert not accepted(p),'false peer denial accepted'
p['denials']['root_peer']=True
p['revocation']['existing_denied_statuses']=[200]*4;assert not accepted(p),'false revocation accepted'
p['revocation']['existing_denied_statuses']=[401]*4
p['revocation']['new_denied_status']=302;assert not accepted(p),'new revocation callback accepted'
p['revocation']['new_denied_status']=403
p['gh_failures']['wrong-id']['credential_absent']=False;assert not accepted(p),'wrong-ID credential accepted'
p['gh_failures']['wrong-id']['credential_absent']=True
p['lost_ack']['one_daemon_gh_call_observed']=False;assert not accepted(p),'lost-ack repeat accepted'
p['lost_ack']['one_daemon_gh_call_observed']=True
for key,bad in [('one_shot_child_calls',3),('protected_credential_retained',False),('daemon_pid_changed',False),('other_uid_reauthenticated',False)]:
 old=p['post_install_lost_ack'][key];p['post_install_lost_ack'][key]=bad
 assert not accepted(p),f'post-install {key} accepted'
 p['post_install_lost_ack'][key]=old
p['post_install_units']['after_service']['MainPID']=0
assert not accepted(p),'zero generation PID accepted'
p['post_install_units']['after_service']['MainPID']=2345
p['revoked_sibling_stopped_before_c']=False
assert not accepted(p),'revoked sibling precondition omitted'
LOGIN_ORACLE
reboot_validator=$(sed -n "/<<'REBOOT_CHECK'/,/^REBOOT_CHECK$/p" "$repo/scripts/vm-test.sh" | sed '1d;$d')
python3 - "$reboot_validator" <<'REBOOT_ORACLE'
import json,subprocess,sys
p={'status':'passed','scope':'jit-reboot-diagnostic','pid1':'systemd','uids':[21032,21033,21003],
   'epoch':4,'generation':3,'boot_ids':['a'*64,'b'*64]}
keys=('persistent_bindings','persistent_credentials','sockets_disabled_before_prepare',
      'preflight_ready','boot_acl_unprepared','no_pending')
p.update(dict.fromkeys(keys,True))
def accepts(obj,opt=False):
 return subprocess.run(['python3']+(['-O'] if opt else [])+['-c',sys.argv[1],json.dumps(obj),'a'*64]).returncode==0
for opt in (False,True):
 if not accepts(p,opt):raise SystemExit('valid reboot receipt rejected')
 for key in keys:
  q=dict(p);q[key]=False
  if accepts(q,opt):raise SystemExit('forged reboot receipt accepted: '+key)
 for ids in (['a'*64,'a'*64],['bad','b'*64],[]):
  q=dict(p,boot_ids=ids)
  if accepts(q,opt):raise SystemExit('forged boot IDs accepted')
 if accepts(dict(p,status='failed'),opt):raise SystemExit('failed reboot accepted')
 if subprocess.run(['python3']+(['-O'] if opt else [])+['-c',sys.argv[1],json.dumps(p),'c'*64]).returncode==0:raise SystemExit('forged origin accepted')
REBOOT_ORACLE
reboot_unit_validator=$(sed -n "/<<'REBOOT_UNIT_CHECK'/,/^REBOOT_UNIT_CHECK$/p" "$repo/scripts/vm-test.sh" | sed '1d;$d')
python3 - "$reboot_unit_validator" "$tmp/jit/serial.log" <<'UNIT_ORACLE'
import pathlib,subprocess,sys
path=pathlib.Path(sys.argv[2]);proof=b'VM_PROOF={"status":"passed"}\n'
def accepts(lines):
 path.write_bytes(b''.join(lines))
 return subprocess.run(['python3','-c',sys.argv[1],str(path)]).returncode==0
assert accepts([proof,b'VM_REBOOT_UNIT_EXIT=success:exited:0\n'])
for lines in ([proof], [proof,b'VM_REBOOT_UNIT_EXIT=exit-code:exited:1\n'],
              [b'VM_REBOOT_UNIT_EXIT=success:exited:0\n',proof],
              [proof,b'VM_REBOOT_UNIT_EXIT=success:exited:0\n',b'VM_REBOOT_UNIT_EXIT=success:exited:0\n']):
 assert not accepts(lines), 'invalid unit completion accepted'
UNIT_ORACLE
# Host leak scanner must accept the intentional UNKNOWN fixture literal in the
# fake provider, yet reject emitted tokens and accidental full JIT tokens.
login_scanner=$(sed -n "/<<'TOKEN_SCAN'/,/^TOKEN_SCAN$/p" "$repo/scripts/vm-test.sh" | sed '1d;/^TOKEN_SCAN$/q' | sed '$d')
printf '' > "$tmp/jit/serial.log"
python3 -c "$login_scanner" "$repo" "$tmp/jit/serial.log" "$tmp/jit/native-agent-host"
printf 'PRODUCT_VM_TOKEN_UNKNOWN_FIXTURE_ONLY_92764' > "$tmp/jit/serial.log"
if python3 -c "$login_scanner" "$repo" "$tmp/jit/serial.log" "$tmp/jit/native-agent-host"; then echo 'unknown token leaked to serial' >&2; exit 1; fi
printf '' > "$tmp/jit/serial.log"
# Optional positive seed render from read-only historical committed blobs.
if git -C /home/maintainer/Sources/fleetrepo cat-file -e e044c031^{commit} 2>/dev/null; then
FLEETREPO_JIT_SOURCE=/home/maintainer/Sources/fleetrepo python3 "$repo/test/vm/jit-fixture.py" "$tmp/jit" "$tmp/jit/native-agent-host"
python3 - "$tmp/jit/jit-cloud-init.yaml" <<'JIT_FIXTURE'
import base64,json,sys
seed=json.loads(open(sys.argv[1]).read().split('\n',1)[1])
files={row['path']:row for row in seed['write_files']}
assert json.loads(base64.b64decode(files['/var/lib/native-agent-host/broker/allowlist.json']['content']))['ids']==[]
assert json.loads(base64.b64decode(files['/var/lib/native-agent-host/broker/bindings.json']['content']))['bindings']==[]
assert b'/opt/native-agent-host/current/native-agent-host' in base64.b64decode(files['/etc/systemd/system/native-agent-host-daemon@.service']['content'])
assert seed['runcmd'][-1]==['systemctl','start','jit-proof.service']
JIT_FIXTURE
  FLEETREPO_JIT_SOURCE=/home/maintainer/Sources/fleetrepo python3 "$repo/test/vm/jit-fixture.py" "$tmp/jit" "$tmp/jit/native-agent-host" login
  python3 - "$tmp/jit/jit-cloud-init.yaml" <<'JIT_LOGIN'
import base64,json,sys
seed=json.loads(open(sys.argv[1]).read().split('\n',1)[1]); files={f['path']:base64.b64decode(f['content']) for f in seed['write_files']}
assert not any(u['name'] in ('guestone','guesttwo') for u in seed['users'])
assert b"'scope':'jit-login-slice'" in files['/usr/local/sbin/jit-proof']
assert b'127.0.0.1' in files['/usr/local/sbin/product-fake-provider']
assert b'21032' in files['/usr/bin/gh'] and b'21033' in files['/usr/bin/gh']
assert files['/var/lib/native-agent-host/broker/bindings.json'].find(b'"bindings":[]')!=-1
assert seed['runcmd'][-1]==['systemctl','start','jit-proof.service']
JIT_LOGIN
fi
# Validate product seed rendering offline with a known injection payload (no boot).
mkdir -p "$tmp/product"
printf 'binary-fixture-bytes' > "$tmp/product/bin"
python3 "$repo/test/vm/product-fixture.py" "$tmp/product" "$tmp/product/bin"
if command -v podman >/dev/null && podman image exists localhost/native-agent-host-vm-tools:prereq; then
  cp "$tmp/product/bin" "$tmp/product/native-agent-host"
  podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --tmpfs /tmp:rw,size=16m --mount "type=bind,src=$tmp/product,dst=/run-data" localhost/native-agent-host-vm-tools:prereq genisoimage -quiet -R -graft-points -V PRODUCT -o /run-data/product.iso /native-agent-host=/run-data/native-agent-host
  podman run --rm --network=none --userns=keep-id --security-opt=no-new-privileges --cap-drop=all --read-only --mount "type=bind,src=$tmp/product,dst=/run-data,ro=true" localhost/native-agent-host-vm-tools:prereq isoinfo -R -i /run-data/product.iso -x /native-agent-host > "$tmp/extracted"
  cmp "$tmp/product/bin" "$tmp/extracted"
fi
python3 - "$tmp/product/product-cloud-init.yaml" "$repo" <<'PY'
import base64,json,sys
c=json.loads(open(sys.argv[1]).read().split('\n',1)[1]); files={f['path']:f for f in c['write_files']}
assert '/opt/native-agent-host/native-agent-host' not in files
assert base64.b64decode(files['/etc/native-agent-host/binary.sha256']['content']).decode().strip()==__import__('hashlib').sha256(b'binary-fixture-bytes').hexdigest()
assert any('/dev/disk/by-label/PRODUCT' in ' '.join(cmd) for cmd in c['runcmd'])
assert any(cmd[:2]==['install','-m'] and cmd[-1]=='/opt/native-agent-host/current/native-agent-host' for cmd in c['runcmd'])
assert all(any(cmd[:2]==['install','-m'] and cmd[-1]=='/usr/bin/'+tool for cmd in c['runcmd']) for tool in ('setfacl','getfacl'))
assert len([p for p in files if p.endswith('daemon.sock')])==0
assert all(base64.b64decode(f['content']).find(b'PRODUCT_VM_TOKEN')==-1 for p,f in files.items() if p.startswith('/etc/native-agent-host/'))
assert '/etc/systemd/system/native-agent-host-broker.socket' in files
assert '/etc/systemd/system/native-agent-host-daemon@.socket' in files
assert '/var/lib/native-agent-host/broker/bindings.json' in files
assert 'identities' not in json.loads(base64.b64decode(files['/etc/native-agent-host/gateway.json']['content']))['oauth']
assert c['runcmd'][-1]==['/usr/bin/python3','/usr/local/sbin/product-proof']
for name,uid in [('agent-a',21001),('agent-b',21002)]:
    cfg=json.loads(base64.b64decode(files[f'/etc/native-agent-host/daemon-{name}.json']['content']))
    assert (cfg['handoff']['uid'],cfg['handoff']['username'],cfg['handoff']['home'],cfg['handoff']['subject'])==(uid,name,'/home/'+name,str(31001+uid-21001))
    assert cfg['handoff']['binding_file']==f'/etc/native-agent-host/daemon-{name}.json'
# The separately generated VM fixture above is not the shipped package unit.
unit=open(sys.argv[2]+'/systemd/native-agent-host-daemon@.socket').read()
assert all(x in unit for x in ['SocketMode=0660\n','DirectoryMode=0710\n','FileDescriptorName=daemon\n','SocketGroup=native-agent-host-gateway\n'])
PY
[[ ! -e "$tmp/product/tls.key" && ! -e "$tmp/product/tls.crt" ]]
grep -Fq "'scope':'product-two-user-routing'" "$repo/test/vm/product-proof.py"
python3 "$repo/test/vm/test-jit-render.py"
python3 "$repo/test/vm/test-guest-command.py"
# Guard the explicit timeout and kill/cleanup wiring against accidental removal.
grep -Fq 'timeout -k 10s "${vm_limit}s" podman run' "$tmp/repo/scripts/vm-test.sh"
grep -Fq '[[ $scenario == jit-reboot-diagnostic ]] && vm_limit=430' "$tmp/repo/scripts/vm-test.sh"
grep -Fq 'if test "$scenario" != jit-reboot-diagnostic; then set -- -no-reboot "$@"; fi' "$tmp/repo/scripts/vm-test.sh"
grep -Fq 'genisoimage -quiet -R -graft-points -V PRODUCT' "$tmp/repo/scripts/vm-test.sh"
grep -Fq 'timeout -k 5s 360s podman run' "$tmp/repo/scripts/vm-test.sh"
grep -Fq 'trap cleanup EXIT' "$tmp/repo/scripts/vm-test.sh"
grep -Fq 'podman rm -f "vm-fixture-$$" "vm-download-$$"' "$tmp/repo/scripts/vm-test.sh"
echo 'VM parser/envelope/fixture/checksum/cleanup/timeout-wiring tests passed (offline; no boot)'
