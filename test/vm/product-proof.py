#!/usr/bin/python3
"""Fail-closed product proof inside the disposable guest. Never print secrets."""
import ctypes, http.cookiejar, hashlib, http.client, json, os, pathlib, pwd, socket, ssl, stat, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
names=['agent-a','agent-b']; uids=[21001,21002]; gateway_uid=21003
base='https://host.fixture:8443'
result={'status':'failed','scope':'product-two-user-routing'}
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
    expected=pathlib.Path('/etc/open-habitat/binary.sha256').read_text().strip()
    check(hashlib.sha256(pathlib.Path('/opt/open-habitat/current/open-habitat').read_bytes()).hexdigest()==expected,'product binary digest')
    # The current broker requires real enforced native quotas at startup.
    # Give this disposable guest an ext4 home filesystem with quota inodes;
    # do not weaken the product guard or replace accounting with a fixture.
    check(os.uname().release=='6.8.0-139-generic','fixture quota module ABI')
    subprocess.run(['modprobe','quota_v2'],check=True)
    quota_image='/dev/disk/by-id/virtio-oh-quota-home'  # stable identity, independent of the seed disk's virtio slot
    subprocess.run(['udevadm','settle'],check=True)
    check(pathlib.Path(quota_image).exists(),'fixture home device unavailable')
    formatted=subprocess.run(['mkfs.ext4','-q','-F','-O','quota','-E','quotatype=usrquota',quota_image],capture_output=True)
    check(formatted.returncode==0,'fixture home format '+formatted.stderr.decode('ascii','replace').replace(':',' ')[:160])
    pathlib.Path('/mnt/quota-home').mkdir()
    mounted=subprocess.run(['mount','-o','usrquota',quota_image,'/mnt/quota-home'],capture_output=True)
    check(mounted.returncode==0,'fixture home mount '+mounted.stderr.decode('ascii','replace').replace(':',' ')[:160])
    subprocess.run(['cp','-a','/home/.','/mnt/quota-home/'],check=True)
    subprocess.run(['umount','/mnt/quota-home'],check=True)
    subprocess.run(['mount','-o','usrquota',quota_image,'/home'],check=True)
    # Linux x86_64 quotactl_fd, Q_SETQUOTA/USRQUOTA and QIF_BLIMITS.
    class Dqblk(ctypes.Structure):
        _fields_=[(n,ctypes.c_uint64) for n in ('hard','soft','current','ihard','isoft','icurrent','btime','itime')]+[('valid',ctypes.c_uint32)]
    home_fd=os.open('/home',os.O_RDONLY|os.O_DIRECTORY)
    try:
        for uid in uids:
            block=Dqblk(hard=64*1024,valid=1)
            check(ctypes.CDLL(None,use_errno=True).syscall(ctypes.c_long(443),ctypes.c_int(home_fd),ctypes.c_uint(0x800008<<8),ctypes.c_uint(uid),ctypes.byref(block))==0,'fixture native quota setup')
    finally:os.close(home_fd)
    # Production preparation publishes the storage policy for this home, the
    # proc exemption group and the storage, binding-gate, broker and listener
    # units. Socket units require that boot guard; never hand-install them.
    uuid=subprocess.check_output(['blkid','-s','UUID','-o','value',quota_image],text=True).strip()
    site_path='/etc/open-habitat/site.json'
    site=json.loads(pathlib.Path(site_path).read_text());site['storage']['home_uuid']=uuid
    pathlib.Path(site_path).write_text(json.dumps(site))
    def prepare(*args):
        p=subprocess.run(['/opt/open-habitat/current/open-habitat','host','prepare','--site',site_path,*args],capture_output=True,text=True,timeout=300)
        check(p.returncode==0,'host prepare '+(p.stderr or p.stdout)[-300:].replace(':',' '))
        return p.stdout
    plan=json.loads(prepare('--dry-run','--json'))['data']['plan']
    check(plan['approvable'],'host prepare plan not approvable')
    outcome=json.loads(prepare('--approved-plan',plan['plan_id'],'--approve-disruption','--output=jsonl').splitlines()[-1])
    check(outcome.get('event')=='result' and outcome['data']['outcome']=='prepared','host prepare outcome')
    subprocess.run(['systemd-tmpfiles','--create','/etc/tmpfiles.d/open-habitat.conf'],check=True)
    for name,uid in zip(names,uids):
        home=pathlib.Path('/home')/name
        check(pwd.getpwnam(name).pw_uid==uid and home.stat().st_uid==uid and stat.S_IMODE(home.stat().st_mode)==0o700,'home identity')
        src=home/'src'; src.mkdir(mode=0o700)
        for kind in ('ordinary','git-hint','no-metadata'):
            p=src/(name+'-'+kind);p.mkdir();(p/'SENTINEL').write_text(name+'-only-'+kind)
        (src/(name+'-git-hint')/'.git').mkdir()
        (src/'escape').symlink_to('/home/'+('agent-b' if name=='agent-a' else 'agent-a'))
        subprocess.run(['chown','-R',str(uid)+':'+str(uid),str(home)],check=True)
        (home/'SYNTHETIC-IDENTITY').write_text(name+'-only')
        subprocess.run(['chown',str(uid)+':'+str(uid),str(home/'SYNTHETIC-IDENTITY')],check=True)
        (home/'SYNTHETIC-IDENTITY').chmod(0o600)
    check(pwd.getpwnam('open-habitat-gateway').pw_uid==gateway_uid,'gateway UID')
    # These are PRE-PROVISIONED static bindings, not a browser-driven JIT test.
    # The broker and its binding gate build the per-user runtime directories
    # and named search ACLs, as on a production boot.
    runtime=pathlib.Path('/run/open-habitat');root=runtime/'users'
    # The broker and gate verify these exact files before restoring a listener.
    for name in names+['gateway']:
        config=(pathlib.Path('/etc/open-habitat/gateway.json') if name=='gateway'
                else pathlib.Path('/etc/open-habitat-daemon/daemon/user-mappings')/('daemon-'+name+'.json'))
        gid=pwd.getpwnam('open-habitat-gateway' if name=='gateway' else name).pw_gid
        os.chown(config,0,gid);config.chmod(0o640)
        check(config.stat().st_uid==0 and config.stat().st_gid==gid and stat.S_IMODE(config.stat().st_mode)==0o640,'trusted config owner/mode')
    subprocess.run(['systemctl','daemon-reload'],check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['systemctl','start','open-habitat-broker.socket'],check=True,stdout=subprocess.DEVNULL)
    broker=runtime/'broker.sock';st=broker.stat()
    check(stat.S_ISSOCK(st.st_mode) and st.st_uid==0 and st.st_gid==gateway_uid and stat.S_IMODE(st.st_mode)==0o660,'broker socket ACL')
    check(denied('agent-a',"import socket;s=socket.socket(socket.AF_UNIX);s.connect('/run/open-habitat/broker.sock')"),'cross user broker socket')
    with open('/etc/hosts','a') as f:f.write('\n127.0.0.1 github.com api.github.com host.fixture\n')
    for name in names:
        subprocess.run(['systemctl','start','open-habitat-daemon@'+name+'.socket'],check=True,stdout=subprocess.DEVNULL)
        p=root/name/'daemon.sock';st=p.stat()
        check(st.st_uid==pwd.getpwnam(name).pw_uid and st.st_gid==gateway_uid and stat.S_IMODE(st.st_mode)==0o660,'socket ownership')
    # Current daemon activation includes both browser and own-user listeners.
    for name in names:
        subprocess.run(['systemctl','start','open-habitat-agent@'+name+'.socket'],check=True,stdout=subprocess.DEVNULL)
    # Exercise the real root broker handler through the gateway UID before
    # OAuth, not a fixture route returned directly by the browser.
    broker_probe=as_user('open-habitat-gateway',"import json,socket,struct;s=socket.socket(socket.AF_UNIX);s.settimeout(8);s.connect('/run/open-habitat/broker.sock');b=json.dumps({'version':1,'operation':'authorize','provider':'github','id':'31001'}).encode();s.sendall(struct.pack('>I',len(b))+b);s.shutdown(socket.SHUT_WR);h=s.recv(4);print(s.recv(struct.unpack('>I',h)[0]).decode())")
    broker_state=subprocess.check_output(['systemctl','show','-P','SubState','open-habitat-broker.service']).decode().strip()
    broker_reply=json.loads(broker_probe.stdout) if broker_probe.returncode==0 else {}
    check(broker_reply.get('route',{}).get('uid')==21001,'broker authorize '+broker_state+' failure '+str(broker_reply.get('failure','transport'))+' error '+broker_probe.stderr.decode('ascii','replace').splitlines()[-1:][0:1].__str__()[:90])
    key=pathlib.Path('/etc/open-habitat/tls.key')
    os.chown(key,0,gateway_uid);key.chmod(0o640)
    provider=subprocess.Popen(['/usr/bin/python3','/usr/local/sbin/product-fake-provider'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(30):
            if provider.poll() is not None:raise RuntimeError('fixture provider exited')
            try:
                socket.create_connection(('127.0.0.1',443),1).close();break
            except OSError:time.sleep(.2)
        else:raise RuntimeError('fixture provider not ready')
        gateway_state=pathlib.Path('/var/lib/open-habitat-gateway')
        gateway_state.mkdir(mode=0o700,exist_ok=True)
        os.chown(gateway_state,gateway_uid,gateway_uid);gateway_state.chmod(0o700)
        settings=gateway_state/'administration.json'
        settings.write_text(json.dumps({'version':1,'name':'Fixture','administrators':[],'default_limit_bytes':64<<20}))
        os.chown(settings,gateway_uid,gateway_uid);settings.chmod(0o600)
        subprocess.run(['systemctl','start','open-habitat-revoke.socket'],check=True,stdout=subprocess.DEVNULL)
        subprocess.run(['systemctl','start','product-gateway.service'],check=True,stdout=subprocess.DEVNULL)
        ctx=ssl.create_default_context(cafile='/etc/open-habitat/fixture-ca.crt')
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self,*args): return None
        def browser():
            jar=http.cookiejar.CookieJar();op=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx),urllib.request.HTTPCookieProcessor(jar),NoRedirect());return op,jar
        def get(op,path,headers={}):
            req=urllib.request.Request(base+path,headers=headers)
            try:
                with op.open(req,timeout=12) as res:return res.status,res.headers, res.read()
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
        for name in names:
            probe=as_user('open-habitat-gateway',"import socket;s=socket.socket(socket.AF_UNIX);s.settimeout(5);s.connect(%r);s.sendall(b'GET /healthz HTTP/1.1\\r\\nHost: unix\\r\\nConnection: close\\r\\n\\r\\n');print(s.recv(1024).split(b'\\r\\n')[0].decode())"%str(root/name/'daemon.sock'))
            if probe.returncode!=0 or b'200' not in probe.stdout:
                state=subprocess.check_output(['systemctl','show','-P','SubState','open-habitat-daemon@'+name+'.service']).decode().strip()
                journal=subprocess.run(['journalctl','-u','open-habitat-daemon@'+name+'.service','-n','20','--no-pager','-o','cat'],capture_output=True).stdout
                codes=[c.decode() for c in (b'activation_failed',b'invalid daemon socket activation',b'native_adapter_unavailable',b'native credential adapter unavailable',b'config_io',b'server_failed',b'permission denied') if c in journal]
                errors=[c.decode() for c in (b'PermissionError',b'ConnectionResetError',b'ConnectionRefusedError',b'TimeoutError',b'FileNotFoundError') if c in probe.stderr]
                exitcode=subprocess.check_output(['systemctl','show','-P','ExecMainStatus','open-habitat-daemon@'+name+'.service']).decode().strip()
                detail=''
                for line in journal.decode('utf-8','replace').splitlines():
                    if line.strip().startswith('{'):
                        try:
                            data=json.loads(line);detail=data.get('error',{}).get('code','')
                        except ValueError:pass
                act=pathlib.Path('/home')/name/'activation.json'
                envelope=json.loads(act.read_text()) if act.exists() else {}
                raise RuntimeError('daemon health '+name+' rc '+str(probe.returncode)+' state '+state+' exit '+exitcode+' code '+str(detail)+' journal '+','.join(codes)+' probe '+','.join(errors)+' activation pidmatch '+str(envelope.get('pid','')==int(envelope.get('listen_pid') or 0))+' fds '+str(envelope.get('listen_fds',''))+' fdnames '+str(envelope.get('listen_fdnames',''))+' pathmatch '+str(envelope.get('socket','')==str(root/name/'daemon.sock')))
        routes=[]; captures=[]; browsers=[]; editor_ids=[]
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
                code=json.loads(body).get('error',{}).get('code','unknown')
                log=pathlib.Path('/home')/name/'gh-argv.jsonl'
                count=len(log.read_text().splitlines()) if log.exists() else 0
                pid=subprocess.check_output(['systemctl','show','-P','MainPID','open-habitat-daemon@'+name+'.service']).decode().strip()
                state=subprocess.check_output(['systemctl','show','-P','SubState','open-habitat-daemon@'+name+'.service']).decode().strip()
                journal=subprocess.run(['journalctl','-u','open-habitat-daemon@'+name+'.service','-n','20','--no-pager','-o','cat'],capture_output=True).stdout
                codes=[c.decode() for c in (b'activation_failed',b'invalid daemon socket activation',b'native_adapter_unavailable',b'native credential adapter unavailable',b'config_io',b'server_failed',b'permission denied') if c in journal]
                diagnostic="import json,os,socket,sys,struct;b=json.dumps(dict(version=1,nonce=os.urandom(16).hex(),provider='github',subject=%r,uid=%d,username=%r,token=sys.stdin.read())).encode();s=socket.socket(socket.AF_UNIX);s.settimeout(7);s.connect(%r);print('PEERUID',struct.unpack('3i',s.getsockopt(socket.SOL_SOCKET,socket.SO_PEERCRED,12))[1]);s.sendall(b'POST /internal/v1/native-credentials/github HTTP/1.1\\r\\nHost: unix\\r\\nContent-Type: application/json\\r\\nContent-Length: '+str(len(b)).encode()+b'\\r\\nConnection: close\\r\\n\\r\\n'+b);print(s.recv(1024).split(b'\\r\\n')[0].decode())"%(str(31001+index),uids[index],name,str(root/name/'daemon.sock'))
                direct=as_user('open-habitat-gateway',diagnostic,(pathlib.Path('/usr/local/lib/fixture/tokens')/name).read_bytes())
                direct_code=direct.stdout.decode('ascii','replace').strip().replace('/','_').replace('.','_')[:30] if direct.returncode==0 else 'probe_failed'
                entry=pathlib.Path('/tmp/native-gh-entry-'+str(pwd.getpwnam(name).pw_uid))
                details=json.loads(entry.read_text().splitlines()[-1]) if entry.exists() else {}
                raise RuntimeError('OAuth callback status '+str(status)+' code '+str(code)+' gh_calls '+str(count)+' direct '+direct_code+' gh_entry '+str(entry.exists())+' home_match '+str(details.get('home')=='/home/'+name)+' daemon_pid '+pid+' state '+state+' journal '+','.join(codes))
            check(b'PRODUCT_VM_TOKEN' not in body,'OAuth callback token')
            status,_,session=get(op,'/auth/session');check(status==200 and json.loads(session)['provider']=='github','authenticated session')
            status,_,snap=get(op,'/api/v1/snapshot',{'X-Agent-Host-UID':str(uids[1-index]),'X-Agent-Host-Username':names[1-index],'X-Agent-Host-Socket':'/run/open-habitat/users/'+names[1-index]+'/daemon.sock','X-Agent-Host-Identity':'forged'})
            if status!=200:
                try: snap_code=json.loads(snap).get('error',{}).get('code','unknown')
                except (ValueError,TypeError,AttributeError): snap_code='invalid_response'
                raise RuntimeError('snapshot status '+str(status)+' code '+str(snap_code)[:48])
            text=snap.decode();other=names[1-index]
            check(all(name+'-'+k in text for k in ('ordinary','git-hint','no-metadata')),'own workspace inventory')
            # Own native workspace paths are part of the details contract;
            # another person's names, home and symlink target remain forbidden.
            check(other+'-' not in text and '/home/'+other+'/' not in text,'snapshot foreign-user isolation')
            check('escape' not in text,'snapshot symlink exclusion')
            # Read and save through the authenticated gateway, not a direct
            # daemon fixture. The daemon runs under this person's kernel UID.
            wid=next(w['workspace_id'] for w in json.loads(snap)['workspaces'] if w['name']==name+'-ordinary')
            editor_ids.append(wid)
            file_url='/api/v1/workspaces/editor/file?'+urllib.parse.urlencode({'workspace_id':wid,'path':'SENTINEL'})
            status,_,file_body=get(op,file_url)
            check(status==200 and json.loads(file_body)['content']==name+'-only-ordinary','editor own read')
            original=json.loads(file_body)
            request={'workspace_id':wid,'path':'SENTINEL','base_version':original['version'],'content':name+'-edited','bom':False,'newline':'none'}
            def save_editor(payload):
                req=urllib.request.Request(base+'/api/v1/workspaces/editor/file',data=json.dumps(payload).encode(),method='PUT',headers={'Content-Type':'application/json','Origin':base,'X-Agent-Host-CSRF':json.loads(session)['csrf']})
                try:
                    with op.open(req,timeout=12) as response:return response.status,response.read()
                except urllib.error.HTTPError as error:return error.code,error.read()
            check(save_editor(request)[0]==200,'editor own save')
            status,_,file_body=get(op,file_url)
            check(status==200 and json.loads(file_body)['content']==name+'-edited','editor committed bytes')
            check(save_editor(request)[0]==409,'editor stale save')
            check(get(op,'/api/v1/workspaces/editor/file?'+urllib.parse.urlencode({'workspace_id':wid,'path':'../escape/SENTINEL'}))[0]==400,'editor traversal denial')
            routes.append({'uid':uids[index],'subject':str(31001+index),'workspace_count':3,'forged_headers_ignored':True})
            captures.extend([body,session,snap,repr([(c.name,c.value) for c in jar]).encode()])
            check(get(op,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':'a'}))[0]==403,'state replay')
        for index,op in enumerate(browsers):
            check(get(op,'/api/v1/workspaces/editor/file?'+urllib.parse.urlencode({'workspace_id':editor_ids[1-index],'path':'SENTINEL'}))[0]==404,'editor cross-user workspace denial')
        op,_=browser();status,h,_=get(op,'/auth/github/start');state=urllib.parse.parse_qs(urllib.parse.urlparse(h['Location']).query)['state'][0]
        check(get(op,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':'unknown'}))[0]==403,'unmapped numeric ID')
        check(get(op,'/api/v1/snapshot')[0]==401,'unknown session')
        source=pathlib.Path('/home/agent-a/src'); held=pathlib.Path('/home/agent-a/src-held')
        source.rename(held)
        try:
            source.symlink_to('/home/agent-b/src')
            check(get(browsers[0],'/api/v1/snapshot')[0]==503,'source symlink escape rejected')
        finally:
            source.unlink();held.rename(source)
        for name in names:
            pid=int(subprocess.check_output(['systemctl','show','-P','MainPID','open-habitat-daemon@'+name+'.service']).strip())
            check(pid>1 and ('Uid:\t'+str(pwd.getpwnam(name).pw_uid)+'\t') in pathlib.Path('/proc/%d/status'%pid).read_text(),'daemon effective UID')
            args=[a for a in pathlib.Path('/proc/%d/cmdline'%pid).read_bytes().split(b'\0') if a]
            check(args[:3]==[b'/opt/open-habitat/current/open-habitat',b'daemon',b'exec'] and args[-1]==('/etc/open-habitat-daemon/daemon/user-mappings/daemon-'+name+'.json').encode(),'daemon config argv')
            other=names[1-names.index(name)]
            sock=str(root/other/'daemon.sock')
            check(denied(name,"import socket;s=socket.socket(socket.AF_UNIX);s.connect(%r)"%sock),'cross user route')
            check(denied(name,"open(%r).read()"%('/home/'+other+'/SYNTHETIC-IDENTITY')),'cross user home')
            check(denied('open-habitat-gateway',"open(%r).read()"%('/home/'+name+'/SYNTHETIC-IDENTITY')),'gateway home')
            check(denied('open-habitat-gateway',"open(%r).read()"%('/home/'+name+'/.config/gh/hosts.yml')),'gateway credential')
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
        subprocess.run(['systemctl','stop','open-habitat-daemon@agent-a.socket','open-habitat-daemon@agent-a.service'],check=True,stdout=subprocess.DEVNULL)
        # Broker refuses a stopped route before daemon routing (401), while
        # older sink-only failure returned 503. Both must deny without data.
        check(get(browsers[0],'/api/v1/snapshot')[0] in (401,503),'stopped A has no fallback')
        check(get(browsers[1],'/api/v1/snapshot')[0]==200,'stopped A does not affect B')
        subprocess.run(['systemctl','start','open-habitat-daemon@agent-a.socket'],check=True,stdout=subprocess.DEVNULL)
        check(get(browsers[0],'/api/v1/snapshot')[0]==200,'A socket reactivates its own daemon')
        for token_name in names:
            token=pathlib.Path('/usr/local/lib/fixture/tokens')/token_name
            value=token.read_bytes()
            check(value and all(value not in b for b in captures),'browser capture token scan')
            for p in pathlib.Path('/proc').iterdir():
                if not p.name.isdigit():continue
                for suffix in ('cmdline','environ'):
                    try:check(value not in (p/suffix).read_bytes(),'process token scan')
                    except (FileNotFoundError,ProcessLookupError):continue
            for unit in ['product-gateway','open-habitat-daemon@agent-a','open-habitat-daemon@agent-b','open-habitat-broker']:
                logs=subprocess.run(['journalctl','-u',unit,'-n','100','--no-pager','-o','cat'],capture_output=True,timeout=10).stdout[:65536]
                check(value not in logs,'journal token scan')
            for p in ['/etc/open-habitat/gateway.json','/etc/open-habitat-daemon/daemon/user-mappings/daemon-agent-a.json','/etc/open-habitat-daemon/daemon/user-mappings/daemon-agent-b.json']:
                check(value not in pathlib.Path(p).read_bytes(),'config token scan')
        result={'status':'passed','scope':'product-two-user-routing','pid1':'systemd','uids':[21001,21002,21003],'socket_mode':'0660','socket_activation':True,'routes':routes,'editor_files':{'own_read_save':True,'stale_denied':True,'traversal_denied':True,'foreign_workspace_denied':True},'native_gh':{'stdin_only':True,'exact_argv':True,'protected_file':True,'credential_isolated':True},'denials':{'cross_user_broker':True,'unknown_identity':True,'unknown_session':True,'state_replay':True,'root_peer':True,'cross_user_home':True,'cross_user_socket':True,'gateway_home':True,'forged_headers':True,'symlink_excluded':True},'token_scan':{'passed':True,'allowed':'per-user protected gh credential and fixture provider inputs','scanned':'browser captures, bounded journal, process argv/environ, configs, child argv logs'}}
    finally:provider.terminate();provider.wait(timeout=5)
except Exception as e:
    # FileNotFoundError retains the missing executable/path; no fixture token
    # is printed. Keep a bounded, redacted journal-code receipt for PID1 boots.
    missing=getattr(e,'filename',None)
    result['reason']=(type(e).__name__+' '+str(missing or str(e)).split(':')[0])[:220]
    codes={}
    for unit in ('product-gateway','open-habitat-broker','open-habitat-daemon@agent-a','open-habitat-daemon@agent-b'):
        journal=subprocess.run(['journalctl','-u',unit,'-n','12','--no-pager','-o','cat'],capture_output=True).stdout
        codes[unit]=[]
        for line in journal.decode('utf-8','replace').splitlines():
            if line.startswith('{'):
                try:
                    entry=json.loads(line)
                    code=entry.get('error',{}).get('code') or entry.get('reason')
                    if isinstance(code,str) and code.replace('_','').isalnum():codes[unit].append(code[:64])
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
        for path in ('/run/open-habitat','/run/open-habitat/users',str(root/names[0]),str(root/names[1])):
            p=subprocess.run(['getfacl','-cpn',path],capture_output=True,text=True)
            diag[path]=p.stdout.strip().replace('\n',';')[:220] if p.returncode==0 else 'exit '+str(p.returncode)
        for unit in ('open-habitat-broker.service','open-habitat-daemon@agent-a.service','open-habitat-daemon@agent-a.socket'):
            p=subprocess.run(['systemctl','show',unit,'--property=ActiveState,ExecMainStatus,SocketMode,DirectoryMode,Listen,ExecStart','--no-pager'],capture_output=True,text=True)
            diag[unit]=p.stdout.strip().replace('\n',';')[:300]
        result['diagnostic']=diag
    if codes.get('open-habitat-broker'):
        result['reason']=(result['reason']+' broker '+','.join(codes['open-habitat-broker']))[:220]
print('VM_PROOF='+json.dumps(result,separators=(',',':')),flush=True)
subprocess.run(['systemd-run','--on-active=15s','--unit=fixture-shutdown','/usr/bin/systemctl','poweroff','--no-block'],stdout=subprocess.DEVNULL)
if result['status']!='passed':sys.exit(1)
