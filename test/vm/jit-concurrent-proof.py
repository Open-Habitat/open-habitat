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
    started=time.monotonic()
    status,headers,body=get(op,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':code}))
    return status,body,round(time.monotonic()-started,2)

def binding():return json.loads((ledger/'bindings.json').read_text())['bindings']

def route(flow):
    op,_,_=flow
    status,_,body=get(op,'/auth/session');check(status==200,'session not authorized')
    status,_,body=get(op,'/api/v1/snapshot');check(status==200,'snapshot route unavailable')
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
    rounds=[];successful={};observed_rendezvous=0
    for codes in (('a','a'),('b','c')):
        flows=[start(),start()]
        receipt=pathlib.Path('/run/fixture-rendezvous');receipt.unlink(missing_ok=True)
        marker=pathlib.Path('/run/fixture-concurrent');marker.write_text('1')
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                futures=[pool.submit(callback,flow,code) for flow,code in zip(flows,codes)]
                replies=[f.result(timeout=90) for f in futures]
        finally:marker.unlink()
        check(receipt.is_file() and receipt.read_bytes()==b'passed\npassed\n','provider rendezvous not observed twice')
        receipt.unlink();observed_rendezvous+=1
        statuses=[s for s,_,_ in replies]
        allowed_errors={'identity_mapping_denied','native_adapter_error','authentication_required'}
        errors=[]
        for status,body,_ in replies:
            if status==303:errors.append('none');continue
            try:code=json.loads(body).get('error',{}).get('code')
            except (ValueError,UnicodeError,AttributeError):code=None
            errors.append(code if code in allowed_errors else 'other')
        # The synthetic children store token-free argv under their own homes.
        # Only fixed command categories are exposed in the failure receipt.
        def stages(code):
            home=pathlib.Path('/home')/next(i[1] for i in identities if i[0]==code)
            gh=home/'gh-argv.jsonl';git=home/'git-argv.log';done=home/'gh-completed.jsonl';entry=home/'git-entry.jsonl'
            try:
                return {'gh':[json.loads(line)['argv'][:2] for line in gh.read_text().splitlines()] if gh.is_file() else [],
                        'completed':[json.loads(line) for line in done.read_text().splitlines()] if done.is_file() else [],
                        'git_entry':[json.loads(line) for line in entry.read_text().splitlines()] if entry.is_file() else [],
                        'git_count':len(git.read_text().splitlines()) if git.is_file() else 0}
            except (OSError,ValueError,KeyError,TypeError):
                return {'unavailable':True} # Diagnostic must never turn a passing proof red.
        result['diagnostic_round']={'ids':list(codes),'statuses':statuses,'errors':errors,
                                    'duration_seconds':[elapsed for _,_,elapsed in replies],
                                    'stages':{code:stages(code) for code in set(codes)},
                                    'binding_count':len(binding()),
                                    'credentials_present':[(pathlib.Path('/home')/next(i[1] for i in identities if i[0]==code)/'.config/gh/hosts.yml').is_file() for code in codes]}
        check(statuses==[303,303], 'simultaneous callbacks did not both succeed')
        for flow,code,(status,body,_) in zip(flows,codes,replies):
            route(flow);successful[code]=flow
            check(callback(flow,code)[0]==403,'callback state replay')
        bound=binding()
        for code in set(codes):
            _,name,uid,id=next(i for i in identities if i[0]==code)
            check(sum(b['id']==id and b['uid']==uid and b['username']==name for b in bound)==1,'duplicate/wrong binding')
            check(sum(u.pw_uid==uid and u.pw_name==name for u in pwd.getpwall())==1,'duplicate NSS account')
        check(len(bound)==(1 if codes[0]=='a' else 3),'unexpected binding count')
        rounds.append({'statuses':statuses,'ids':list(codes),'duration_seconds':[elapsed for _,_,elapsed in replies]})
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
    # Faults are made only in the disposable guest, after all successful browser
    # flows. Keep the broker running so these are request-time denials, not an
    # inference from a socket-activation race. Restore exact ledger bytes.
    head=ledger/'head.json';allow=ledger/'allowlist.json';bindings=ledger/'bindings.json'
    original={p:p.read_bytes() for p in (head,allow,bindings)}
    def refused(label, expected, changed=None):
        status,_,_=get(successful['a'][0],'/api/v1/snapshot')
        check(status!=200,label+' browser route accepted')
        # A direct gateway-UID peer gets a typed reply from the active broker.
        request=json.dumps({'version':1,'operation':'authorize','provider':'github','id':identities[0][3]}).encode()
        def drop():os.setgroups([]);os.setresgid(21003,21003,21003);os.setresuid(21003,21003,21003)
        code='''import socket,struct,sys
s=socket.socket(socket.AF_UNIX);s.settimeout(12);s.connect(sys.argv[1]);b=sys.argv[2].encode();s.sendall(struct.pack('>I',len(b))+b);s.shutdown(socket.SHUT_WR);n=struct.unpack('>I',s.recv(4))[0];out=b''
while len(out)<n:out+=s.recv(n-len(out))
print(out.decode())'''
        p=subprocess.run(['/usr/bin/python3','-c',code,'/run/native-agent-host/broker.sock',request.decode()],preexec_fn=drop,capture_output=True,text=True,timeout=18)
        check(p.returncode==0 and json.loads(p.stdout).get('failure')==expected,label+' broker did not deny')
        expected_bytes=dict(original)
        if changed is not None:
            expected_bytes[changed[0]]=changed[1]
        check(all(p.read_bytes()==b for p,b in expected_bytes.items()),label+' mutated ledger')
    # Change a committed NSS account's name without changing its UID. The
    # binding still points at the old name, which must never be adopted anew.
    passwd=pathlib.Path('/etc/passwd');passwd_bytes=passwd.read_bytes()
    lines=passwd_bytes.split(b'\n')
    hits=[i for i,line in enumerate(lines) if line.startswith(b'guestone:')]
    check(len(hits)==1,'NSS fixture name not unique')
    lines[hits[0]]=b'driftalias'+lines[hits[0]][len(b'guestone'):]
    passwd.write_bytes(b'\n'.join(lines))
    try:
        refused('NSS name drift','drift')
    finally:
        passwd.write_bytes(passwd_bytes)
    check(all(p.read_bytes()==b for p,b in original.items()),'NSS drift changed ledger')
    check(get(successful['a'][0],'/auth/session')[0]==401,'drifted session not revoked')
    recovered=start();check(callback(recovered,'a')[0]==303,'fresh login after NSS restore failed')
    successful['a']=recovered
    check(len(binding())==3 and get(recovered[0],'/api/v1/snapshot')[0]==200,'NSS restore changed mapping')
    for label,path,payload in (
        ('corrupt head',head,b'{invalid'),
        ('head generation mismatch',head,json.dumps(dict(json.loads(original[head]),generation=1)).encode()),
        ('rolled-back epoch',allow,json.dumps(dict(json.loads(original[allow]),epoch=1)).encode())):
        path.write_bytes(payload)
        try:refused(label,'state_unavailable',(path,payload))
        finally:path.write_bytes(original[path])
        check(all(p.read_bytes()==b for p,b in original.items()),label+' altered ledger after restore')
        check(get(successful['a'][0],'/api/v1/snapshot')[0]==200,label+' recovery failed')
    result={'status':'passed','scope':'jit-concurrent','pid1':'systemd','uids':[21032,21033,21034,21003],
            'rounds':rounds,'unique_bindings':True,'cross_uid_denied':True,'same_id_idempotent':rounds[0]['statuses']==[303,303],'provider_rendezvous':observed_rendezvous==2,'binary_digest_verified':True,'nss_drift_denied':True,'head_corrupt_denied':True,'head_generation_mismatch_denied':True,'epoch_rollback_denied':True}
except Exception as e:
    result['reason']=(type(e).__name__+' '+str(e).split(':')[0])[:150]
finally:
    if provider is not None:
        provider.terminate();provider.wait(timeout=5)
print('VM_PROOF='+json.dumps(result,separators=(',',':')),flush=True)
subprocess.run(['systemd-run','--on-active=15s','--unit=fixture-shutdown','/usr/bin/systemctl','poweroff','--no-block'],stdout=subprocess.DEVNULL)
if result['status']!='passed':raise SystemExit(1)
