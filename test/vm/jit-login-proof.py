#!/usr/bin/python3
"""Fail-closed product proof inside the disposable guest. Never print secrets."""
import grp, http.cookiejar, hashlib, http.client, json, os, pathlib, pwd, socket, ssl, stat, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
names=['guestone','guesttwo']; uids=[21032,21033]; gateway_uid=21003
base='https://host.fixture:8443'
result={'status':'failed','scope':'jit-login-slice'}
def check(v, label):
    if not v: raise RuntimeError(label)
def as_user(name, script, stdin=None):
    u=pwd.getpwnam(name)
    def drop(): os.setgroups([]);os.setgid(u.pw_gid);os.setuid(u.pw_uid)
    return subprocess.run(['/usr/bin/python3','-c',script],preexec_fn=drop, input=stdin, capture_output=True, timeout=10)
def denied(name, script):
    p=as_user(name,script);return p.returncode!=0 and b'PermissionError' in p.stderr
try:
    check(pathlib.Path('/proc/1/comm').read_text().strip()=='systemd','pid1')
    expected=pathlib.Path('/etc/native-agent-host/binary.sha256').read_text().strip()
    check(hashlib.sha256(pathlib.Path('/opt/native-agent-host/current/native-agent-host').read_bytes()).hexdigest()==expected,'product binary digest')
    check(pwd.getpwnam('native-agent-host-gateway').pw_uid==gateway_uid,'gateway UID')
    ledger_dir=pathlib.Path('/var/lib/native-agent-host/broker')
    check(json.loads((ledger_dir/'bindings.json').read_text())['bindings']==[],'bindings precreated')
    check(json.loads((ledger_dir/'allowlist.json').read_text())['ids']==[],'allowlist precreated')
    check(ledger_dir.stat().st_uid==0 and stat.S_IMODE(ledger_dir.stat().st_mode)==0o700,'root ledger directory')
    for name,uid in zip(names,uids):
        check(not any(u.pw_name==name or u.pw_uid==uid for u in pwd.getpwall()),'precreated account')
        check(not (pathlib.Path('/home')/name).exists(),'precreated home')
    for n in range(21032,21048):
        check(not any(u.pw_uid==n or u.pw_gid==n for u in pwd.getpwall()),'occupied passwd pool')
        check(not any(g.gr_gid==n for g in grp.getgrall()),'occupied group pool')
        for lookup in (pwd.getpwuid,grp.getgrgid):
            try: lookup(n)
            except KeyError: pass
            else: raise RuntimeError('direct NSS pool occupant')
    for name in names:
        check(not any(g.gr_name==name or name in g.gr_mem for g in grp.getgrall()),'group alias')
        check(not (pathlib.Path('/etc/native-agent-host')/('daemon-'+name+'.json')).exists(),'precreated config')
        check(not (pathlib.Path('/run/native-agent-host/users')/name).exists(),'precreated socket directory')
    # Prepare the pinned private Fleetrepo boot gate before any broker socket.
    prep='/usr/local/libexec/native-agent-host-test-jit/jit_acl_prepare.py'
    check(subprocess.run(['/usr/bin/python3',prep,'preflight','--json'],capture_output=True).returncode==0,'policy preflight')
    import fcntl
    fd=os.open(ledger_dir,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        fcntl.flock(fd,fcntl.LOCK_EX)
        nxt=ledger_dir/'allowlist.json.next'
        with os.fdopen(os.open(nxt,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'w') as f:
            json.dump({'version':1,'epoch':2,'ids':[{'id':'100000001','alternate':names[0]},{'id':'100000002','alternate':names[1]}]},f)
            f.flush();os.fsync(f.fileno())
        nxt.replace(ledger_dir/'allowlist.json');os.fsync(fd)
    finally: os.close(fd)
    check(subprocess.run(['/usr/bin/python3',prep,'prepare','--json'],capture_output=True).returncode==0,'policy prepare')
    check(subprocess.run(['/usr/bin/python3',prep,'verify','--json'],capture_output=True).returncode==0,'policy verify')
    subprocess.run(['systemctl','start','native-agent-host-broker.socket'],check=True,stdout=subprocess.DEVNULL)
    runtime=pathlib.Path('/run/native-agent-host');root=runtime/'users'
    broker=runtime/'broker.sock';st=broker.stat()
    check(stat.S_ISSOCK(st.st_mode) and (st.st_uid,st.st_gid,stat.S_IMODE(st.st_mode))==(0,gateway_uid,0o660),'broker socket ACL')
    config=pathlib.Path('/etc/native-agent-host/gateway.json')
    os.chown(config,0,gateway_uid);config.chmod(0o640)
    with open('/etc/hosts','a') as f:f.write('\n127.0.0.1 github.com api.github.com host.fixture\n')
    # Root peer can connect by DAC but the broker transport must reject its kernel peer.
    def exchange(uid,subject):
        code='''import json,socket,struct,sys
s=socket.socket(socket.AF_UNIX);s.settimeout(5)
try: s.connect('/run/native-agent-host/broker.sock')
except PermissionError as e:
 if e.errno==13: print('DAC_DENIED');sys.exit(0)
 raise
b=json.dumps({'version':1,'operation':'authorize','provider':'github','id':sys.argv[1]}).encode()
s.sendall(struct.pack('>I',len(b))+b);s.shutdown(socket.SHUT_WR)
try: h=s.recv(4)
except ConnectionResetError: h=b''
if not h: print('PEER_REJECTED');sys.exit(0)
print('UNEXPECTED_REPLY')
'''
        def drop():os.setgroups([]);os.setresgid(uid,uid,uid);os.setresuid(uid,uid,uid)
        return subprocess.run(['/usr/bin/python3','-c',code,subject],preexec_fn=drop,capture_output=True,timeout=8)
    root_peer=exchange(0,'100000001')
    check(root_peer.returncode==0 and root_peer.stdout.strip()==b'PEER_REJECTED','root broker peer not rejected')
    foreign_peer=exchange(21032,'100000001')
    check(foreign_peer.returncode==0 and foreign_peer.stdout.strip()==b'DAC_DENIED','non-gateway broker DAC not denied')
    key=pathlib.Path('/etc/native-agent-host/tls.key')
    os.chown(key,0,gateway_uid);key.chmod(0o640)
    provider=subprocess.Popen(['/usr/bin/python3','/usr/local/sbin/product-fake-provider'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(30):
            if provider.poll() is not None:raise RuntimeError('fixture provider exited')
            try:
                socket.create_connection(('127.0.0.1',443),1).close();break
            except OSError:time.sleep(.2)
        else:raise RuntimeError('fixture provider not ready')
        subprocess.run(['systemctl','start','product-gateway.service'],check=True,stdout=subprocess.DEVNULL)
        ctx=ssl.create_default_context(cafile='/etc/native-agent-host/fixture-ca.crt')
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self,*args): return None
        def browser():
            jar=http.cookiejar.CookieJar();op=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx),urllib.request.HTTPCookieProcessor(jar),NoRedirect());return op,jar
        def get(op,path,headers={}):
            req=urllib.request.Request(base+path,headers=headers)
            try:
                with op.open(req,timeout=110) as res:return res.status,res.headers, res.read()
            except urllib.error.HTTPError as e:return e.code,e.headers,e.read()
        for _ in range(40):
            try:
                status,_,_=get(browser()[0],'/auth/session');break
            except OSError:time.sleep(.25)
        else:
            journal=subprocess.run(['journalctl','-u','product-gateway.service','-n','20','--no-pager','-o','cat'],capture_output=True).stdout
            codes=[]
            for line in journal.decode('utf-8','replace').splitlines():
                if line.strip().startswith('{'):
                    try:codes.append(json.loads(line).get('error',{}).get('code',''))
                    except ValueError:pass
            raise RuntimeError('gateway not ready '+','.join(codes))
        check(status==401,'gateway session guard')
        gateway_pid=int(subprocess.check_output(['systemctl','show','-P','MainPID','product-gateway.service']).strip())
        check(gateway_pid>1 and ('Uid:\t'+str(gateway_uid)+'\t') in pathlib.Path('/proc/%d/status'%gateway_pid).read_text(),'gateway effective UID')
        routes=[]; captures=[]; browsers=[]
        fault=pathlib.Path('/run/fixture-gh-fault')
        fault_results={}
        for mode,index in (('fail-login',0),('wrong-id',1)):
            fault.write_text(mode)
            op,jar=browser()
            start_status,h,_=get(op,'/auth/github/start');check(start_status==302,'fault start')
            state=urllib.parse.parse_qs(urllib.parse.urlparse(h['Location']).query)['state'][0]
            failure_status,h,body=get(op,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':'a' if index==0 else 'b'}))
            captures.extend([str(h).encode(),body,repr([(c.name,c.value) for c in jar]).encode()])
            check(failure_status==503 and json.loads(body)['error']['code']=='native_adapter_error','gh fault callback issued session')
            session_status,session_headers,session_body=get(op,'/auth/session')
            snapshot_status,snapshot_headers,snapshot_body=get(op,'/api/v1/snapshot')
            captures.extend([str(session_headers).encode(),session_body,str(snapshot_headers).encode(),snapshot_body])
            check(session_status==401 and snapshot_status==401,'gh fault normal session')
            check(get(op,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':'a' if index==0 else 'b'}))[0]==403,'gh fault replay')
            check(not (pathlib.Path('/home')/names[index]/'.config/gh/hosts.yml').exists(),'gh fault retained credential')
            fault_results[mode]={'callback_status':failure_status,'session_status':401,'replay_status':403,'credential_absent':True}
            fault.unlink()
        for index,name in enumerate(names):
            op,jar=browser();browsers.append(op)
            status,h,body=get(op,'/auth/github/start')
            check(status==302,'oauth start')
            q=urllib.parse.parse_qs(urllib.parse.urlparse(h['Location']).query)
            check(urllib.parse.urlparse(h['Location']).hostname=='github.com' and q.get('code_challenge_method')==['S256'] and len(q.get('state',[''])[0])>=32,'PKCE/state redirect')
            state=q['state'][0]
            captures.append(str(h).encode())
            status,callback_headers,body=get(op,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':'a' if index==0 else 'b'}))
            captures.append(str(callback_headers).encode())
            if status!=303:
                try: code=json.loads(body).get('error',{}).get('code','unknown')
                except ValueError: code='non_json'
                bindings=json.loads((ledger_dir/'bindings.json').read_text()).get('bindings',[])
                socket_unit='native-agent-host-daemon@'+name+'.socket'
                active=subprocess.run(['systemctl','is-active',socket_unit],capture_output=True,text=True).stdout.strip()
                result['diagnostic']={'binding_committed':any(b.get('id')==str(100000001+index) and b.get('uid')==uids[index] for b in bindings),
                    'socket_unit_state':active,'socket_inode_present':(root/name/'daemon.sock').is_socket(),
                    'credential_present':(pathlib.Path('/home')/name/'.config/gh/hosts.yml').is_file()}
                raise RuntimeError('OAuth callback status '+str(status)+' code '+str(code))
            uid=uids[index];home=pathlib.Path('/home')/name
            check(pwd.getpwnam(name).pw_uid==uid and pwd.getpwnam(name).pw_gid==uid,'new NSS account')
            check(home.stat().st_uid==uid and stat.S_IMODE(home.stat().st_mode)==0o700,'new home')
            binding=json.loads((ledger_dir/'bindings.json').read_text())['bindings']
            check(any(b['id']==str(100000001+index) and b['uid']==uid and b['username']==name for b in binding),'broker binding')
            config=pathlib.Path('/etc/native-agent-host')/('daemon-'+name+'.json')
            check(config.stat().st_uid==0 and config.stat().st_gid==uid and stat.S_IMODE(config.stat().st_mode)==0o640,'executor config')
            src=home/'src';src.mkdir(mode=0o700)
            for kind in ('ordinary','git-hint','no-metadata'):
                p=src/(name+'-'+kind);p.mkdir();(p/'SENTINEL').write_text(name+'-only-'+kind)
            (src/(name+'-git-hint')/'.git').mkdir()
            src.joinpath('escape').symlink_to('/home/'+names[1-index])
            subprocess.run(['chown','-R',str(uid)+':'+str(uid),str(src)],check=True)
            check(b'PRODUCT_VM_TOKEN' not in body,'OAuth callback token')
            status,_,session=get(op,'/auth/session');check(status==200 and json.loads(session)['provider']=='github','authenticated session')
            status,_,snap=get(op,'/api/v1/snapshot',{'X-Agent-Host-UID':str(uids[1-index]),'X-Agent-Host-Username':names[1-index],'X-Agent-Host-Socket':'/run/native-agent-host/users/'+names[1-index]+'/daemon.sock','X-Agent-Host-Identity':'forged'})
            check(status==200,'snapshot')
            text=snap.decode();other=names[1-index]
            check(all(name+'-'+k in text for k in ('ordinary','git-hint','no-metadata')) and other+'-' not in text and '/home/' not in text and 'escape' not in text,'snapshot isolation')
            routes.append({'uid':uids[index],'subject':str(100000001+index),'workspace_count':3,'forged_headers_ignored':True})
            captures.extend([body,session,snap,repr([(c.name,c.value) for c in jar]).encode()])
            check(get(op,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':'a'}))[0]==403,'state replay')
        op,unknown_jar=browser();status,h,_=get(op,'/auth/github/start');state=urllib.parse.parse_qs(urllib.parse.urlparse(h['Location']).query)['state'][0]
        unknown_status,unknown_headers,unknown_body=get(op,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':'unknown'}))
        captures.extend([str(unknown_headers).encode(),unknown_body,repr([(c.name,c.value) for c in unknown_jar]).encode()])
        check(unknown_status==403,'unmapped numeric ID')
        check(get(op,'/api/v1/snapshot')[0]==401,'unknown session')
        source=pathlib.Path('/home/guestone/src'); held=pathlib.Path('/home/guestone/src-held')
        source.rename(held)
        try:
            source.symlink_to('/home/guesttwo/src')
            check(get(browsers[0],'/api/v1/snapshot')[0]==503,'source symlink escape rejected')
        finally:
            source.unlink();held.rename(source)
        for name in names:
            pid=int(subprocess.check_output(['systemctl','show','-P','MainPID','native-agent-host-daemon@'+name+'.service']).strip())
            check(pid>1 and ('Uid:\t'+str(pwd.getpwnam(name).pw_uid)+'\t') in pathlib.Path('/proc/%d/status'%pid).read_text(),'daemon effective UID')
            args=[a for a in pathlib.Path('/proc/%d/cmdline'%pid).read_bytes().split(b'\0') if a]
            check(args[:3]==[b'/opt/native-agent-host/current/native-agent-host',b'daemon',b'exec'] and args[-1]==('/etc/native-agent-host/daemon-'+name+'.json').encode(),'daemon config argv')
            other=names[1-names.index(name)]
            sock=str(root/other/'daemon.sock')
            check(denied(name,"import socket;s=socket.socket(socket.AF_UNIX);s.connect(%r)"%sock),'cross user route')
            check(denied(name,"import os;os.listdir(%r)"%('/home/'+other)),'cross user home')
            check(denied('native-agent-host-gateway',"import os;os.listdir(%r)"%('/home/'+name)),'gateway home')
            check(denied('native-agent-host-gateway',"open(%r).read()"%('/home/'+name+'/.config/gh/hosts.yml')),'gateway credential')
            log=(pathlib.Path('/home')/name/'gh-argv.jsonl').read_text();records=[json.loads(l) for l in log.splitlines()]
            check(any(r['argv']==['auth','login','--hostname','github.com','--with-token','--git-protocol','https'] and r['stdin'] and r['uid']==pwd.getpwnam(name).pw_uid for r in records),'gh login argv/stdin')
            check(any(r['argv']==['auth','setup-git','--hostname','github.com'] for r in records),'gh setup')
            cred=pathlib.Path('/home')/name/'.config/gh/hosts.yml';check(cred.stat().st_uid==pwd.getpwnam(name).pw_uid and stat.S_IMODE(cred.stat().st_mode)==0o600 and stat.S_IMODE(cred.parent.stat().st_mode)==0o700,'protected credential')
            check(denied(other,"open(%r).read()"%str(cred)),'cross user credential')
            check('PRODUCT_VM_TOKEN' not in log and 'PRODUCT_VM_TOKEN' not in (pathlib.Path('/home')/name/'git-argv.log').read_text(),'child argv logs')
        # Root can connect by DAC, but kernel peer gate must immediately close it.
        for name in names:
            s=socket.socket(socket.AF_UNIX);s.settimeout(3);s.connect(str(root/name/'daemon.sock'));s.sendall(b'GET /healthz HTTP/1.1\r\nHost: unix\r\n\r\n')
            try: reply=s.recv(1024)
            except ConnectionResetError: reply=b''
            check(reply==b'','root peer rejection');s.close()
        subprocess.run(['systemctl','stop','native-agent-host-daemon@guestone.socket','native-agent-host-daemon@guestone.service'],check=True,stdout=subprocess.DEVNULL)
        # Broker denies an inactive route before handoff. This can surface as
        # 401 (session authorization unavailable), not only daemon HTTP 503;
        # either way no data or cross-user fallback may be returned.
        check(get(browsers[0],'/api/v1/snapshot')[0] in (401,503),'stopped A has no fallback')
        check(get(browsers[1],'/api/v1/snapshot')[0]==200,'stopped A does not affect B')
        subprocess.run(['systemctl','start','native-agent-host-daemon@guestone.socket'],check=True,stdout=subprocess.DEVNULL)
        check(get(browsers[0],'/api/v1/snapshot')[0]==200,'A socket reactivates its own daemon')
        # A second callback for the same numeric ID after a provider handle
        # change must retain the committed UID and not install a second token.
        before=json.loads((ledger_dir/'bindings.json').read_text())['bindings']
        before_log=(pathlib.Path('/home/guestone/gh-argv.jsonl').read_text())
        pathlib.Path('/run/fixture-rename').write_text('1')
        rerun,rerun_jar=browser()
        status,h,_=get(rerun,'/auth/github/start');check(status==302,'rerun start')
        state=urllib.parse.parse_qs(urllib.parse.urlparse(h['Location']).query)['state'][0]
        status,h,body=get(rerun,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':'a'}))
        captures.extend([str(h).encode(),body,repr([(c.name,c.value) for c in rerun_jar]).encode()])
        check(status==303 and get(rerun,'/auth/session')[0]==200,'same ID renamed callback')
        check(json.loads((ledger_dir/'bindings.json').read_text())['bindings']==before,'rename changed immutable bindings')
        new_log=pathlib.Path('/home/guestone/gh-argv.jsonl').read_text()
        login_argv=['auth','login','--hostname','github.com','--with-token','--git-protocol','https']
        count=lambda text:sum(json.loads(line)['argv']==login_argv for line in text.splitlines())
        check(count(before_log)==count(new_log)==2,'rerun installed token again')
        # Root operator atomically replaces the allowlist under the same ledger
        # lock, fsyncs file and directory, and leaves accounts/credentials intact.
        old_cred=(pathlib.Path('/home/guestone/.config/gh/hosts.yml').stat().st_ino)
        old_bindings=(ledger_dir/'bindings.json').read_bytes()
        old_head=(ledger_dir/'head.json').read_bytes()
        old_journal=sorted(p.name for p in ledger_dir.iterdir() if 'journal' in p.name)
        fd=os.open(ledger_dir,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
        try:
            fcntl.flock(fd,fcntl.LOCK_EX)
            nxt=ledger_dir/'allowlist.json.next'
            with os.fdopen(os.open(nxt,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'w') as f:
                json.dump({'version':1,'epoch':3,'ids':[{'id':'100000002','alternate':names[1]}]},f)
                f.flush();os.fsync(f.fileno())
            nxt.replace(ledger_dir/'allowlist.json');os.fsync(fd)
        finally:os.close(fd)
        check((ledger_dir/'bindings.json').read_bytes()==old_bindings and (ledger_dir/'head.json').read_bytes()==old_head and sorted(p.name for p in ledger_dir.iterdir() if 'journal' in p.name)==old_journal,'revocation changed ledger or journal')
        check(pathlib.Path('/home/guestone/.config/gh/hosts.yml').stat().st_ino==old_cred and pwd.getpwnam('guestone').pw_uid==uids[0],'revocation removed account or credential')
        revoked=[]
        for op in (browsers[0],rerun):
            for path in ('/auth/session','/api/v1/snapshot'):
                status,h,body=get(op,path)
                captures.extend([str(h).encode(),body])
                check(status==401 and b'guestone-only' not in body,'revoked established route')
                revoked.append(status)
        b_status,b_headers,b_body=get(browsers[1],'/api/v1/snapshot')
        captures.extend([str(b_headers).encode(),b_body])
        check(b_status==401,'changed epoch did not invalidate B session')
        # Epoch is global: B's old session is invalidated too, but B remains
        # allowlisted and can explicitly obtain a new B-only session.
        surviving,surviving_jar=browser();status,h,_=get(surviving,'/auth/github/start');check(status==302,'B reauth start')
        state=urllib.parse.parse_qs(urllib.parse.urlparse(h['Location']).query)['state'][0]
        status,h,body=get(surviving,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':'b'}))
        captures.extend([str(h).encode(),body,repr([(c.name,c.value) for c in surviving_jar]).encode()])
        surviving_status,surviving_headers,surviving_body=get(surviving,'/api/v1/snapshot')
        captures.extend([str(surviving_headers).encode(),surviving_body])
        check(status==303 and surviving_status==200 and all(('guesttwo-'+k).encode() in surviving_body for k in ('ordinary','git-hint','no-metadata')) and b'guestone-' not in surviving_body,
              'allowed B route not restored callback=%d snapshot=%d'%(status,surviving_status))
        fresh,fresh_jar=browser();status,h,_=get(fresh,'/auth/github/start');check(status==302,'revoked start')
        state=urllib.parse.parse_qs(urllib.parse.urlparse(h['Location']).query)['state'][0]
        status,h,body=get(fresh,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':'a'}))
        captures.extend([str(h).encode(),body,repr([(c.name,c.value) for c in fresh_jar]).encode()])
        fresh_session,fresh_headers,fresh_body=get(fresh,'/auth/session')
        fresh_snapshot,snapshot_headers,snapshot_body=get(fresh,'/api/v1/snapshot')
        captures.extend([str(fresh_headers).encode(),fresh_body,str(snapshot_headers).encode(),snapshot_body])
        check(status==403 and fresh_session==401 and fresh_snapshot==401,'revoked new session')
        check(count(pathlib.Path('/home/guestone/gh-argv.jsonl').read_text())==2,'revoked token handed off')
        # Simulate a lost daemon acknowledgement after it receives B's token.
        # This synthetic fault lives solely in the guest gh executable. Never
        # repeat the uncertain callback or offer its token to another sink.
        b_log=pathlib.Path('/home/guesttwo/gh-argv.jsonl')
        b_attempts=count(b_log.read_text())
        b_cred=pathlib.Path('/home/guesttwo/.config/gh/hosts.yml').stat().st_ino
        lost,lost_jar=browser();status,h,_=get(lost,'/auth/github/start');check(status==302,'lost-ack start')
        lost_state=urllib.parse.parse_qs(urllib.parse.urlparse(h['Location']).query)['state'][0]
        fault.write_text('lost-ack')
        try:
            lost_status,lost_headers,lost_body=get(lost,'/auth/github/callback?'+urllib.parse.urlencode({'state':lost_state,'code':'b'}))
        finally:fault.unlink()
        captures.extend([str(lost_headers).encode(),lost_body,repr([(c.name,c.value) for c in lost_jar]).encode()])
        check(lost_status==503 and json.loads(lost_body)['error']['code']=='native_adapter_error','lost ack issued session')
        lost_session,session_headers,session_body=get(lost,'/auth/session')
        lost_snapshot,snapshot_headers,snapshot_body=get(lost,'/api/v1/snapshot')
        captures.extend([str(session_headers).encode(),session_body,str(snapshot_headers).encode(),snapshot_body])
        check(lost_session==401 and lost_snapshot==401,'lost ack created normal session')
        check(get(lost,'/auth/github/callback?'+urllib.parse.urlencode({'state':lost_state,'code':'b'}))[0]==403,'lost ack replay')
        check(count(b_log.read_text())==b_attempts and pathlib.Path('/home/guesttwo/.config/gh/hosts.yml').stat().st_ino==b_cred,'uncertain token retried or credential replaced')
        for token_name in names+['UNKNOWN']:
            value=(pathlib.Path('/usr/local/lib/fixture/tokens')/token_name).read_bytes() if token_name in names else b'PRODUCT_VM_TOKEN_'+b'UNKNOWN_FIXTURE_ONLY_92764'
            check(value and all(value not in b for b in captures),'browser capture token scan')
            for p in pathlib.Path('/proc').iterdir():
                if not p.name.isdigit():continue
                for suffix in ('cmdline','environ'):
                    try:check(value not in (p/suffix).read_bytes(),'process token scan')
                    except (FileNotFoundError,ProcessLookupError):continue
            for unit in ['product-gateway','native-agent-host-daemon@guestone','native-agent-host-daemon@guesttwo','native-agent-host-broker']:
                journal_read=subprocess.run(['journalctl','-u',unit,'-b','--no-pager','-o','cat'],capture_output=True,timeout=10)
                logs=journal_read.stdout
                check(journal_read.returncode==0 and len(logs)>0,'journal scan unavailable')
                check(len(logs)<=1048576,'journal scan exceeds 1 MiB')
                check(value not in logs,'journal token scan')
            for p in ['/etc/native-agent-host/gateway.json','/etc/native-agent-host/daemon-guestone.json','/etc/native-agent-host/daemon-guesttwo.json']:
                check(value not in pathlib.Path(p).read_bytes(),'config token scan')
        result={'status':'passed','scope':'jit-login-slice','revocation':{'atomic_fsynced':True,'existing_denied_statuses':revoked,'new_denied_status':status,'other_uid_reauthorized':True,'ledger_account_credential_preserved':True},'rename':{'same_uid':True,'no_second_gh_login':True},'gh_failures':fault_results,'lost_ack':{'callback_status':lost_status,'session_status':lost_session,'snapshot_status':lost_snapshot,'replay_status':403,'no_second_login_attempt':True,'credential_preserved':True},'pid1':'systemd','uids':[21032,21033,21003],'socket_mode':'0660','socket_activation':True,'pool_vacant_before_login':True,'new_accounts':True,'committed_bindings':True,'root_ledger':True,'pinned_policy_gate':True,'routes':routes,'native_gh':{'stdin_only':True,'exact_argv':True,'protected_file':True,'credential_isolated':True},'denials':{'cross_user_broker':True,'unknown_identity':True,'unknown_session':True,'state_replay':True,'root_peer':True,'cross_user_home':True,'cross_user_socket':True,'gateway_home':True,'gateway_credential':True,'forged_headers':True,'symlink_excluded':True},'token_scan':{'passed':True,'allowed':'per-user protected gh credential and fixture provider inputs','scanned':'browser captures, full boot journal capped at 1 MiB per unit, process argv/environ, configs, child argv logs'}}
    finally:provider.terminate();provider.wait(timeout=5)
except Exception as e:
    # FileNotFoundError retains the missing executable/path; no fixture token
    # is printed. Keep a bounded, redacted journal-code receipt for PID1 boots.
    missing=getattr(e,'filename',None)
    result['reason']=(type(e).__name__+' '+str(missing or str(e)).split(':')[0])[:220]
    codes={}
    for unit in ('product-gateway','native-agent-host-broker','native-agent-host-daemon@guestone','native-agent-host-daemon@guesttwo'):
        journal=subprocess.run(['journalctl','-u',unit,'-n','12','--no-pager','-o','cat'],capture_output=True).stdout
        codes[unit]=[]
        for line in journal.decode('utf-8','replace').splitlines():
            if line.startswith('{'):
                try:
                    code=json.loads(line).get('error',{}).get('code')
                    if code:codes[unit].append(code)
                except ValueError:pass
    result['journal_codes']=codes
    if 'broker authorize' in result['reason']:
        # Guest-local, synthetic-only drift inventory; omit raw logs and token
        # files. These are the checks the root broker makes at startup.
        diag={}
        for name in names:
            for args in (['getent','passwd',name],['getent','group',name],['getent','initgroups',name]):
                p=subprocess.run(args,capture_output=True,text=True)
                diag[' '.join(args)]=p.stdout.strip()[:120] if p.returncode==0 else 'exit '+str(p.returncode)
        for path in ('/run/native-agent-host','/run/native-agent-host/users',str(root/names[0]),str(root/names[1])):
            p=subprocess.run(['getfacl','-cpn',path],capture_output=True,text=True)
            diag[path]=p.stdout.strip().replace('\n',';')[:220] if p.returncode==0 else 'exit '+str(p.returncode)
        for unit in ('native-agent-host-broker.service','native-agent-host-daemon@guestone.service','native-agent-host-daemon@guestone.socket'):
            p=subprocess.run(['systemctl','show',unit,'--property=ActiveState,ExecMainStatus,SocketMode,DirectoryMode,Listen,ExecStart','--no-pager'],capture_output=True,text=True)
            diag[unit]=p.stdout.strip().replace('\n',';')[:300]
        result['diagnostic']=diag
    if codes.get('native-agent-host-broker'):
        result['reason']=(result['reason']+' broker '+','.join(codes['native-agent-host-broker']))[:220]
print('VM_PROOF='+json.dumps(result,separators=(',',':')),flush=True)
subprocess.run(['systemd-run','--on-active=15s','--unit=fixture-shutdown','/usr/bin/systemctl','poweroff','--no-block'],stdout=subprocess.DEVNULL)
if result['status']!='passed':sys.exit(1)
