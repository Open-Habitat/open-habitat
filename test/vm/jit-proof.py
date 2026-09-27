#!/usr/bin/python3
"""Guest-only actual systemd broker and Linux executor allocation proof."""
import fcntl
import grp
import json
import os
from pathlib import Path
import pwd
import socket
import stat
import struct
import subprocess
import sys
import time

state=Path('/var/lib/native-agent-host/broker')
run=Path('/run/native-agent-host')
prep='/usr/local/libexec/native-agent-host-test-jit/jit_acl_prepare.py'
broker=run/'broker.sock'
names=('guestone','guesttwo')
ids=('100000001','100000002')
def check(value, reason):
    if not value: raise RuntimeError(reason)
def cmd(*args):
    return subprocess.run(args,capture_output=True,text=True,timeout=30)
def unit(*args): return cmd('systemctl',*args)
def reset():
    unit('reset-failed','native-agent-host-jit-policy-gate.service',
         'native-agent-host-jit-policy-gate@guestone.service',
         'native-agent-host-jit-policy-gate@guesttwo.service')
def probe(uid,path,connect=False,denied=False):
    code=('import os,socket,sys\ntry:\n s=socket.socket(socket.AF_UNIX);s.connect(sys.argv[1])\n' if connect else 'import os,sys\ntry:\n os.stat(sys.argv[1]+"/.")\n')
    code+='except OSError as e:\n print(e.errno,file=sys.stderr);sys.exit(1)\n'
    def drop():
        os.setgroups([]);os.setresgid(uid,uid,uid);os.setresuid(uid,uid,uid)
    result=subprocess.run(['/usr/bin/python3','-c',code,str(path)],preexec_fn=drop,capture_output=True,text=True,timeout=8)
    return result.returncode != 0 and result.stderr.strip()=='13' if denied else result.returncode==0
def launch_exchange(uid,operation,subject,candidate=None,synchronized=False):
    # Process credentials are set before connect, not embedded in request JSON.
    request={'version':1,'operation':operation,'provider':'github','id':subject}
    if candidate is not None: request['candidate']=candidate
    code='''import json,socket,struct,sys
s=socket.socket(socket.AF_UNIX);s.settimeout(40);s.connect(sys.argv[1])
if len(sys.argv)>3:
 print('CONNECTED',file=sys.stderr,flush=True)
 assert sys.stdin.buffer.read(1)==b'1','release missing'
b=json.dumps(json.loads(sys.argv[2]),separators=(',',':')).encode();s.sendall(struct.pack('>I',len(b))+b);s.shutdown(socket.SHUT_WR)
h=s.recv(4);assert len(h)==4,'no reply';n=struct.unpack('>I',h)[0];b=b''
while len(b)<n:
 p=s.recv(n-len(b));assert p,'truncated';b+=p
assert not s.recv(1),'trailing reply';print(b.decode())
'''
    def drop():
        os.setgroups([]);os.setresgid(uid,uid,uid);os.setresuid(uid,uid,uid)
    return subprocess.Popen(['/usr/bin/python3','-c',code,str(broker),json.dumps(request),*(['synchronized'] if synchronized else [])],preexec_fn=drop,stdout=subprocess.PIPE,stderr=subprocess.PIPE,stdin=subprocess.PIPE,text=True)

def collect(process):
    from subprocess import CompletedProcess
    if process.stdin and not process.stdin.closed: process.stdin.close()
    process.wait(timeout=45)
    return CompletedProcess(process.args,process.returncode,process.stdout.read(),process.stderr.read())

def exchange(uid,operation,subject,candidate=None):
    return collect(launch_exchange(uid,operation,subject,candidate))
def route(result,uid,name):
    check(result.returncode==0,'broker exchange: '+result.stderr[-300:])
    data=json.loads(result.stdout)
    if data.get('route')!={'uid':uid,'username':name,'socket':str(run/'users'/name/'daemon.sock')}:
        gate='native-agent-host-jit-policy-gate@'+name+'.service'
        # Safe diagnostic: unit metadata/argv only, never OAuth/provider bytes.
        props=unit('show',gate,'--property=LoadState,ExecStart,User,Type,RemainAfterExit,ExecStartPre,ExecStartPost,ExecCondition,ExecReload,ExecStopPost','--no-pager').stdout
        raise RuntimeError('wrong route: '+str(data)+' gate_properties='+repr(props[:1600]))
    return data
def denied_start():
    reset()
    for name in ('native-agent-host-broker.socket','native-agent-host-daemon@guestone.socket'):
        check(unit('start',name).returncode != 0,'unprepared socket started: '+name)
        check(unit('is-active',name).stdout.strip()!='active','socket remained active')
def vacancy():
    # Independent exhaustive enumeration and direct resolution before *any* IDs
    # enter the allowlist. No collision may be skipped by Writer.Available.
    users=pwd.getpwall(); groups=grp.getgrall()
    for n in range(21032,21048):
        check(all(u.pw_uid!=n and u.pw_gid!=n and u.pw_dir!='/home/'+str(n) for u in users),'NSS passwd pool occupant')
        check(all(g.gr_gid!=n for g in groups),'NSS group pool occupant')
        for resolve in (pwd.getpwuid,grp.getgrgid):
            try: resolve(n)
            except KeyError: pass
            else: raise RuntimeError('direct NSS pool occupant: '+str(n))
    for name in names:
        check(all(u.pw_name!=name and u.pw_dir!='/home/'+name for u in users),'name/home occupied')
        check(all(g.gr_name!=name and name not in g.gr_mem for g in groups),'group alias')
        for path in (Path('/home')/name, Path('/etc/native-agent-host')/('daemon-'+name+'.json'),run/'users'/name):
            check(not os.path.lexists(path),'preexisting path: '+str(path))
        for kind in ('socket','service'):
            check(unit('is-active',f'native-agent-host-daemon@{name}.{kind}').stdout.strip()=='inactive','active instance collision')
    check(not (state/'pending.json').exists(),'pending before seed')
def seed():
    fd=os.open(state,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        fcntl.flock(fd,fcntl.LOCK_EX)
        check(json.loads((state/'allowlist.json').read_text())=={'version':1,'epoch':1,'ids':[]},'nonempty seed')
        path=state/'allowlist.json.next'
        staged=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
        with os.fdopen(staged,'w') as f:
            f.write(json.dumps({'version':1,'epoch':2,'ids':[{'id':ids[0],'alternate':names[0]},{'id':ids[1],'alternate':names[1]}]}));f.flush();os.fsync(f.fileno())
        path.replace(state/'allowlist.json');os.fsync(fd)
    finally: os.close(fd)
try:
    check(Path('/proc/1/comm').read_text().strip()=='systemd','not PID1 systemd')
    check(Path('/opt/native-agent-host/current/native-agent-host').is_file(),'missing exact executor binary')
    check('ExecStart=/opt/native-agent-host/current/native-agent-host' in unit('cat','native-agent-host-daemon@.service').stdout,'daemon unit binary changed')
    vacancy()
    check(cmd('/usr/bin/python3',prep,'preflight','--json').returncode==0,'empty preflight refused')
    seed()
    denied_start()
    p=cmd('/usr/bin/python3',prep,'prepare','--json')
    check(p.returncode==0,'boot ACL preparation: '+p.stderr[-500:])
    check(cmd('/usr/bin/python3',prep,'verify','--json').returncode==0,'boot ACL verification')
    check(unit('start','native-agent-host-broker.socket').returncode==0,'gated broker start')
    st=broker.lstat();check(stat.S_ISSOCK(st.st_mode) and (st.st_uid,st.st_gid,stat.S_IMODE(st.st_mode))==(0,21003,0o660),'broker socket inode')
    check(exchange(21001,'authorize',ids[0]).returncode!=0,'wrong UID accessed broker socket')
    wrong=exchange(0,'authorize',ids[0]);check(wrong.returncode!=0,'wrong root peer received reply')
    before=json.loads((state/'bindings.json').read_text());check(before=={'version':1,'generation':1,'bindings':[]},'adopted existing binding')
    # Both fresh identities enter the same broker in this single PID1 guest.
    # Children drop credentials before connect; neither response is collected
    # before both have been launched. Generations may publish in either order.
    exchange_start=time.monotonic()
    children=[launch_exchange(21003,'ensure',subject,candidate,synchronized=True) for subject,candidate in
              zip(ids,('GuestOne','GuestTwo'))]
    # Both numeric gateway-UID peers must connect before either sends its
    # ensure. This proves overlapping clients, not simultaneous OAuth or
    # an observed gate/writer lock collision.
    import select
    waiting={child.stderr for child in children}
    deadline=time.monotonic()+10
    while waiting:
        ready,_,_=select.select(list(waiting),[],[],max(0,deadline-time.monotonic()))
        check(bool(ready),'peers did not connect concurrently')
        for stream in ready:
            check(stream.readline().strip()=='CONNECTED','peer did not connect')
            waiting.remove(stream)
    for child in children:
        child.stdin.write('1');child.stdin.close()
    results=[collect(child) for child in children]
    exchange_seconds=round(time.monotonic()-exchange_start,3)
    # The first lock winner takes the first numeric slot; names must stay
    # attached to subjects, but UID order is intentionally unspecified.
    replies=[json.loads(result.stdout) if result.returncode==0 else {} for result in results]
    assigned=[reply.get('route',{}).get('uid') for reply in replies]
    check(set(assigned)=={21032,21033},'concurrent UID allocation or route missing: '+repr([(reply.get('failure'),result.returncode,result.stderr[-120:]) for reply,result in zip(replies,results)]))
    firsts=[route(result,uid,name) for result,uid,name in zip(results,assigned,names)]
    check(all(first['generation'] in (2,3) and first['epoch']==2 for first in firsts),'unexpected concurrent generation')
    for uid,name,subject,first in zip(assigned,names,ids,firsts):
        check(pwd.getpwnam(name).pw_uid==uid and pwd.getpwnam(name).pw_gid==uid and grp.getgrnam(name).gr_gid==uid,'executor account/group')
        home=Path('/home')/name; check((home.stat().st_uid,home.stat().st_gid,stat.S_IMODE(home.stat().st_mode))==(uid,uid,0o700),'executor home')
        check((Path('/etc/native-agent-host')/('daemon-'+name+'.json')).is_file(),'executor config missing')
        rerun=route(exchange(21003,'ensure',subject,'changedname'),uid,name)
        check(rerun['route']==first['route'] and rerun['epoch']==first['epoch'] and rerun['generation']==3,'rerun not idempotent')
        check(unit('is-active','native-agent-host-daemon@'+name+'.socket').stdout.strip()=='active','daemon socket not broker-activated')
    ledger=json.loads((state/'bindings.json').read_text())
    check(ledger.get('version')==1 and ledger.get('generation')==3 and
          sorted(ledger.get('bindings',[]),key=lambda row:row['id'])==
          [{'id':subject,'uid':uid,'username':name} for subject,uid,name in zip(ids,assigned,names)],
          'not two new committed bindings')
    check(not (state/'pending.json').exists(),'writer left pending journal')
    # Exercise gate denial on a *stopped* instance: an active socket has no
    # new activation job to gate, and broker authorize is separately checked.
    check(unit('stop','native-agent-host-daemon@guesttwo.socket').returncode==0,'stop second socket for pending gate')
    marker=state/'pending.json';marker.write_text('{"version":1}');marker.chmod(0o600)
    ledger_bytes=(state/'bindings.json').read_bytes();head_bytes=(state/'head.json').read_bytes()
    check(json.loads(exchange(21003,'authorize',ids[0]).stdout).get('failure')=='state_unavailable','pending did not block writer')
    check(unit('start','native-agent-host-daemon@guesttwo.socket').returncode!=0,'pending allowed gate')
    check((state/'bindings.json').read_bytes()==ledger_bytes and
          (state/'head.json').read_bytes()==head_bytes,'pending changed committed state')
    marker.unlink() # existing synthetic fault test only; never operator recovery
    reset()
    check(unit('start','native-agent-host-daemon@guesttwo.socket').returncode==0,'second daemon socket start')
    # Broker Verify checks root-owned daemon config metadata on each existing
    # binding request; the pinned Fleetrepo socket gate does NOT inspect this
    # config. Do not claim a gate-level denial for this fault.
    config=Path('/etc/native-agent-host/daemon-guesttwo.json')
    original_mode=stat.S_IMODE(config.stat().st_mode)
    route(exchange(21003,'authorize',ids[1]),assigned[1],names[1])
    config.chmod(0o600)
    try:
        drift=exchange(21003,'authorize',ids[1])
        check(drift.returncode==0 and json.loads(drift.stdout).get('failure')=='drift',
              'broker did not refuse config drift')
        check((state/'bindings.json').read_bytes()==ledger_bytes and (state/'head.json').read_bytes()==head_bytes,
              'drift changed committed state')
    finally:
        config.chmod(original_mode) # disposable guest only; no live-state repair advice
    route(exchange(21003,'authorize',ids[1]),assigned[1],names[1])
    for uid,own,sibling in ((assigned[0],names[0],names[1]),(assigned[1],names[1],names[0])):
        check(probe(uid,run/'users'/own),'own socket directory denied')
        check(probe(uid,run/'users'/sibling,denied=True),'cross-user socket directory access')
        check(probe(uid,run/'users'/sibling/'daemon.sock',connect=True,denied=True),'cross-user UDS connect')
        check(probe(uid,Path('/home')/sibling,denied=True),'cross-user home access')
        check((run/'users'/sibling/'daemon.sock').is_socket(),'sibling inode missing')
    print('VM_PROOF='+json.dumps({'status':'passed','scope':'jit-provision','pid1':'systemd','uids':[21032,21033,21003],
        'pool_vacant_before_seed':True,'new_accounts':True,'committed_bindings':True,'concurrent_clients_released':True,'rerun_idempotent':True,
        'wrong_peer_denied':True,'wrong_uid_denied':True,'pending_denied':True,'boot_acl_denied':True,
        'prepared_socket_started':True,'cross_uid_denied':True,'broker_config_drift_denied':True,'binary_path':'/opt/native-agent-host/current/native-agent-host'}),flush=True)
except Exception as exc:
    # Diagnostic only: no journal deletion or retry on an interrupted writer.
    pending=state/'pending.json'
    try:
        journal=json.loads(pending.read_text()) if pending.is_file() else None
        phase=journal.get('phase') if isinstance(journal,dict) else None
    except (OSError,ValueError): phase='unreadable'
    broker_state=unit('is-active','native-agent-host-broker.service').stdout.strip()
    print('VM_PROOF='+json.dumps({'status':'failed','scope':'jit-provision','reason':str(exc),
        'pending_phase':phase,'broker_state':broker_state,
        'exchange_seconds':locals().get('exchange_seconds')}),flush=True)
    sys.exit(1)
finally:
    subprocess.run(['systemd-run','--on-active=15s','--unit=jit-shutdown','/usr/bin/systemctl','poweroff','--no-block'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
