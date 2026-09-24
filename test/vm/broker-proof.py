#!/usr/bin/python3
"""Root-only disposable guest broker proof, no host state or credentials."""
import json
import os
import pathlib
import pwd
import socket
import stat
import struct
import subprocess
import sys
import time

path = '/run/native-agent-host/broker.sock'
state = pathlib.Path('/var/lib/native-agent-host/broker')
def check(ok, msg):
    if not ok: raise RuntimeError(msg)
def system(*args):
    return subprocess.run(['systemctl', *args], capture_output=True, text=True)
def connect(uid, gid, request=True):
    script = '''import json,os,socket,struct,sys
os.setgroups([]);os.setgid(%d);os.setuid(%d)
s=socket.socket(socket.AF_UNIX);s.settimeout(3);s.connect(%r)
%s
''' % (gid, uid, path, '''b=json.dumps({'version':1,'operation':'authorize','provider':'github','id':'99'}).encode();s.sendall(struct.pack('>I',len(b))+b);s.shutdown(socket.SHUT_WR);h=s.recv(4);assert len(h)==4;size=struct.unpack('>I',h)[0];print(s.recv(size).decode())''' if request else '''print('connected',flush=True);s.sendall(b'X');s.shutdown(socket.SHUT_WR);\ntry: data=s.recv(4)\nexcept ConnectionResetError: data=b''\nassert data==b'' ''')
    return subprocess.run(['/usr/bin/python3','-c',script], capture_output=True, text=True, timeout=8)
def stopped():
    # Type=simple can report start success before the process checks state.
    # Wait a bounded interval for the process to exit, never equate a queued
    # systemctl start job with broker readiness.
    for _ in range(40):
        if system('is-active','native-agent-host-broker.service').stdout.strip() != 'active':
            return
        time.sleep(0.1)
    raise RuntimeError('broker service remained active')
try:
    check(pathlib.Path('/proc/1/comm').read_text().strip() == 'systemd','PID 1')
    check(pwd.getpwnam('native-agent-host-gateway').pw_uid == 21003 and pwd.getpwnam('broker-stranger').pw_uid == 21005,'real guest UIDs')
    check(system('start','native-agent-host-broker.socket').returncode == 0, 'socket start')
    st = os.lstat(path)
    check(stat.S_ISSOCK(st.st_mode) and st.st_uid == 0 and st.st_gid == 21003 and stat.S_IMODE(st.st_mode) == 0o660,'socket inode')
    denied = connect(21005,21005)
    check(denied.returncode != 0 and 'PermissionError' in denied.stderr,'kernel wrong-UID denial')
    denied = connect(0,0,False)
    check(denied.returncode == 0 and 'connected' in denied.stdout,'root wrong-peer not denied after connect: '+denied.stderr[-160:])
    ok = connect(21003,21003)
    check(ok.returncode == 0 and json.loads(ok.stdout)['failure'] == 'denied','gateway request/handler denial')
    check(system('is-active','native-agent-host-broker.service').stdout.strip() == 'active','service activation')
    check(system('stop','native-agent-host-broker.service').returncode == 0,'service stop')
    (state/'pending.json').symlink_to('/dev/null')
    system('start','native-agent-host-broker.service')
    stopped()
    (state/'pending.json').unlink()
    (state/'head.json').rename(state/'head.saved')
    (state/'head.json').symlink_to('/dev/null')
    system('start','native-agent-host-broker.service')
    stopped()
    (state/'head.json').unlink()
    (state/'head.saved').rename(state/'head.json')
    (state/'head.json').write_text('{"version":1,"epoch":3,"generation":1}')
    os.chmod(state/'head.json',0o600)
    system('start','native-agent-host-broker.service')
    stopped()
    print('VM_PROOF='+json.dumps({'status':'passed','scope':'broker-private-guest','pid1':'systemd','uids':[0,21003,21005],'wrong_uid_denied':True,'wrong_peer_denied':True,'pending_symlink_denied':True,'head_symlink_denied':True,'restart_drift_denied':True}),flush=True)
    subprocess.run(['systemd-run','--on-active=15s','--unit=broker-shutdown','/usr/bin/systemctl','poweroff','--no-block'],check=True,stdout=subprocess.DEVNULL)
except Exception as exc:
    print('VM_PROOF='+json.dumps({'status':'failed','scope':'broker-private-guest','reason':str(exc)}),flush=True)
    subprocess.run(['systemd-run','--on-active=15s','--unit=broker-shutdown-failed','/usr/bin/systemctl','poweroff','--no-block'], stdout=subprocess.DEVNULL)
    sys.exit(1)
