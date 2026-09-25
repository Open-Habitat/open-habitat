#!/usr/bin/python3
"""Second PID1 boot of the same disposable JIT guest; no policy bypass."""
import hashlib
import resource
import signal
import tempfile
import json
import os
from pathlib import Path
import pwd
import socket
import stat
import subprocess
import sys
import time

state=Path('/var/lib/native-agent-host/broker')
run=Path('/run/native-agent-host')
names=('guestone','guesttwo')
uids=(21032,21033)
prep='/usr/local/libexec/native-agent-host-test-jit/jit_acl_prepare.py'
receipt={'status':'failed','scope':'jit-reboot-diagnostic'}
def checkpoint(label):
    print('VM_REBOOT_DIAG='+label,flush=True)
def need(value,label):
    if not value: raise RuntimeError(label)
def command(*args, timeout=12, uid=None, output=False):
    """Bound execution AND output; never wait for a descendant's inherited pipe.

    A regular anonymous file replaces capture_output pipes. A private process
    session lets the parent kill descendants even if they inherited stdout.
    """
    def prepare():
        if output:
            # Only the status command uses a captured file. Do not constrain
            # policy/fixture writes with a process-wide file-size limit.
            resource.setrlimit(resource.RLIMIT_FSIZE, (4096, 4096))
        if uid is not None:
            os.setgroups([])
            os.setresgid(uid, uid, uid)
            os.setresuid(uid, uid, uid)
    with tempfile.TemporaryFile() as captured:
        child = subprocess.Popen(args, stdout=captured if output else subprocess.DEVNULL,
                                 stderr=subprocess.DEVNULL, start_new_session=True,
                                 preexec_fn=prepare if output or uid is not None else None)
        try:
            child.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                child.wait(timeout=3)
            except subprocess.TimeoutExpired:
                pass  # systemd's independent TimeoutStartSec remains the backstop
            raise TimeoutError('command deadline')
        # The leader can exit while a descendant still holds the session alive.
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        captured.seek(0)
        return subprocess.CompletedProcess(args, child.returncode,
                                           captured.read(4096).decode('utf-8', 'replace'))
command_index=0
def unit(*args):
    global command_index
    index=command_index
    command_index+=1
    checkpoint(f'cmd-{index}-start')
    try:
        result=command('systemctl',*args, output=True)
    except TimeoutError:
        checkpoint(f'cmd-{index}-timeout')
        raise
    code=128-result.returncode if result.returncode<0 else min(255,result.returncode)
    checkpoint(f'cmd-{index}-exit-{code}')
    return result
def probe(uid,path,connect=False):
    code=('import socket,sys;s=socket.socket(socket.AF_UNIX);s.connect(sys.argv[1])' if connect else 'import os,sys;os.stat(sys.argv[1]+"/.")')
    return command('/usr/bin/python3','-c',code,str(path),uid=uid,timeout=15).returncode==0
try:
    need(Path('/proc/1/comm').read_text().strip()=='systemd','PID1 not systemd')
    before=json.loads((state.parent/'reboot-fixture.json').read_text())
    boot=Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    need(len(boot)==36 and boot!=before['boot_id'],'no real kernel reboot')
    print('VM_REBOOT_DIAG=kernel-boot-changed',flush=True)
    need(json.loads((state/'bindings.json').read_text())==before['bindings'],'binding changed across reboot')
    need(json.loads((state/'head.json').read_text())==before['head'],'high-water changed across reboot')
    need(json.loads((state/'allowlist.json').read_text())=={'version':1,'epoch':4,'ids':[{'id':str(100000001+i),'alternate':n} for i,n in enumerate(names)]},'allowlist epoch changed')
    need(sorted(p.name for p in state.iterdir())==['allowlist.json','bindings.json','broker.json','head.json'],'unexpected or pending ledger state')
    for name,uid in zip(names,uids):
        need(pwd.getpwnam(name).pw_uid==uid and (Path('/home')/name).stat().st_uid==uid,'account/home lost')
        credential=Path('/home')/name/'.config/gh/hosts.yml'
        need(credential.stat().st_uid==uid and stat.S_IMODE(credential.stat().st_mode)==0o600 and hashlib.sha256(credential.read_bytes()).hexdigest()==before['credentials'][name],'credential changed')
        need(not probe(uids[1-names.index(name)],credential.parent),'foreign credential directory traversable')
    print('VM_REBOOT_DIAG=persistent-ledger-and-homes',flush=True)
    for name in names:
        checkpoint('socket-'+name+'-status-start')
        need(unit('is-enabled',f'native-agent-host-daemon@{name}.socket').stdout.strip()=='disabled','daemon socket enabled')
        need(unit('is-active',f'native-agent-host-daemon@{name}.socket').stdout.strip()=='inactive','daemon socket booted without prepare')
        need(not os.path.lexists(run/'users'/name/'daemon.sock'),'daemon listener present before prepare')
    checkpoint('broker-socket-status-start')
    need(unit('is-enabled','native-agent-host-broker.socket').stdout.strip()=='disabled','broker socket enabled')
    need(unit('is-active','native-agent-host-broker.socket').stdout.strip()=='inactive','broker socket booted without prepare')
    need(not os.path.lexists(run/'broker.sock'),'broker listener present before prepare')
    print('VM_REBOOT_DIAG=disabled-sockets',flush=True)
    checkpoint('policy-preflight-start')
    need(command('/usr/bin/python3',prep,'preflight','--json').returncode==0,'persistent policy preflight failed')
    checkpoint('policy-verify-start')
    need(command('/usr/bin/python3',prep,'verify','--json').returncode!=0,'boot ACL already prepared')
    print('VM_REBOOT_DIAG=unprepared-boot-acl',flush=True)
    # Diagnostic stops before activation: the root-owned boot ACL preparation
    # and fail-closed gate ordering are NOT proven by this receipt.
    receipt={'status':'passed','scope':'jit-reboot-diagnostic','pid1':'systemd','uids':[21032,21033,21003],
             'boot_ids':[hashlib.sha256(x.encode()).hexdigest() for x in (before['boot_id'],boot)],
             'persistent_bindings':True,'persistent_credentials':True,
             'epoch':4,'generation':before['bindings']['generation'],
             'sockets_disabled_before_prepare':True,'preflight_ready':True,
             'boot_acl_unprepared':True,'no_pending':True}
except Exception as exc:
    # Never echo argv or private paths supplied by a subprocess exception.
    receipt['reason']=type(exc).__name__[:60]
print('VM_PROOF='+json.dumps(receipt,separators=(',',':')),flush=True)
command('systemd-run','--on-active=15s','--unit=jit-shutdown','/usr/bin/systemctl','poweroff','--no-block',timeout=5)
if receipt['status']!='passed':sys.exit(1)
