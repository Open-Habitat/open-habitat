#!/usr/bin/python3
"""Disposable VM only: production prepare/apply, interrupted continuations and boot."""
import glob
import hashlib
import http.client
import json
import os
from pathlib import Path
import pwd
import signal
import socket
import ssl
import struct
import subprocess
import time
import traceback

ROOT=Path('/var/lib/apply-fixture')
SITE='/etc/open-habitat/site.json'
BIN='/mnt/product/bin/open-habitat'


def run(*args, **kw):
    return subprocess.run(args, check=True, text=True, capture_output=True, timeout=600, **kw)


def cli(*args, code=0):
    p=subprocess.run([BIN,*args], text=True, capture_output=True, timeout=900)
    if p.returncode!=code:
        print(p.stdout, flush=True)
        print(p.stderr, flush=True)
        raise RuntimeError('CLI exit '+str(p.returncode)+' expected '+str(code)+' '+str(args))
    return p


def preview(kind='apply'):
    p=cli('host',kind,'--site',SITE,'--dry-run','--json')
    r=json.loads(p.stdout)['data']
    assert r['plan']['approvable'],r
    return r['plan']['plan_id']


def live(plan,kind='apply'):
    flags=['--approve-disruption'] if kind=='prepare' else []
    p=cli('host',kind,'--site',SITE,'--approved-plan',plan,*flags,'--output=jsonl')
    events=[json.loads(line) for line in p.stdout.splitlines()]
    assert events[-1]['event']=='result',events
    assert [e['seq'] for e in events]==list(range(1,len(events)+1)),events
    assert not any(e['event'] in ('error','result','cancelled') for e in events[:-1])
    return events[-1]['data']


def interrupted(plan,phase):
    p=subprocess.Popen([BIN,'host','apply','--site',SITE,'--approved-plan',plan,'--output=jsonl'],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    for line in p.stdout:
        e=json.loads(line)
        if e['event']=='progress' and e['phase']==phase:
            p.kill();p.wait(timeout=10)
            assert Path('/etc/open-habitat/maintenance').exists()
            print('HOST_APPLY_INTERRUPTED '+phase,flush=True)
            return
        if e['event'] in ('error','cancelled','result'):
            raise RuntimeError('unexpected terminal before interruption '+line+p.stderr.read())
    raise RuntimeError('missing interruption '+phase+p.stderr.read())


def snapshot_broker():
    return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/var/lib/open-habitat/broker').glob('*.json')}


def drop(uid):
    def child():
        os.setgroups([]);os.setgid(uid);os.setuid(uid)
    return child


def ensure(subject,name,allowed=True):
    request={'version':1,'operation':'ensure','provider':'github','id':subject,'candidate':name,'default_limit_bytes':67108864}
    code='''import socket,struct,sys
s=socket.socket(socket.AF_UNIX);s.settimeout(100);s.connect('/run/open-habitat/broker.sock');b=sys.argv[1].encode();s.sendall(struct.pack('>I',len(b))+b);s.shutdown(socket.SHUT_WR)
h=s.recv(4);assert len(h)==4;n=struct.unpack('>I',h)[0];b=b''
while len(b)<n:
 p=s.recv(n-len(b));assert p;b+=p
print(b.decode())'''
    p=run('/usr/bin/python3','-c',code,json.dumps(request),preexec_fn=drop(21003))
    result=json.loads(p.stdout)
    if not allowed:
        assert result.get('failure')=='denied' and 'route' not in result,result
        return None
    assert 'route' in result,result
    assert result['route']['username']==name,result
    return result['route']['uid']


def daemons():
    for name in ('guestone','guesttwo'):
        uid=pwd.getpwnam(name).pw_uid
        run('systemctl','start','open-habitat-daemon@'+name+'.service')
        code='''import socket,sys
s=socket.socket(socket.AF_UNIX);s.settimeout(3);s.connect(sys.argv[1]);s.sendall(b'GET /agent/v1/environment HTTP/1.1\\r\\nHost: unix\\r\\nConnection: close\\r\\n\\r\\n');b=s.recv(1024);assert b.startswith(b'HTTP/1.1 200 '),b'''
        end=time.monotonic()+120
        while True:
            p=subprocess.run(['/usr/bin/python3','-c',code,'/run/open-habitat/users/'+name+'/agent.sock'],preexec_fn=drop(uid),text=True,capture_output=True,timeout=5)
            if p.returncode==0:break
            if time.monotonic()>end:
                print(run('journalctl','-u','open-habitat-daemon@'+name+'.service','--no-pager','-o','cat').stdout,flush=True)
                raise RuntimeError('daemon startup '+name+' '+p.stderr)
            time.sleep(.5)
        print('HOST_APPLY_NATIVE_DAEMON uid='+str(uid),flush=True)
        # Other kernel UIDs cannot traverse this person's private socket tree.
        other=pwd.getpwnam('guesttwo' if name=='guestone' else 'guestone').pw_uid
        denied=subprocess.run(['/usr/bin/python3','-c',code,'/run/open-habitat/users/'+name+'/agent.sock'],preexec_fn=drop(other),capture_output=True,timeout=5)
        assert denied.returncode!=0


def tls_status():
    end=time.monotonic()+45
    while True:
        c=http.client.HTTPSConnection('127.0.0.1',8443,context=ssl._create_unverified_context(),timeout=5)
        try:
            c.request('GET','/');r=c.getresponse();return r.status
        except OSError:
            if time.monotonic()>end:raise
            time.sleep(.2)
        finally:
            c.close()


def proof():
    ROOT.mkdir(mode=0o700,exist_ok=True)
    Path('/mnt/product').mkdir(exist_ok=True)
    if not Path('/mnt/product/bin/open-habitat').exists():run('mount','-o','ro','/dev/disk/by-label/PRODUCT','/mnt/product')
    if (ROOT/'reboot').exists():
        # A true subsequent boot; no preparation/apply repairs precede checks.
        first=(ROOT/'boot-id').read_text();assert first!=Path('/proc/sys/kernel/random/boot_id').read_text()
        for unit in ('open-habitat-proc.service','open-habitat-broker.service','open-habitat-gateway.service'):
            end=time.monotonic()+120
            while subprocess.run(['systemctl','is-active','--quiet',unit]).returncode!=0:
                if time.monotonic()>end:raise RuntimeError('cold unit '+unit)
                time.sleep(.5)
        run(BIN,'boot-storage-check')
        assert not Path('/etc/open-habitat/maintenance').exists()
        assert tls_status()==200
        daemons()
        # Read-only health and same-input repeat after reboot.
        cli('host','check','--site',SITE,'--json')
        assert live((ROOT/'last-plan').read_text())['outcome']=='no_change'
        receipt={'status':'passed','fresh_install':True,'repeat_no_change':True,'stale_refused':True,'interrupted_continuation':True,'broker_not_reseeded':True,'cold_reboot':True,'native_daemon_uids':[pwd.getpwnam(n).pw_uid for n in ('guestone','guesttwo')],'browser_signin':False,'quota_default_readback':True,'quota_override_preserved':True,'administrators_deferred_then_granted':True,'admission_remove_and_readmit':True,'pid1':Path('/proc/1/comm').read_text().strip()}
        print('HOST_APPLY_RECEIPT '+json.dumps(receipt,sort_keys=True),flush=True)
        print('HOST_APPLY_PASS',flush=True)
        run('systemctl','poweroff','--no-block');return
    for module in ('quota_tree','quota_v2'):
        kernel=os.uname().release
        dst=Path('/lib/modules')/kernel/'kernel/fs/quota'/(module+'.ko.zst')
        dst.parent.mkdir(parents=True,exist_ok=True)
        dst.write_bytes((Path('/mnt/product')/(module+'.ko.zst')).read_bytes())
    run('depmod','-a');run('modprobe','quota_v2')
    Path('/etc/modules-load.d/fixture-quota.conf').write_text('quota_v2\n')
    run('udevadm','settle')
    devices=glob.glob('/dev/disk/by-id/*oh-quota-home');assert len(devices)==1,devices
    run('mkfs.ext4','-F','-O','quota','-E','quotatype=usrquota',devices[0]);run('udevadm','settle')
    uuid=run('blkid','-s','UUID','-o','value',devices[0]).stdout.strip()
    Path('/etc/fstab').open('a').write('UUID='+uuid+' /home ext4 defaults,usrquota 0 2\n')
    run('mount','/home')
    Path('/etc/open-habitat').mkdir(exist_ok=True)
    run('openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout','/etc/open-habitat/fixture.key','-out','/etc/open-habitat/fixture.crt','-days','1','-subj','/CN=host.invalid')
    Path('/etc/open-habitat/fixture-secret').write_text('synthetic-not-a-real-oauth-secret')
    for name in ('fixture.key','fixture.crt','fixture-secret'):Path('/etc/open-habitat/'+name).chmod(0o600)
    target=json.loads(Path('/etc/fixture-target.json').read_text())
    site={'schema_version':1,'site_id':'fixture-site','release':{'version':target['version'],'manifest_sha256':target['manifest_sha256']},'gateway':{'uid':21003,'gid':21003,'listen':'127.0.0.1:8443','origin':'https://host.invalid','oauth_callback':'https://host.invalid/auth/github/callback','oauth_client_id':'fictional-client','oauth_secret_file':'/etc/open-habitat/fixture-secret','tls_cert_file':'/etc/open-habitat/fixture.crt','tls_key_file':'/etc/open-habitat/fixture.key'},'identities':{'uid_min':21032,'uid_max':21035,'admission':['42','43'],'administrators':['42']},'storage':{'home_uuid':uuid,'filesystem':'ext4','enforce_user_quota':True,'default_limit_bytes':67108864},'profiles':['core']}
    Path(SITE).write_text(json.dumps(site));Path(SITE).chmod(0o600)
    # Incoming runtime and trust were independently delivered; the product never
    # downloads a tool, opens a cloud API or runs Fleetrepo in this guest.
    Path('/var/lib/open-habitat').mkdir(exist_ok=True)
    run('mkdir','-p','/var/lib/open-habitat/release')
    for name in ('release.json','release.sig','core.tar.gz'):
        import shutil
        shutil.copyfile('/mnt/product/release/'+name,'/var/lib/open-habitat/release/'+name)
        Path('/var/lib/open-habitat/release/'+name).chmod(0o644)
    p=preview('prepare');assert live(p,'prepare')['outcome']=='prepared'
    plan=preview()
    stale=cli('host','apply','--site',SITE,'--approved-plan','0'*64,'--output=jsonl',code=1)
    assert json.loads(stale.stdout.splitlines()[-1])['code']=='stale_plan'
    interrupted(plan,'staging')
    interrupted(plan,'activating')
    before=snapshot_broker();assert 'bindings.json' in before
    interrupted(plan,'converging')
    assert tls_status()==503
    result=live(plan);assert result['outcome']=='applied',result
    assert result['administrators']==[{'subject':'42','outcome':'deferred_until_bound'}],result
    assert before==snapshot_broker(),'broker seed changed on continuation'
    assert tls_status()==200
    times={str(p):p.stat().st_mtime_ns for p in Path('/var/lib/open-habitat/host').glob('*')}
    assert live(plan)['outcome']=='no_change'
    assert times=={str(p):p.stat().st_mtime_ns for p in Path('/var/lib/open-habitat/host').glob('*')}
    assert [ensure(s,n) for s,n in [('42','guestone'),('43','guesttwo')]]==[21032,21033]
    # Existing per-user quota overrides belong to the native administrative path.
    cli('admin','storage','update','43','--limit-bytes','33554432','--json')
    bound=snapshot_broker()
    plan=preview();result=live(plan)
    assert result['administrators']==[{'subject':'42','outcome':'granted'}],result
    assert bound==snapshot_broker(),'convergence rewrote committed broker state'
    settings=json.loads(cli('admin','settings','show','--json').stdout)['data'];assert settings['default_limit_bytes']==67108864 and settings['administrators']==['42'],settings
    quotas=json.loads(cli('admin','storage','list','--json').stdout)['data']
    assert {u['id']:u['limit_bytes'] for u in quotas['users'] if not u['unavailable']}=={'42':67108864,'43':33554432},quotas
    # Exercise real revoke-under-old-admission and broker-owned epoch observation.
    ledger=Path('/var/lib/open-habitat/broker/bindings.json').read_bytes()
    site['identities']['admission']=['42'];Path(SITE).write_text(json.dumps(site))
    live(preview());ensure('43','guesttwo',allowed=False)
    assert Path('/var/lib/open-habitat/broker/bindings.json').read_bytes()==ledger
    reduced=json.loads(Path('/var/lib/open-habitat/broker/allowlist.json').read_text())
    observed=json.loads(Path('/var/lib/open-habitat/broker/head.json').read_text())
    assert reduced['epoch']==observed['epoch']==2
    site['identities']['admission']=['42','43'];Path(SITE).write_text(json.dumps(site))
    plan=preview();live(plan);assert ensure('43','guesttwo')==21033
    assert Path('/var/lib/open-habitat/broker/bindings.json').read_bytes()==ledger
    quota_again=json.loads(cli('admin','storage','list','--json').stdout)['data']
    assert {u['id']:u['limit_bytes'] for u in quota_again['users'] if not u['unavailable']}=={'42':67108864,'43':33554432},quota_again
    observed=json.loads(Path('/var/lib/open-habitat/broker/head.json').read_text());assert observed['epoch']==3
    daemons()
    (ROOT/'boot-id').write_text(Path('/proc/sys/kernel/random/boot_id').read_text())
    (ROOT/'last-plan').write_text(plan);(ROOT/'reboot').write_text('ready')
    run('systemctl','enable','fixture-host-apply.service')
    print('HOST_APPLY_REBOOT',flush=True)
    run('systemctl','reboot','--no-block')

try:
    proof()
except BaseException:
    traceback.print_exc()
    for unit in ('open-habitat-broker.service','open-habitat-gateway.service','open-habitat-storage.service'):
        try: print(run('journalctl','-u',unit,'--no-pager','-o','cat').stdout,flush=True)
        except Exception: pass
    print('HOST_APPLY_FAIL',flush=True)
    subprocess.run(['systemctl','poweroff','--no-block'])
    raise
