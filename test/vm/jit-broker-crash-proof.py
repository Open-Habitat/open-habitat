#!/usr/bin/python3
"""One actual SIGKILL, after useradd and before any binding publication."""
import fcntl, hashlib, http.cookiejar, json, os, pathlib, pwd, socket, ssl, stat, struct, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

state=pathlib.Path('/var/lib/native-agent-host/broker')
base='https://host.fixture:8443'
result={'status':'failed','scope':'jit-broker-crash'}
def check(ok,why):
    if not ok:raise RuntimeError(why)
def command(*args):return subprocess.run(args,capture_output=True,timeout=45)
def unit(*args):return command('systemctl',*args)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args):return None
ctx=ssl.create_default_context(cafile='/etc/native-agent-host/fixture-ca.crt')
def browser():return urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),NoRedirect())
def get(op,path):
    try:
        with op.open(base+path,timeout=95) as r:return r.status,r.headers,r.read()
    except urllib.error.HTTPError as e:return e.code,e.headers,e.read()
def login(op,code):
    status,headers,_=get(op,'/auth/github/start');check(status==302,'oauth start')
    state_arg=urllib.parse.parse_qs(urllib.parse.urlparse(headers['Location']).query)['state'][0]
    return get(op,'/auth/github/callback?'+urllib.parse.urlencode({'state':state_arg,'code':code}))
def pid():return int(unit('show','-P','MainPID','native-agent-host-broker.service').stdout.strip())
def ensure_control(operation='ensure'):
    # Prepare the healthy binding before the private revocation socket exists.
    # This historical Fleetrepo gate rejects extra runtime paths on activation.
    code = """import json,socket,struct,sys
s=socket.socket(socket.AF_UNIX);s.settimeout(105);s.connect('/run/native-agent-host/broker.sock')
b=json.dumps({'version':1,'operation':sys.argv[1],'provider':'github','id':'100000001','candidate':'guestone'}).encode()
s.sendall(struct.pack('>I',len(b))+b);s.shutdown(socket.SHUT_WR)
h=s.recv(4);assert len(h)==4
n=struct.unpack('>I',h)[0];assert n<4096
b=b''
while len(b)<n:
 p=s.recv(n-len(b));assert p;b+=p
print(b.decode())
"""
    def drop():os.setgroups([]);os.setresgid(21003,21003,21003);os.setresuid(21003,21003,21003)
    p=subprocess.run(['/usr/bin/python3','-c',code,operation],preexec_fn=drop,capture_output=True,text=True,timeout=115)
    return json.loads(p.stdout) if p.returncode==0 else {'failure':'exchange_exit_'+str(p.returncode)}

provider=None
native=None
def as_uid(uid, code):
    def drop():os.setgroups([]);os.setresgid(uid,uid,uid);os.setresuid(uid,uid,uid)
    return subprocess.run(['/usr/bin/python3','-c',code],preexec_fn=drop,capture_output=True,timeout=8)
try:
    check(pathlib.Path('/proc/1/comm').read_text().strip()=='systemd','PID1')
    binary=pathlib.Path('/opt/native-agent-host/current/native-agent-host')
    check(hashlib.sha256(binary.read_bytes()).hexdigest()==pathlib.Path('/etc/native-agent-host/binary.sha256').read_text().strip(),'binary digest')
    check(json.loads((state/'bindings.json').read_text())['bindings']==[],'nonempty bindings')
    for name,uid in (('guestone',21032),('guesttwo',21033)):
        check(not any(u.pw_name==name or u.pw_uid==uid for u in pwd.getpwall()),'occupied pool')
    fd=os.open(state,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        fcntl.flock(fd,fcntl.LOCK_EX)
        nxt=state/'allowlist.json.next'
        with os.fdopen(os.open(nxt,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'w') as f:
            json.dump({'version':1,'epoch':2,'ids':[{'id':'100000001','alternate':'guestone'},{'id':'100000002','alternate':'guesttwo'}]},f)
            f.flush();os.fsync(f.fileno())
        nxt.replace(state/'allowlist.json');os.fsync(fd)
    finally:os.close(fd)
    prep='/usr/local/libexec/native-agent-host-test-jit/jit_acl_prepare.py'
    for step in ('preflight','prepare','verify'):
        check(command('/usr/bin/python3',prep,step,'--json').returncode==0,'policy '+step)
    check(unit('start','native-agent-host-broker.socket').returncode==0,'broker socket')
    control=ensure_control()
    if control.get('route') is None and not (state/'pending.json').exists() and json.loads((state/'bindings.json').read_text())['bindings']==[{'id':'100000001','uid':21032,'username':'guestone'}]:
        control=ensure_control()
    check(control.get('route',{}).get('uid')==21032 and control['route'].get('username')=='guestone','control broker route before revocation socket')
    check(unit('is-active','native-agent-host-daemon@guestone.socket').stdout.strip()==b'active','control socket inactive')
    config=pathlib.Path('/etc/native-agent-host/gateway.json');os.chown(config,0,21003);config.chmod(0o640)
    key=pathlib.Path('/etc/native-agent-host/tls.key');os.chown(key,0,21003);key.chmod(0o640)
    with open('/etc/hosts','a') as f:f.write('\n127.0.0.1 github.com api.github.com host.fixture\n')
    provider=subprocess.Popen(['/usr/bin/python3','/usr/local/sbin/product-fake-provider'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:socket.create_connection(('127.0.0.1',443),.5).close();break
        except OSError:time.sleep(.2)
    else:raise RuntimeError('provider')
    check(unit('start','product-gateway.socket').returncode==0,'revocation socket')
    check(unit('start','product-gateway.service').returncode==0,'gateway')
    gateway_observation='no response'
    for _ in range(100):
        try:
            gateway_observation=str(get(browser(),'/auth/session')[0])
            if gateway_observation=='401':break
        except OSError as e:gateway_observation=type(e).__name__
        time.sleep(.2)
    else:
        journal=command('journalctl','-u','product-gateway.service','-n','15','--no-pager','-o','cat').stdout.decode('utf-8','replace')
        codes=[]
        for line in journal.splitlines():
            try:
                entry=json.loads(line)
                if isinstance(entry,dict):
                    err=entry.get('error',{})
                    codes.append(str(err.get('code','') if isinstance(err,dict) else type(err).__name__)[:32])
            except (ValueError,AttributeError):pass
        props=unit('show','product-gateway.service','-p','Result,ExecMainCode,ExecMainStatus').stdout.decode().strip().replace('\n',',')
        import re
        lines=[]
        for line in journal.splitlines()[-6:]:
            if 'TOKEN_' in line or 'oauth_token' in line or 'secret' in line.lower():continue
            lines.append(re.sub('[^A-Za-z0-9 _./:=,-]',' ',line)[:120])
        raise RuntimeError('gateway not ready: '+gateway_observation+' unit='+unit('is-active','product-gateway.service').stdout.decode().strip()+' '+props+' codes='+','.join(codes)+' logs='+repr(lines)[:400])
    # Establish A first, so that a running native session survives the global
    # broker refusal; the pending journal deliberately makes NEW broker calls
    # fail for both users.
    other=browser();other_status,_,other_body=login(other,'a')
    if other_status!=303:
        # TCG can exceed the browser's 90-second ensure budget even after the
        # broker has durably committed the healthy control identity. A fresh
        # callback may authorize that existing binding; never retry a pending
        # or uncommitted allocation.
        existing=json.loads((state/'bindings.json').read_text())['bindings']
        if existing==[{'id':'100000001','uid':21032,'username':'guestone'}] and not (state/'pending.json').exists():
            other=browser();other_status,_,other_body=login(other,'a')
    if other_status!=303:
        try: failure_code=json.loads(other_body).get('error',{}).get('code','unknown')
        except (ValueError,AttributeError):failure_code='non_json'
        pending=state/'pending.json'
        try: pending_phase=json.loads(pending.read_text()).get('phase') if pending.is_file() else 'absent'
        except (OSError,ValueError):pending_phase='unreadable'
        broker_log=command('journalctl','-u','native-agent-host-broker.service','-n','15','--no-pager','-o','cat').stdout.decode('utf-8','replace')
        broker_codes=[]
        for line in broker_log.splitlines():
            try:
                obj=json.loads(line)
                if isinstance(obj,dict):broker_codes.append(str(obj.get('stage',obj.get('error',{})))[:60])
            except (ValueError,AttributeError):pass
        gateway_log=command('journalctl','-u','product-gateway.service','-n','40','--no-pager','-o','cat').stdout.decode('utf-8','replace')
        broker_events=[]
        for line in gateway_log.splitlines():
            try:
                event=json.loads(line)
                if event.get('reason')=='broker_denied':broker_events.append(str(event.get('broker_operation'))+':'+str(event.get('broker_reason')))
            except (ValueError,AttributeError):pass
        bindings=json.loads((state/'bindings.json').read_text())['bindings']
        raise RuntimeError('A login status '+str(other_status)+' code '+str(failure_code)[:60]+' pending='+str(pending_phase)[:20]+' broker='+unit('is-active','native-agent-host-broker.service').stdout.decode().strip()+' account='+str(any(u.pw_name=='guestone' for u in pwd.getpwall()))+' bindings='+str(len(bindings))+' codes='+','.join(broker_codes)+' events='+','.join(broker_events))
    baseline_session,_,_=get(other,'/auth/session')
    baseline_snapshot,_,_=get(other,'/api/v1/onboarding/pi/status')
    check(baseline_session==200 and baseline_snapshot==200,'A baseline session='+str(baseline_session)+' snapshot='+str(baseline_snapshot))
    before=json.loads((state/'bindings.json').read_text())
    check(before['bindings']==[{'id':'100000001','uid':21032,'username':'guestone'}],'A binding')
    check(pid()>1,'broker not running immediately before fault')
    def drop_control():os.setgroups([]);os.setresgid(21032,21032,21032);os.setresuid(21032,21032,21032)
    native=subprocess.Popen(['/usr/bin/sleep','300'],preexec_fn=drop_control,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    check(native.poll() is None and as_uid(21032,"open('/home/guestone/fixture-native','w').write('alive')").returncode==0,'control native baseline')
    marker=pathlib.Path('/run/nah-guest-broker-crash')
    marker.write_text('account\n');marker.chmod(0o600)
    affected=browser()
    callback_status,_,body=login(affected,'b')
    check(callback_status in (403,503),'crash callback issued route/session: '+str(callback_status))
    check(pid()==0,'broker survived SIGKILL')
    service=unit('show','native-agent-host-broker.service','-p','Result,ExecMainCode,ExecMainStatus').stdout.decode()
    props=dict(line.split('=',1) for line in service.splitlines() if line.count('=')==1)
    check(props.get('Result')=='signal' and props.get('ExecMainCode')=='2' and props.get('ExecMainStatus')=='9','no observed SIGKILL termination')
    journal=state/'pending.json'
    check(journal.is_file() and json.loads(journal.read_text()).get('phase')=='account','account journal missing')
    check(pwd.getpwnam('guesttwo').pw_uid==21033,'account not created')
    check(json.loads((state/'bindings.json').read_text())==before,'binding changed')
    check(not pathlib.Path('/home/guesttwo').exists() and not pathlib.Path('/etc/omega-habitat/daemon/user-mappings/daemon-guesttwo.json').exists(),'executor advanced after crash')
    pending=journal.read_bytes()
    # Real systemd activation must launch a *new* broker and be refused by
    # Writer.Startup; socket remains available but cannot issue a reply.
    unit('reset-failed','native-agent-host-broker.service')
    prior_invocation=unit('show','-P','InvocationID','native-agent-host-broker.service').stdout.strip()
    restart=unit('start','native-agent-host-broker.service')
    # Type=simple may report successful start before ServeBroker.Startup exits.
    for _ in range(50):
        if pid()==0 and unit('is-active','native-agent-host-broker.service').stdout.strip() in (b'failed',b'inactive'):break
        time.sleep(.1)
    next_invocation=unit('show','-P','InvocationID','native-agent-host-broker.service').stdout.strip()
    check(next_invocation and next_invocation!=prior_invocation and pid()==0 and
          unit('show','-P','Result','native-agent-host-broker.service').stdout.strip()==b'exit-code',
          'broker restart accepted pending journal (start='+str(restart.returncode)+')')
    refusal_log=command('journalctl','_SYSTEMD_INVOCATION_ID='+next_invocation.decode('ascii'),'-u',
                        'native-agent-host-broker.service','--no-pager','-o','cat').stdout
    all_refusal_log=command('journalctl','-u','native-agent-host-broker.service','--no-pager','-o','cat').stdout
    check(refusal_log.count(b'NAH_GUEST_PENDING_REFUSED')==1,
          'new broker invocation did not report pending startup guard filtered='+str(refusal_log.count(b'NAH_GUEST_PENDING_REFUSED'))+' all='+str(all_refusal_log.count(b'NAH_GUEST_PENDING_REFUSED'))+' lines='+str(len(all_refusal_log.splitlines())))
    check(journal.read_bytes()==pending,'restart cleared or rewrote journal')
    session_status,_,_=get(affected,'/auth/session')
    snapshot_status,_,_=get(affected,'/api/v1/snapshot')
    check(session_status==401 and snapshot_status==401,'B browser session/route issued')
    other_session_status,_,_=get(other,'/auth/session')
    other_snapshot_status,_,_=get(other,'/api/v1/onboarding/pi/status')
    # Writer's pending guard intentionally denies ALL browser routes, even
    # the healthy sibling. Its native process and DAC boundary still live.
    check(other_session_status==401 and other_snapshot_status==401,'global browser refusal missing')
    check(native.poll() is None,'control native process stopped')
    check(as_uid(21032,"assert open('/home/guestone/fixture-native').read()=='alive'").returncode==0,'control native home unavailable')
    check(as_uid(21033,"open('/home/guestone/fixture-native').read()").returncode!=0,'partial account read sibling home')
    check(json.loads((state/'bindings.json').read_text())==before and journal.read_bytes()==pending,'state mutated after restart')
    print('VM_PHASE=account',flush=True)
    result.update(status='passed',pid1='systemd',phase='account',real_sigkill=True,account_exists=True,
        pending_retained=True,restart_refused=True,no_route=True,no_session=True,no_executor_after_crash=True,
        other_user_native_unaffected=True,callback_status=callback_status,session_status=session_status,
        other_session_status=other_session_status,other_snapshot_status=other_snapshot_status)
except Exception as exc:
    result['reason']=str(exc)[:220]
finally:
    if native is not None:
        native.terminate()
        try:native.wait(timeout=3)
        except subprocess.TimeoutExpired:native.kill();native.wait()
    if provider is not None:provider.terminate()
    print('VM_PROOF='+json.dumps(result),flush=True)
    subprocess.run(['systemd-run','--on-active=15s','--unit=jit-shutdown','/usr/bin/systemctl','poweroff','--no-block'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
if result['status']!='passed':sys.exit(1)
