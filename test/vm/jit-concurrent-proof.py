#!/usr/bin/python3
"""Simultaneous first-login HTTP callbacks through the real gateway and broker."""
import concurrent.futures, fcntl, grp, hashlib, http.cookiejar, json, os, pathlib, pwd, socket, ssl, stat, subprocess, time, urllib.error, urllib.parse, urllib.request

base='https://host.fixture:8443'
ledger=pathlib.Path('/var/lib/native-agent-host/broker')
identities=[('a','guestone',21032,'100000001'),('b','guesttwo',21033,'100000002'),('c','guestthree',21034,'100000003')]
result={'status':'failed','scope':'jit-concurrent'}
provider=None

def check(ok, label):
    if not ok: raise RuntimeError(label)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args): return None

ctx=ssl.create_default_context(cafile='/etc/native-agent-host/fixture-ca.crt')
def browser():
    jar=http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx),urllib.request.HTTPCookieProcessor(jar),NoRedirect()),jar

def get(op,path):
    try:
        with op.open(base+path,timeout=90) as r:return r.status,r.headers,r.read()
    except urllib.error.HTTPError as e:return e.code,e.headers,e.read()

def start():
    op,jar=browser();status,headers,_=get(op,'/auth/github/start')
    check(status==302,'start')
    q=urllib.parse.parse_qs(urllib.parse.urlparse(headers['Location']).query)
    check(urllib.parse.urlparse(headers['Location']).hostname=='github.com' and q.get('code_challenge_method')==['S256'],'PKCE')
    return op,jar,q['state'][0]

def callback(flow,code):
    op,jar,state=flow
    status,headers,body=get(op,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':code}))
    return status,body

def binding():return json.loads((ledger/'bindings.json').read_text())['bindings']

def route(flow,name,others):
    op,_,_=flow
    status,_,body=get(op,'/auth/session');check(status==200,'session not authorized')
    status,_,body=get(op,'/api/v1/snapshot');check(status==200,'snapshot route unavailable')
    # A fresh daemon may have no workspaces, but must not show another UID.
    check(all(('/home/'+other).encode() not in body for other in others),'foreign path routed')
    return status

def deny(uid,path):
    def drop():os.setgroups([]);os.setresgid(uid,uid,uid);os.setresuid(uid,uid,uid)
    p=subprocess.run(['/usr/bin/python3','-c','import os,socket,sys; p=sys.argv[1]; os.listdir(p) if p.startswith("/home/") else socket.socket(socket.AF_UNIX).connect(p)',path],preexec_fn=drop,capture_output=True,timeout=5)
    return p.returncode!=0 and b'PermissionError' in p.stderr

try:
    check(pathlib.Path('/proc/1/comm').read_text().strip()=='systemd','pid1')
    expected=pathlib.Path('/etc/native-agent-host/binary.sha256').read_text().strip()
    check(hashlib.sha256(pathlib.Path('/opt/native-agent-host/current/native-agent-host').read_bytes()).hexdigest()==expected,'binary digest')
    check(binding()==[] and json.loads((ledger/'allowlist.json').read_text())['ids']==[],'precreated binding')
    for _,name,uid,_ in identities:
        check(not any(u.pw_name==name or u.pw_uid==uid for u in pwd.getpwall()) and not pathlib.Path('/home',name).exists(),'precreated account')
    prep='/usr/local/libexec/native-agent-host-test-jit/jit_acl_prepare.py'
    check(subprocess.run(['/usr/bin/python3',prep,'preflight','--json'],capture_output=True).returncode==0,'preflight')
    fd=os.open(ledger,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        fcntl.flock(fd,fcntl.LOCK_EX)
        nxt=ledger/'allowlist.json.next'
        with os.fdopen(os.open(nxt,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'w') as f:
            json.dump({'version':1,'epoch':2,'ids':[{'id':id,'alternate':name} for _,name,_,id in identities]},f)
            f.flush();os.fsync(f.fileno())
        nxt.replace(ledger/'allowlist.json');os.fsync(fd)
    finally:os.close(fd)
    for step in ('prepare','verify'):
        check(subprocess.run(['/usr/bin/python3',prep,step,'--json'],capture_output=True).returncode==0,step)
    subprocess.run(['systemctl','start','native-agent-host-broker.socket'],check=True,capture_output=True)
    sock=pathlib.Path('/run/native-agent-host/broker.sock').stat()
    check((sock.st_uid,sock.st_gid,stat.S_IMODE(sock.st_mode))==(0,21003,0o660),'broker ACL')
    config=pathlib.Path('/etc/native-agent-host/gateway.json');os.chown(config,0,21003);config.chmod(0o640)
    key=pathlib.Path('/etc/native-agent-host/tls.key');os.chown(key,0,21003);key.chmod(0o640)
    with open('/etc/hosts','a') as f:f.write('\n127.0.0.1 github.com api.github.com host.fixture\n')
    provider=subprocess.Popen(['/usr/bin/python3','/usr/local/sbin/product-fake-provider'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:socket.create_connection(('127.0.0.1',443),.5).close();break
        except OSError:time.sleep(.2)
    else:raise RuntimeError('provider unavailable')
    subprocess.run(['systemctl','start','product-gateway.service'],check=True,capture_output=True)
    for _ in range(50):
        try:
            if get(browser()[0],'/auth/session')[0]==401:break
        except OSError:pass
        time.sleep(.2)
    else:raise RuntimeError('gateway unavailable')
    rounds=[];successful={}
    for codes in (('a','a'),('b','c')):
        flows=[start(),start()]
        marker=pathlib.Path('/run/fixture-concurrent');marker.write_text('1')
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                futures=[pool.submit(callback,flow,code) for flow,code in zip(flows,codes)]
                replies=[f.result(timeout=90) for f in futures]
        finally:marker.unlink()
        statuses=[s for s,_ in replies]
        check(all(s in (303,503) for s in statuses),'callback rejected unexpectedly')
        check(statuses.count(303)>=1,'no successful first login')
        if codes[0]!=codes[1]:check(statuses==[303,303],'distinct IDs did not both succeed')
        for flow,code,(status,body) in zip(flows,codes,replies):
            if status==503:
                check(json.loads(body)['error']['code'] in ('identity_mapping_denied','native_adapter_error'),'untyped loser')
                check(get(flow[0],'/auth/session')[0]==401,'failed callback issued session')
                # A consumed OAuth state cannot be replayed; a new flow can retry.
                check(callback(flow,code)[0]==403,'failed callback state replay')
                retry=start();check(callback(retry,code)[0]==303,'loser fresh retry')
                route(retry,code,[]);successful[code]=retry
            else:
                route(flow,code,[]);successful[code]=flow
        bound=binding()
        for code in set(codes):
            _,name,uid,id=next(i for i in identities if i[0]==code)
            check(sum(b['id']==id and b['uid']==uid and b['username']==name for b in bound)==1,'duplicate/wrong binding')
            check(sum(u.pw_uid==uid and u.pw_name==name for u in pwd.getpwall())==1,'duplicate NSS account')
        check(len(bound)==(1 if codes[0]=='a' else 3),'unexpected binding count')
        rounds.append({'statuses':statuses,'ids':list(codes)})
    for code,name,uid,_ in identities:
        home=pathlib.Path('/home')/name
        src=home/'src';src.mkdir(mode=0o700)
        workspace=src/(name+'-only');workspace.mkdir(mode=0o700)
        subprocess.run(['chown','-R',str(uid)+':'+str(uid),str(src)],check=True,capture_output=True)
    for code,name,uid,_ in identities:
        op,_,_=successful[code]
        status,_,body=get(op,'/api/v1/snapshot')
        check(status==200 and (name+'-only').encode() in body and all((other+'-only').encode() not in body for _,other,_,_ in identities if other!=name),'mapped browser route crossed UID')
        home=pathlib.Path('/home')/name
        check(home.stat().st_uid==uid and stat.S_IMODE(home.stat().st_mode)==0o700,'home ACL')
        cred=home/'.config/gh/hosts.yml'
        check(cred.stat().st_uid==uid and stat.S_IMODE(cred.stat().st_mode)==0o600,'credential ACL')
        for _,other,other_uid,_ in identities:
            if other==name:continue
            check(deny(uid,'/home/'+other) and deny(uid,'/run/native-agent-host/users/'+other+'/daemon.sock'),'cross-UID DAC')
            check(deny(other_uid,'/home/'+name),'cross-UID credential home')
    check(len(binding())==3,'binding cardinality')
    result={'status':'passed','scope':'jit-concurrent','pid1':'systemd','uids':[21032,21033,21034,21003],
            'rounds':rounds,'unique_bindings':True,'cross_uid_denied':True,'retryable_loser':True,'provider_rendezvous':True,'binary_digest_verified':True}
except Exception as e:
    result['reason']=(type(e).__name__+' '+str(e).split(':')[0])[:150]
finally:
    if provider is not None:
        provider.terminate();provider.wait(timeout=5)
print('VM_PROOF='+json.dumps(result,separators=(',',':')),flush=True)
subprocess.run(['systemd-run','--on-active=15s','--unit=fixture-shutdown','/usr/bin/systemctl','poweroff','--no-block'],stdout=subprocess.DEVNULL)
if result['status']!='passed':raise SystemExit(1)
