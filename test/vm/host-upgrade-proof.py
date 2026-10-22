#!/usr/bin/python3
"""Disposable guest: reuse production apply journey, then named upgrade and reboot."""
import datetime
import hashlib
import http.client
import importlib.util
import json
import os
from pathlib import Path
import pwd
import shutil
import signal
import ssl
import subprocess
import time
import traceback

Path('/mnt/product').mkdir(exist_ok=True)
if not Path('/mnt/product/apply-proof.py').exists():
    subprocess.run(['mount','-o','ro','/dev/disk/by-label/PRODUCT','/mnt/product'],check=True)
spec=importlib.util.spec_from_file_location('apply_fixture','/mnt/product/apply-proof.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
ROOT=a.ROOT
PACKAGE='/mnt/product/upgrade/bin/open-habitat'
OWNER=None
PLAN=None
COOKIE='s'*43  # Synthetic credential only; never emitted to the receipt/serial.


def cli(binary,*args,code=0):
    p=subprocess.run([binary,*args],text=True,capture_output=True,timeout=900)
    if p.returncode!=code:
        print(p.stdout,flush=True);print(p.stderr,flush=True)
        raise RuntimeError('upgrade CLI exit '+str(p.returncode)+' expected '+str(code))
    return p


def flags(interruption=True):
    return ['host','upgrade','--site',a.SITE,'--approved-plan',PLAN,'--approve-maintenance',*(['--approve-interruption'] if interruption else []),'--output=jsonl']


def live(binary= None):
    p=cli(binary or OWNER,*flags())
    events=[json.loads(s) for s in p.stdout.splitlines()]
    assert events[-1]['event']=='result',events
    assert [e['seq'] for e in events]==list(range(1,len(events)+1)),events
    return events[-1]['data']


def interrupted(phase):
    p=subprocess.Popen([OWNER,*flags()],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    for line in p.stdout:
        e=json.loads(line)
        if e['event']=='progress' and e['phase']==phase:
            p.kill();p.wait(timeout=10)
            print('HOST_UPGRADE_INTERRUPTED '+phase,flush=True)
            return
        if e['event'] in ('error','cancelled','result'):
            raise RuntimeError('unexpected terminal before '+phase+' '+line+p.stderr.read())
    raise RuntimeError('missing upgrade phase '+phase+p.stderr.read())


def interrupted_after_open():
    p=subprocess.Popen([OWNER,*flags()],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    end=time.monotonic()+900
    while p.poll() is None:
        active=Path('/var/lib/open-habitat/host/active.json')
        try:
            op=json.loads(active.read_text())
            accepted=active.parent/(op['id']+'-upgrade-accepted.json')
            if accepted.exists() and not Path('/etc/open-habitat/maintenance').exists() and not Path('/etc/open-habitat/upgrade-closed').exists():
                p.kill();p.wait(timeout=10)
                assert json.loads(active.read_text())['status']=='running'
                print('HOST_UPGRADE_INTERRUPTED after_open',flush=True)
                return
        except FileNotFoundError:pass
        if time.monotonic()>end:
            p.kill();p.wait(timeout=10);raise RuntimeError('missing durable post-open checkpoint')
        time.sleep(.02)
    raise RuntimeError('upgrade finished before post-open checkpoint '+p.stdout.read()+p.stderr.read())


def user_run(name,*args):
    uid=pwd.getpwnam(name).pw_uid
    env={'PATH':'/usr/bin:/bin','HOME':'/home/'+name,'USER':name,'LOGNAME':name,'LANG':'C','XDG_RUNTIME_DIR':'/run/user/'+str(uid),'DBUS_SESSION_BUS_ADDRESS':'unix:path=/run/user/'+str(uid)+'/bus'}
    return a.run(*args,env=env,preexec_fn=a.drop(uid))


def session_status():
    end=time.monotonic()+90
    while True:
        c=http.client.HTTPSConnection('127.0.0.1',8443,context=ssl._create_unverified_context(),timeout=10)
        try:
            c.request('GET','/auth/session',headers={'Host':'host.invalid','Cookie':'__Host-agent-host='+COOKIE})
            r=c.getresponse();return r.status
        except OSError:
            if time.monotonic()>end:raise
            time.sleep(.3)
        finally:c.close()


def native_state():
    return {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in (Path('/home/guestone/preserved'),Path('/home/guesttwo/preserved'),Path('/home/guestone/.pi/agent/sessions/fixture.jsonl'))}


def before():
    global PLAN,OWNER
    # A valid synthetic browser session using real broker-created identity. No
    # OAuth/provider call or customer credential is used or claimed.
    a.run('systemctl','stop','open-habitat-gateway.service')
    now=datetime.datetime.now(datetime.timezone.utc)
    def stamp(d):return d.isoformat().replace('+00:00','Z')
    record={'identity':{'provider':'github','subject':'42','uid':21032,'username':'guestone','socket':'/run/open-habitat/users/guestone/daemon.sock'},'profile':{},'access_email':'','csrf':'synthetic-csrf','idle':stamp(now+datetime.timedelta(days=90)),'absolute':stamp(now+datetime.timedelta(days=364)),'id':'a'*22,'method':'github','device':'Linux · Firefox','created':stamp(now),'github_at':stamp(now)}
    path=Path('/var/lib/open-habitat-gateway/sessions.json')
    path.write_text(json.dumps({'version':2,'sessions':{hashlib.sha256(COOKIE.encode()).hexdigest():record}}));path.chmod(0o600);os.chown(path,21003,21004)
    a.run('systemctl','start','open-habitat-gateway.service')
    assert session_status()==200
    for name in ('guestone','guesttwo'):
        user_run(name,'/usr/bin/python3','-c',"from pathlib import Path;p=Path.home()/'preserved';p.write_text('synthetic native home state\\n')")
    user_run('guestone','/usr/bin/python3','-c',"from pathlib import Path;p=Path.home()/'.pi/agent/sessions/fixture.jsonl';p.parent.mkdir(parents=True,exist_ok=True);p.write_text('{\"type\":\"session\",\"version\":3,\"id\":\"synthetic-upgrade\",\"cwd\":\"/home/guestone\",\"timestamp\":\"2026-01-01T00:00:00Z\"}\\n')")
    unit=Path('/etc/systemd/user/fixture-upgrade.service');unit.parent.mkdir(parents=True,exist_ok=True)
    unit.write_text('[Unit]\nDescription=Synthetic persistent upgrade workload\n[Service]\nExecStart=/bin/sleep infinity\n[Install]\nWantedBy=default.target\n')
    user_run('guestone','/usr/bin/systemctl','--user','daemon-reload')
    user_run('guestone','/usr/bin/systemctl','--user','enable','--now','fixture-upgrade.service')
    baseline={'user_service_pid':user_run('guestone','/usr/bin/systemctl','--user','show','--value','--property=MainPID','fixture-upgrade.service').stdout.strip(),'broker':a.snapshot_broker(),'native':native_state(),'sessions':hashlib.sha256(path.read_bytes()).hexdigest(),'admin':hashlib.sha256(Path('/var/lib/open-habitat-gateway/administration.json').read_bytes()).hexdigest()}
    (ROOT/'upgrade-baseline.json').write_text(json.dumps(baseline))
    old=os.readlink('/opt/open-habitat/current')
    incoming=Path('/var/lib/open-habitat/release')
    for name in ('release.json','release.sig','core.tar.gz'):shutil.copyfile('/mnt/product/upgrade/release/'+name,incoming/name)
    manifest=json.loads((incoming/'release.json').read_text())
    site=json.loads(Path(a.SITE).read_text());site['release']={'version':manifest['version'],'manifest_sha256':hashlib.sha256((incoming/'release.json').read_bytes()).hexdigest()};Path(a.SITE).write_text(json.dumps(site))
    result=json.loads(cli(PACKAGE,'host','upgrade','--site',a.SITE,'--dry-run','--json').stdout)['data']
    assert result['plan']['approvable'],result
    PLAN=result['plan']['plan_id'];OWNER=result['plan']['owner_binary']
    stale=flags();stale[stale.index(PLAN)]='0'*64
    assert json.loads(cli(PACKAGE,*stale,code=1).stdout.splitlines()[-1])['code']=='stale_plan'
    # Authenticated archive failure must not close entry or publish a journal.
    (incoming/'core.tar.gz').write_bytes(b'bad archive')
    bad=subprocess.run([PACKAGE,*flags()],text=True,capture_output=True,timeout=900)
    assert bad.returncode!=0
    assert os.readlink('/opt/open-habitat/current')==old and a.tls_status()==200
    assert not Path('/etc/open-habitat/maintenance').exists()
    shutil.copyfile('/mnt/product/upgrade/release/core.tar.gz',incoming/'core.tar.gz')
    result=live(PACKAGE);assert result['outcome']=='staged',result
    assert os.readlink('/opt/open-habitat/current')==old
    # Interrupt quiescence and switch intent, then prove a real cold boot
    # refuses both listeners while the writer and its kernel lease are dead.
    interrupted('activating')
    (ROOT/'upgrade-owner').write_text(OWNER);(ROOT/'upgrade-plan').write_text(PLAN)
    (ROOT/'boot-id').write_text(Path('/proc/sys/kernel/random/boot_id').read_text())
    (ROOT/'reboot').write_text('ready');(ROOT/'interrupted-reboot').write_text('ready')
    a.run('systemctl','enable','fixture-host-apply.service')
    print('HOST_UPGRADE_CLOSED_REBOOT',flush=True)
    a.run('systemctl','reboot','--no-block');os._exit(0)


def finish_upgrade():
    baseline=json.loads((ROOT/'upgrade-baseline.json').read_text())
    path=Path('/var/lib/open-habitat-gateway/sessions.json')
    record=next(iter(json.loads(path.read_text())['sessions'].values()))
    for phase in ('verifying','verified'):interrupted(phase)
    interrupted_after_open()
    assert native_state()==baseline['native'] and a.snapshot_broker()==baseline['broker']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==baseline['sessions']
    assert hashlib.sha256(Path('/var/lib/open-habitat-gateway/administration.json').read_bytes()).hexdigest()==baseline['admin']
    # Legitimate administration changes in the reopen/completion window must
    # survive accepted recovery, including a returned-failure-like consumer stop.
    cli(OWNER,'admin','settings','update','--default-limit-bytes','134217728','--json')
    cli(OWNER,'admin','role','update','42','--administrator','false','--json')
    admin_after=hashlib.sha256(Path('/var/lib/open-habitat-gateway/administration.json').read_bytes()).hexdigest()
    service_pid=user_run('guestone','/usr/bin/systemctl','--user','show','--value','--property=MainPID','fixture-upgrade.service').stdout.strip()
    a.run('systemctl','stop','open-habitat-gateway.service','open-habitat-broker.service','open-habitat-daemon@guestone.service','open-habitat-daemon@guesttwo.service')
    result=live();assert result['outcome']=='upgraded',result
    assert live()['outcome']=='no_change'
    assert user_run('guestone','/usr/bin/systemctl','--user','show','--value','--property=MainPID','fixture-upgrade.service').stdout.strip()==service_pid
    settings=json.loads(cli(OWNER,'admin','settings','show','--json').stdout)['data']
    assert settings['default_limit_bytes']==134217728 and settings['administrators']==[],settings
    assert hashlib.sha256(Path('/var/lib/open-habitat-gateway/administration.json').read_bytes()).hexdigest()==admin_after
    assert session_status()==200
    user_run('guestone','/usr/bin/systemctl','--user','is-active','--quiet','fixture-upgrade.service')
    assert user_run('guestone','/usr/bin/systemctl','--user','show','--value','--property=MainPID','fixture-upgrade.service').stdout.strip()!=baseline['user_service_pid']
    # Ordinary live session changes after acceptance must not turn a healthy
    # exact retry into recovery or restore an older private session snapshot.
    a.run('systemctl','stop','open-habitat-gateway.service')
    sessions=json.loads(path.read_text());second=dict(record);second['id']='b'*22
    sessions['sessions'][hashlib.sha256(('t'*43).encode()).hexdigest()]=second
    path.write_text(json.dumps(sessions));path.chmod(0o600);os.chown(path,21003,21004)
    a.run('systemctl','start','open-habitat-gateway.service')
    assert session_status()==200
    assert live()['outcome']=='no_change'
    assert not Path('/etc/open-habitat/upgrade-closed').exists()
    (ROOT/'upgrade-owner').write_text(OWNER);(ROOT/'upgrade-plan').write_text(PLAN)



def final_quiescing_boundary():
    global OWNER,PLAN
    accepted_owner,accepted_plan=OWNER,PLAN
    package='/mnt/product/upgrade/negative/bin/open-habitat'
    incoming=Path('/var/lib/open-habitat/release')
    for name in ('release.json','release.sig','core.tar.gz'):shutil.copyfile('/mnt/product/upgrade/negative/release/'+name,incoming/name)
    manifest=json.loads((incoming/'release.json').read_text())
    site=json.loads(Path(a.SITE).read_text())
    site['release']={'version':manifest['version'],'manifest_sha256':hashlib.sha256((incoming/'release.json').read_bytes()).hexdigest()}
    site['storage']['default_limit_bytes']=134217728;site['identities']['administrators']=[]
    Path(a.SITE).write_text(json.dumps(site))
    plan=json.loads(cli(package,'host','upgrade','--site',a.SITE,'--dry-run','--json').stdout)['data']['plan']
    assert plan['approvable'],plan
    OWNER=plan['owner_binary'];PLAN=plan['plan_id']
    assert live(package)['outcome']=='staged'
    before_broker=a.snapshot_broker();before_native=native_state()
    interrupted('quiescing')
    result=subprocess.run([OWNER,*flags()],text=True,capture_output=True,timeout=1200)
    events=[json.loads(line) for line in result.stdout.splitlines()]
    terminal=events[-1]
    if result.returncode==0:
        assert terminal['event']=='result' and terminal['data']['outcome']=='upgraded',terminal
        outcome='resumed'
    else:
        assert terminal['event']=='error' and terminal['code']=='recovery_required',terminal
        outcome='recovery_required'
        for parent in ('/etc/open-habitat','/var/lib/open-habitat/host'):
            for pending in Path(parent).glob('*.next'):
                st=pending.lstat();print('HOST_UPGRADE_EXPECTED_PENDING '+json.dumps({'path':str(pending),'size':st.st_size,'mode':oct(st.st_mode & 0o7777),'uid':st.st_uid}),flush=True)
        operation=terminal['data']['operation']
        assert operation['schema_version']==2 and operation['owner_generation']==site['release']['manifest_sha256'],operation
        # No repair of ambiguous publication. The production cold gate must
        # deny either a published or an unpublished close marker without lease.
        guard=cli(OWNER,'boot-storage-check',code=1)
        assert 'upgrade_closed' in guard.stderr or 'upgrade_fence_unavailable' in guard.stderr,guard.stderr
    assert a.snapshot_broker()==before_broker and native_state()==before_native
    OWNER,PLAN=accepted_owner,accepted_plan
    return outcome


def after():
    global OWNER,PLAN
    OWNER=(ROOT/'upgrade-owner').read_text();PLAN=(ROOT/'upgrade-plan').read_text()
    if (ROOT/'interrupted-reboot').exists():
        assert (ROOT/'boot-id').read_text()!=Path('/proc/sys/kernel/random/boot_id').read_text()
        assert Path('/etc/open-habitat/maintenance').exists() and Path('/etc/open-habitat/upgrade-closed').exists()
        for unit in ('open-habitat-broker.service','open-habitat-gateway.service','open-habitat-daemon@guestone.socket','open-habitat-agent@guestone.socket'):
            assert subprocess.run(['systemctl','is-active','--quiet',unit]).returncode!=0,unit
        guard=cli(OWNER,'boot-storage-check',code=1)
        assert 'upgrade_closed' in guard.stderr,guard.stderr
        for socket_name in ('daemon.sock','agent.sock'):
            code="import socket,sys;s=socket.socket(socket.AF_UNIX);s.settimeout(3);s.connect(sys.argv[1])"
            probe=subprocess.run(['/usr/bin/python3','-c',code,'/run/open-habitat/users/guestone/'+socket_name],preexec_fn=a.drop(21032),capture_output=True,timeout=5)
            assert probe.returncode!=0,socket_name
        user_run('guestone','/usr/bin/tmux','-L','upgrade-fixture','new-session','-d','-s','preserve','/bin/sleep 3600')
        native_pid=user_run('guestone','/usr/bin/tmux','-L','upgrade-fixture','display-message','-p','-t','preserve','#{pane_pid}').stdout.strip()
        finish_upgrade()
        assert user_run('guestone','/usr/bin/tmux','-L','upgrade-fixture','display-message','-p','-t','preserve','#{pane_pid}').stdout.strip()==native_pid

        (ROOT/'interrupted-reboot').unlink()
        (ROOT/'boot-id').write_text(Path('/proc/sys/kernel/random/boot_id').read_text())
        print('HOST_UPGRADE_HEALTHY_REBOOT',flush=True)
        a.run('systemctl','reboot','--no-block');os._exit(0)
    assert (ROOT/'boot-id').read_text()!=Path('/proc/sys/kernel/random/boot_id').read_text()
    for unit in ('open-habitat-broker.service','open-habitat-gateway.service'):
        end=time.monotonic()+120
        while subprocess.run(['systemctl','is-active','--quiet',unit]).returncode!=0:
            if time.monotonic()>end:raise RuntimeError('cold unit '+unit)
            time.sleep(.5)
    a.daemons();assert a.tls_status()==200 and session_status()==200
    baseline=json.loads((ROOT/'upgrade-baseline.json').read_text())
    assert native_state()==baseline['native'] and a.snapshot_broker()==baseline['broker']
    user_run('guestone','/usr/bin/systemctl','--user','is-active','--quiet','fixture-upgrade.service')
    assert live()['outcome']=='no_change'
    print('HOST_UPGRADE_ACCEPTED_TARGET_HEALTHY',flush=True)
    quiescing_outcome=final_quiescing_boundary()
    receipt={'status':'passed','quiescing_boundary_outcome':quiescing_outcome,'accepted_target_cold_boot_healthy':True,'final_guest_state':'intentional_negative_transition','fresh_to_successor':True,'phase_sigkills':['activating','verifying','verified'],'preactivation_failure_predecessor_serving':True,'stale_refused':True,'immutable_owner':True,'two_native_uids':[21032,21033],'cold_reboot':True,'closed_reboot_refused':True,'after_open_sigkill':True,'unrelated_native_session_preserved':True,'accepted_recovery_restarts_consumers':True,'post_acceptance_admin_mutation_no_change':True,'homes_preserved':True,'native_session_preserved':True,'browser_session_preserved':True,'broker_identity_admission_preserved':True,'admin_preserved':True,'persistent_user_service_preserved':True,'gateway_gid_distinct':True,'post_acceptance_session_mutation_no_change':True,'user_service_restarted':True,'provider_call':False,'accepted_product_sha256':hashlib.sha256(Path(OWNER).read_bytes()).hexdigest(),'accepted_target_manifest_sha256':Path(OWNER).parent.name}
    print('HOST_UPGRADE_RECEIPT '+json.dumps(receipt,sort_keys=True),flush=True)
    print('HOST_UPGRADE_PASS',flush=True)

try:
    a.proof(before,after,gateway_gid=21004,compact_install=True)
except BaseException:
    traceback.print_exc()
    for parent in ('/etc/open-habitat','/etc/open-habitat/gateway','/var/lib/open-habitat/host','/opt/open-habitat'):
        for path in Path(parent).glob('*.next'):
            try:
                st=path.lstat();print('HOST_UPGRADE_PENDING '+json.dumps({'path':str(path),'size':st.st_size,'mode':oct(st.st_mode & 0o7777),'uid':st.st_uid,'gid':st.st_gid}),flush=True)
            except OSError:pass

    for unit in ('open-habitat-broker.service','open-habitat-gateway.service','open-habitat-storage.service'):
        try:print(a.run('journalctl','-u',unit,'--no-pager','-o','cat').stdout,flush=True)
        except Exception:pass
    print('HOST_UPGRADE_FAIL',flush=True)
    subprocess.run(['systemctl','poweroff','--no-block'])
    raise
