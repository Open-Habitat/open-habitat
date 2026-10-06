#!/usr/bin/python3
"""Networkless rootless container proof: production CLI and real pinned Pi, no fixture build mode."""
import http.cookiejar
import http.server
import json
import os
import pathlib
import pwd
import shutil
import socket
import ssl
import stat
import struct
import subprocess
import sys
import tarfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

NAMES = ('agent-a', 'agent-b')
UIDS = (21001, 21002)
GATEWAY = 21003
ORIGIN = 'https://host.fixture:8443'
RUNTIME = pathlib.Path('/opt/open-habitat/fixture-pi')
PKG = RUNTIME / 'node_modules/@earendil-works/pi-coding-agent'
children = []

def check(ok, message):
    if not ok:
        raise RuntimeError(message)

def put(path, data, mode=0o644, owner=0, group=0):
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(data if isinstance(data, str) else json.dumps(data))
    os.chown(path, owner, group)
    path.chmod(mode)

def drop(uid, gid=None):
    def change():
        os.setgroups([])
        os.setgid(uid if gid is None else gid)
        os.setuid(uid)
    return change

def start(args, uid=None, env=None, fd=None, fdname='daemon'):
    def prepare():
        os.environ.update(env or {})
        if uid is not None:
            drop(uid)()
    if fd is not None:
        trampoline = 'import os,sys;fd=int(sys.argv[1]);os.dup2(fd,3);os.set_inheritable(3,True);os.environ.update(LISTEN_PID=str(os.getpid()),LISTEN_FDS="1",LISTEN_FDNAMES=sys.argv[2]);os.execv(sys.argv[3],sys.argv[3:])'
        args = ['/usr/bin/python3','-c',trampoline,str(fd),fdname,*args]
    p = subprocess.Popen(args, preexec_fn=prepare, pass_fds=(() if fd is None else (fd,)))
    children.append(p)
    return p

def denied(uid, code):
    p = subprocess.run(['/usr/bin/python3','-c',code], preexec_fn=drop(uid), capture_output=True)
    return p.returncode != 0 and b'PermissionError' in p.stderr

def wait(condition, label, seconds=15):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if condition(): return
        time.sleep(.1)
    raise RuntimeError(label)

def browser():
    jar = http.cookiejar.CookieJar()
    ctx = ssl.create_default_context(cafile='/etc/open-habitat/tls.crt')
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args): return None
    return urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx), urllib.request.HTTPCookieProcessor(jar), NoRedirect()), jar

def request(op, path, obj=None, csrf=None, headers=None):
    h = dict(headers or {})
    data = None
    if obj is not None:
        data = json.dumps(obj).encode()
        h.update({'Content-Type':'application/json', 'Origin':ORIGIN, 'X-Agent-Host-CSRF':csrf or ''})
    if path.endswith(("/stop","/continue")):
        h.update({"Origin":ORIGIN,"X-Agent-Host-CSRF":csrf or ""})
    req = urllib.request.Request(ORIGIN+path, data=data, headers=h,method="POST" if path.endswith(("/stop","/continue")) else None)
    try:
        with op.open(req, timeout=20) as r: return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e: return e.code, e.headers, e.read()

# Root-owned broker *protocol fixture*: pre-provisioned static routes, NOT a real
# provisioning broker or proof of systemd/NSS reconciliation. The production
# gateway still uses its normal broker client, identity and socket validations.
def broker(listener):
    while True:
        try:
            c, _ = listener.accept()
            with c:
                c.settimeout(3)
                raw = c.recv(4)
                if len(raw) != 4: continue
                n = struct.unpack('>I',raw)[0]
                if n > 4096: continue
                body = b''
                while len(body) < n:
                    part = c.recv(n-len(body))
                    if not part: break
                    body += part
                r = json.loads(body)
                index = {'31001':0,'31002':1}.get(r.get('id'))
                if r.get('version') != 1 or r.get('provider') != 'github' or r.get('operation') not in ('authorize','ensure'):
                    index = None
                if index is None:
                    answer = {'version':1,'failure':'denied'}
                else:
                    name = NAMES[index]
                    answer = {'version':1,'route':{'uid':UIDS[index], 'username':name, 'socket':f'/run/open-habitat/users/{name}/daemon.sock'}, 'generation':2,'epoch':2}
                b = json.dumps(answer).encode()
                c.sendall(struct.pack('>I',len(b))+b)
        except (OSError, ValueError, KeyError):
            continue

class Model(http.server.BaseHTTPRequestHandler):
    calls = []
    def log_message(self,*args): pass
    def do_POST(self):
        size = int(self.headers.get('Content-Length','0'))
        if self.path != '/v1/chat/completions' or self.headers.get('Authorization') != 'Bearer synthetic' or not 0 < size <= 100000:
            return self.send_error(403)
        body = json.loads(self.rfile.read(size))
        if not any('native proof' in str(m.get('content','')) for m in body.get('messages',[])):
            return self.send_error(400)
        self.calls.append(body)
        self.send_response(200)
        self.send_header('Content-Type','text/event-stream')
        self.end_headers()
        for delta, finish in [({'role':'assistant','content':'hello from synthetic'},None),({},'stop')]:
            chunk={'id':'fixture','object':'chat.completion.chunk','created':0,'model':'fake','choices':[{'index':0,'delta':delta,'finish_reason':finish}]}
            self.wfile.write(b'data: '+json.dumps(chunk).encode()+b'\n\n')
            self.wfile.flush()
            if delta.get('content') and len(self.calls)==2: time.sleep(12)
        self.wfile.write(b'data: [DONE]\n\n')

def socket_ready(path):
    return pathlib.Path(path).exists()

def port_ready(port):
    try:
        with socket.create_connection(('127.0.0.1',port),.2):return True
    except OSError:return False

try:
    check(os.getuid()==0 and pathlib.Path('/proc/self/uid_map').read_text().splitlines()[0].split()[1] != '0', 'requires rootless mapped container root')
    check(not pathlib.Path('/dev/kvm').exists(), 'unexpected hardware guest')
    check(not pathlib.Path('/home/maintainer').exists(), 'real home must not be mounted')
    for i, name in enumerate(NAMES):
        uid = UIDS[i]
        with open('/etc/passwd','a') as f: f.write(f'{name}:x:{uid}:{uid}::/home/{name}:/bin/sh\n')
        with open('/etc/group','a') as f: f.write(f'{name}:x:{uid}:\n')
        home = pathlib.Path('/home')/name
        (home/'src'/f'{name}-ordinary').mkdir(parents=True)
        (home/'SYNTHETIC-IDENTITY').write_text(name+'-only')
        agent=home/'.pi/agent'; agent.mkdir(parents=True)
        put(agent/'auth.json', {'openai-codex':{'type':'oauth','access':'synthetic','refresh':'synthetic','expires':4102444800000}},0o600,uid,uid)
        put(agent/'models.json',{'providers':{'fixture':{'baseUrl':'http://127.0.0.1:18743/v1','api':'openai-completions','apiKey':'synthetic','authHeader':True,'models':[{'id':'fake','name':'Fake','reasoning':False}]}}},0o600,uid,uid)
        put(agent/'settings.json',{'defaultProvider':'fixture','defaultModel':'fake'},0o600,uid,uid)
        (home/'SYNTHETIC-IDENTITY').chmod(0o600)
        subprocess.run(['chown','-R',f'{uid}:{uid}',str(home)],check=True)
        os.chmod(home,0o700)
    with open('/etc/passwd','a') as f:f.write('open-habitat-gateway:x:21003:21003::/var/empty/open-habitat-gateway:/bin/sh\n')
    with open('/etc/group','a') as f:f.write('open-habitat-gateway:x:21003:\n')
    RUNTIME.mkdir(parents=True)
    with tarfile.open('/fixture/node.tar.xz') as archive:
        node = archive.extractfile('node-v22.21.1-linux-x64/bin/node')
        (RUNTIME/'bin').mkdir()
        with (RUNTIME/'bin/node').open('wb') as f:shutil.copyfileobj(node,f)
    (RUNTIME/'bin/node').chmod(0o755)
    with tarfile.open('/fixture/pi.tar.gz') as archive:
        archive.extractall(RUNTIME, filter='data')
    for path in RUNTIME.rglob('*'):
        if path.is_symlink(): continue
        mode = path.stat().st_mode
        path.chmod(0o755 if path.is_dir() or mode & 0o111 else 0o644)
    check(subprocess.check_output([str(RUNTIME/'bin/node'),'--version']).strip()==b'v22.21.1', 'node pin')
    check(json.loads((PKG/'package.json').read_text())['version']=='0.85.1','Pi pin')
    check(all(p.lstat().st_uid==0 and (p.is_symlink() or not p.stat().st_mode & 0o022) for p in [RUNTIME,*RUNTIME.rglob('*')]),'immutable root-owned runtime')
    put('/opt/open-habitat/pi-runtime.json',{'node':str(RUNTIME/'bin/node'),'entry':str(PKG/'dist/index.js'),'manifest':str(PKG/'package.json')})
    gateway_dir = pathlib.Path('/etc/open-habitat')
    gateway_dir.mkdir(parents=True, exist_ok=True)
    os.chown(gateway_dir, 0, GATEWAY)
    gateway_dir.chmod(0o750)
    check(all(denied(uid, "open('/etc/open-habitat/pi-runtime.json').read()") for uid in UIDS), 'mapped UID reached gateway secret directory')
    check(all(subprocess.run(['/usr/bin/python3','-c',"open('/opt/open-habitat/pi-runtime.json').read()"],preexec_fn=drop(uid)).returncode==0 for uid in UIDS), 'mapped UID cannot read shared selector')
    pathlib.Path('/usr/local/lib/fixture/tokens').mkdir(parents=True)
    for name in NAMES:
        put('/usr/local/lib/fixture/tokens/'+name,'PRODUCT_VM_TOKEN_'+name.replace('-','_')+'_FIXTURE_ONLY_92764',0o600)
    for src,dest in [('gh.py','gh'),('git.py','git')]:
        shutil.copyfile('/fixture/'+src,'/usr/bin/'+dest);os.chmod('/usr/bin/'+dest,0o755)
    # The helper is embedded in the product; this copy is diagnostic only.
    shutil.copyfile('/fixture/helper.mjs','/opt/open-habitat/status-diagnostic.mjs')
    os.chmod('/opt/open-habitat/status-diagnostic.mjs',0o644)
    model=http.server.ThreadingHTTPServer(('127.0.0.1',18743),Model)
    threading.Thread(target=model.serve_forever,daemon=True).start()
    runtime=pathlib.Path('/run/open-habitat')
    runtime.mkdir(exist_ok=True);os.chown(runtime,0,GATEWAY);runtime.chmod(0o750)
    users=runtime/'users';users.mkdir();os.chown(users,0,GATEWAY);users.chmod(0o710)
    for uid in UIDS:
        subprocess.run(['setfacl','-n','-m',f'u:{uid}:--x,m::r-x',str(runtime)],check=True)
        subprocess.run(['setfacl','-m',f'u:{uid}:--x',str(users)],check=True)
    broker_socket=socket.socket(socket.AF_UNIX);broker_socket.bind(str(runtime/'broker.sock'));os.chown(runtime/'broker.sock',0,GATEWAY);os.chmod(runtime/'broker.sock',0o660);broker_socket.listen(10)
    threading.Thread(target=broker,args=(broker_socket,),daemon=True).start()
    for index,name in enumerate(NAMES):
        uid=UIDS[index]
        directory=users/name;directory.mkdir();directory.chmod(0o710)
        for allowed in (GATEWAY,uid):subprocess.run(['setfacl','-m',f'u:{allowed}:--x',str(directory)],check=True)
        subprocess.run(['setfacl','-m','g::---',str(directory)],check=True)
        path=directory/'daemon.sock';s=socket.socket(socket.AF_UNIX);s.bind(str(path));os.chown(path,uid,GATEWAY);os.chmod(path,0o660);s.listen(64)
        binding=f'/etc/open-habitat-daemon/daemon/user-mappings/daemon-{name}.json'
        put(binding,{'component':'daemon','handoff':{'gateway_uid':GATEWAY,'uid':uid,'username':name,'home':'/home/'+name,'socket':str(path),'provider':'github','subject':str(31001+index),'binding_file':binding}},0o640,0,uid)
        for parent in ('/etc/open-habitat-daemon','/etc/open-habitat-daemon/daemon','/etc/open-habitat-daemon/daemon/user-mappings'):
            os.chmod(parent,0o711)
        p=start(['/fixture/product','daemon','exec','--config',binding],uid,{'HOME':'/home/'+name,'PATH':'/usr/bin:/bin'},s.fileno())
        s.close()
        wait(lambda:p.poll() is not None or socket_ready(path),'daemon listener '+name,5)
        check(p.poll() is None,'daemon died '+name)
    check(denied(UIDS[0],"open('/home/agent-b/SYNTHETIC-IDENTITY').read()"),'cross UID home')
    check(denied(GATEWAY,"open('/home/agent-a/SYNTHETIC-IDENTITY').read()"),'gateway home')
    for index,name in enumerate(NAMES):
        other=NAMES[1-index]
        check(denied(UIDS[index],f"import socket;s=socket.socket(socket.AF_UNIX);s.connect('/run/open-habitat/users/{other}/daemon.sock')"),'cross UID UDS')
        with socket.socket(socket.AF_UNIX) as root_peer:
            root_peer.settimeout(2)
            root_peer.connect(f'/run/open-habitat/users/{name}/daemon.sock')
            root_peer.sendall(b'GET /healthz HTTP/1.1\r\nHost: unix\r\n\r\n')
            try: reply=root_peer.recv(64)
            except ConnectionResetError:reply=b''
            check(reply==b'','root peer refused by daemon')
    subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=github.com','-addext','subjectAltName=DNS:github.com,DNS:api.github.com,DNS:host.fixture','-keyout','/etc/open-habitat/tls.key','-out','/etc/open-habitat/tls.crt'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    os.chown('/etc/open-habitat/tls.key',0,GATEWAY);os.chmod('/etc/open-habitat/tls.key',0o640)
    with open('/etc/hosts','a') as f:f.write('\n127.0.0.1 github.com api.github.com host.fixture\n')
    shutil.copyfile('/fixture/provider.py','/usr/local/sbin/product-fake-provider');os.chmod('/usr/local/sbin/product-fake-provider',0o755)
    provider=start(['/usr/bin/python3','/usr/local/sbin/product-fake-provider'])
    wait(lambda:provider.poll() is not None or port_ready(443),'OAuth fixture',5)
    check(provider.poll() is None,'OAuth fixture failed')
    config='/etc/open-habitat/gateway.json'
    put(config,{'component':'gateway','listen':'127.0.0.1:8443','tls_cert':'/etc/open-habitat/tls.crt','tls_key':'/etc/open-habitat/tls.key','gateway_uid':GATEWAY,'oauth':{'client_id':'fixture-client','client_secret':'fixture-secret','callback_url':ORIGIN+'/auth/github/callback','origin':ORIGIN}},0o640,0,GATEWAY)
    # Product gateway requires systemd-style activation for its private,
    # root-owned revocation listener; the guest simulates only that descriptor.
    revoke=pathlib.Path('/run/open-habitat/revoke.sock')
    control=socket.socket(socket.AF_UNIX)
    control.bind(str(revoke))
    os.chown(revoke,0,0);revoke.chmod(0o600)
    control.listen(8)
    gateway=start(['/fixture/product','gateway','exec','--config',config],GATEWAY,{'HOME':'/var/empty/open-habitat-gateway','SSL_CERT_FILE':'/etc/open-habitat/tls.crt'},control.fileno(),fdname='revoke')
    control.close()
    wait(lambda:gateway.poll() is not None or port_ready(8443),'gateway listener',5)
    check(gateway.poll() is None,'gateway died')
    handles=[];browsers=[];browser_csrf=[]
    for index,name in enumerate(NAMES):
        op,jar=browser();browsers.append(op)
        status,h,_=request(op,'/auth/github/start')
        check(status==302,'OAuth start')
        state=urllib.parse.parse_qs(urllib.parse.urlparse(h['Location']).query)['state'][0]
        check('code_challenge=' in h['Location'],'PKCE')
        status,_,body=request(op,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':'a' if index==0 else 'b'}))
        check(status==303,'OAuth callback '+str(status)+' '+body[:120].decode(errors='replace'))
        status,_,body=request(op,'/auth/session');check(status==200,'session')
        csrf=json.loads(body)['csrf'];browser_csrf.append(csrf)
        status,_,snap=request(op,'/api/v1/snapshot',headers={'X-Agent-Host-UID':str(UIDS[1-index]),'X-Agent-Host-Socket':f'/run/open-habitat/users/{NAMES[1-index]}/daemon.sock'})
        if status != 200:
            start_status=time.monotonic()
            direct=subprocess.run([str(RUNTIME/'bin/node'),'/opt/open-habitat/status-diagnostic.mjs',str(PKG/'dist/index.js'),str(PKG/'package.json'),'status'],preexec_fn=drop(UIDS[index]),env={'HOME':'/home/'+name,'PATH':'/usr/bin:/bin','PI_OFFLINE':'1'},capture_output=True,timeout=20)
            print('status diagnostic',name,round(time.monotonic()-start_status,2),direct.returncode,direct.stdout[-100:],direct.stderr[:180],file=sys.stderr)
        check(status==200,'snapshot '+str(status)+' '+snap[:120].decode(errors='replace'))
        check(f'{name}-ordinary'.encode() in snap and f'{NAMES[1-index]}-ordinary'.encode() not in snap,'snapshot identity')
        starting_cursor=json.loads(snap)['event_cursor']
        ws=json.loads(snap)['workspaces'][0]['workspace_id']
        check(request(op,'/api/v1/conversations',{'workspace_id':ws},'wrong')[0]==403,'CSRF')
        status,_,data=request(op,'/api/v1/conversations',{'workspace_id':ws},csrf)
        check(status==200,'create '+str(status)+' '+data[:140].decode(errors='replace'))
        agent=json.loads(data)['agent_id'];handles.append(agent)
        route='/api/v1/conversations/'+agent[3:]
        msg='native proof '+name
        command=f'aabbccdd-0000-4000-8000-{index+1:012d}'
        if index==0:
            # The browser loses the acknowledgement, not the native send.
            cookie='; '.join(c.name+'='+c.value for c in jar)
            data=json.dumps({'message':msg,'command_id':command}).encode()
            head=(f'POST {route}/send HTTP/1.1\r\nHost: host.fixture:8443\r\nOrigin: {ORIGIN}\r\nX-Agent-Host-CSRF: {csrf}\r\nCookie: {cookie}\r\nContent-Type: application/json\r\nContent-Length: {len(data)}\r\nConnection: close\r\n\r\n').encode()
            ctx=ssl.create_default_context(cafile='/etc/open-habitat/tls.crt')
            conn=ctx.wrap_socket(socket.create_connection(('127.0.0.1',8443)),server_hostname='host.fixture')
            conn.sendall(head+data)
            # Drop the reply after the request has reached the loopback TLS endpoint.
            time.sleep(.15)
            conn.close()
        else:
            status,_,data=request(op,route+'/send',{'message':msg,'command_id':command},csrf)
            check(status==200,'send '+str(status)+' '+data[:120].decode(errors='replace'))
        if index==1:
            mid={}
            def live_snapshot():
                code,_,body=request(op,'/api/v1/snapshot')
                if code!=200:return False
                snap=json.loads(body)
                for a in snap['agents']:
                    if a['agent_id']==agent and any(e['kind']=='assistant.delta' for e in a['live_tail']):
                        mid.update(snap);return True
                return False
            wait(live_snapshot,'mid-turn live tail '+name,20)
            tail=next(a['live_tail'] for a in mid['agents'] if a['agent_id']==agent)
            check('hello from synthetic' in ''.join(e['payload']['text'] for e in tail if e['kind']=='assistant.delta'),'snapshot tail text')
            mid_cursor=mid['event_cursor']
        last = {}
        def settled():
            code,_,body=request(op,route+'/status')
            check(code==200,'status '+str(code))
            view=json.loads(body)
            last.update(view)
            return view['command_id']==command and view['send_receipt']=='accepted' and view['turn_settled'] is not None and view['turn_settled']['state']=='settled' and view['native_history']=='readable'
        try: wait(settled,'Pi status/settlement '+name,20)
        except RuntimeError:
            print('settlement diagnostic',name,{k:last.get(k) for k in ('state','ack','command_id','native_history')},'provider calls',len(Model.calls),file=sys.stderr)
            raise
        # Native JSONL is the source of the persistent key, never the RPC event.
        code,_,native_page=request(op,last['history_query']+'?limit=200')
        check(code==200,'native page before SSE')
        native_keys={entry['entry_key'] for entry in json.loads(native_page)['entries']}
        check(last['turn_settled']['native_key'] in native_keys and last['turn_settled']['observed_at'].endswith('Z'),'settled correlates with native history and host time')
        code,_,receipt=request(op,route+'/receipt?command_id='+command)
        check(code==200 and json.loads(receipt).get('state')=='accepted','accepted Pi RPC receipt lookup '+str(code)+' '+receipt[:200].decode(errors='replace'))
        # Read the bounded combined stream through the real gateway, then
        # reconnect from the original cursor. Queue and mid-turn tails are
        # still outside this fixture's coverage.
        events_url=ORIGIN+'/api/v1/events?after='+urllib.parse.quote(starting_cursor)
        with op.open(events_url,timeout=27) as stream:
            check(stream.status==200,'events admission')
            event_id=stream.readline().decode().strip()
            check(event_id.startswith('id: ev1:'),'event cursor')
            kind=stream.readline().decode().strip()
            body=stream.readline().decode().strip()
            check(kind.startswith('event: ') and body.startswith('data: '),'structured event frame')
            event=json.loads(body[6:]); check(event['cursor']==event_id[4:] and event['kind']=='snapshot.invalidated','event data')
            check(stream.readline()==b'\n','first SSE frame separator')
            persisted=[]
            deltas=[]
            settled_events=[]
            receipts=[]
            for _ in range(127):
                frame_id=stream.readline().decode().strip()
                frame_kind=stream.readline().decode().strip()
                frame_body=stream.readline().decode().strip()
                check(frame_id.startswith('id: ') and frame_body.startswith('data: '),'bounded event frame')
                frame=json.loads(frame_body[6:])
                if frame_kind=='event: assistant.delta': deltas.append(frame)
                if frame_kind=='event: turn.settled': settled_events.append(frame)
                if frame_kind=='event: command.changed': receipts.append(frame)
                if frame_kind=='event: history.entry':
                    check(frame['native_key'] in native_keys and frame['payload']['entry_key']==frame['native_key'],'persistent JSONL key')
                    persisted.append(frame)
                    # Keep reading through turn.settled after native history publication.
                check(stream.readline()==b'\n','SSE frame separator')
                if settled_events and persisted and deltas and any(r['payload']['acceptance']=='accepted' and r['payload']['client_command_id']==command for r in receipts): break
            check(settled_events and settled_events[-1]['payload']['native_key']==last['turn_settled']['native_key'],'turn settled event correlation')
            check(deltas and any(x['payload']['entry_kind']=='assistant' for x in persisted),'delta and persisted assistant SSE')
        if index==1:
            mid_url=ORIGIN+'/api/v1/events?after='+urllib.parse.quote(mid_cursor)
            with op.open(mid_url,timeout=27) as stream:
                found=False
                for _ in range(20):
                    line=stream.readline().decode().strip()
                    if not line.startswith('id: '):continue
                    resumed_kind=stream.readline().decode().strip()
                    resumed_body=stream.readline().decode().strip()
                    if resumed_kind=='event: history.entry' and json.loads(resumed_body[6:])['payload']['entry_kind']=='assistant':
                        found=True;break
                    check(stream.readline()==b'\n','mid-turn separator')
                check(found,'mid-turn resume persisted entry')
        resume=urllib.request.Request(events_url,headers={'Last-Event-ID':starting_cursor})
        with op.open(resume,timeout=27) as stream:
            check(stream.readline().decode().strip()==event_id,'reconnect replays exact cursor')
            check(stream.readline().decode().strip()==kind,'reconnect replays kind')
            check(stream.readline().decode().strip()==body,'reconnect replays exact payload')
        code,_,data=request(op,route+'/send',{'message':msg,'command_id':command},csrf)
        check(code==409,'no duplicate dispatch')
        code,_,body=request(op,route+'/status');view=json.loads(body)
        code,_,history=request(op,view['history_query']+'?limit=200')
        check(code==200 and msg.encode() in history and b'hello from synthetic' in history,'fresh native gateway history')
        check(request(op,'/auth/github/callback?'+urllib.parse.urlencode({'state':state,'code':'a'}))[0]==403,'OAuth state replay')
    for index,op in enumerate(browsers):
        foreign=handles[1-index]
        check(request(op,'/api/v1/conversations/'+foreign[3:]+'/status')[0]==404,'cross-login handle')
        check(request(op,'/api/v1/agents/'+foreign+'/history?limit=200')[0] in (404,503),'cross UID history')
    # A stopped child must release its inherited owner lock before Pi may
    # reopen the exact native JSONL (never --session-id on this path).
    for index,op in enumerate(browsers):
        route='/api/v1/conversations/'+handles[index][3:]
        code,_,body=request(op,route+'/continue',csrf=browser_csrf[index])
        check(code==409 and json.loads(body)['error']['code']=='writer_conflict','live child denies continuation')
        code,_,body=request(op,route+'/status')
        check(code==200 and json.loads(body)['continuation']=='writer_present','live child status refuses continuation')
        check(request(op,route+'/stop',csrf=browser_csrf[index])[0]==200,'stop Pi')
        wait(lambda: request(op,route+'/status')[0]==200 and json.loads(request(op,route+'/status')[2])['state']=='uncertain', 'Pi stopped', 15)
        if index == 0:
            native = next(p for p in pathlib.Path('/home/agent-a/.pi/agent/sessions').rglob('*.jsonl') if json.loads(p.read_bytes().splitlines()[0])['id']==handles[index][3:])
            with native.open('ab') as f: f.write(b'{"type":\n')
            check(json.loads(request(op,route+'/status')[2])['continuation']=='unproven','corrupt native history unproven')
            code,_,body=request(op,route+'/continue',csrf=browser_csrf[index])
            check(code==409 and json.loads(body)['error']['code']=='control_uncertain','corrupt history denies continuation')
            with native.open('rb+') as f:
                f.seek(-len(b'{"type":\n'),2); f.truncate()
        wait(lambda: json.loads(request(op,route+'/status')[2])['continuation']=='eligible','reaped child eligible',15)
        code,_,body=request(op,route+'/continue',csrf=browser_csrf[index])
        check(code==200,'continue '+str(code)+' '+body[:120].decode(errors='replace'))
        command=f'aabbccdd-0000-4000-8000-{index+3:012d}'
        code,_,body=request(op,route+'/send',{'message':'continued proof '+NAMES[index],'command_id':command},browser_csrf[index])
        check(code==200,'continued send '+str(code)+' '+body[:120].decode(errors='replace'))
        def continued():
            code,_,body=request(op,route+'/status')
            return code==200 and json.loads(body)['command_id']==command and json.loads(body)['ack']=='accepted' and json.loads(body)['native_history']=='readable'
        wait(continued,'continued Pi settlement',20)
    check(request(browsers[0],'/api/v1/conversations/'+handles[1][3:]+'/continue',csrf=browser_csrf[0])[0]==404,'foreign continue denied')
    # A terminal-native history has no host origin marker. Remove a disposable
    # fixture marker to exercise that refusal with an otherwise valid lease.
    route='/api/v1/conversations/'+handles[1][3:]
    check(request(browsers[1],route+'/stop',csrf=browser_csrf[1])[0]==200,'stop before missing-origin test')
    lock=pathlib.Path('/home/agent-b/pi-owners')/(handles[1][3:]+'.lock')
    subprocess.run(['/usr/bin/python3','-c','import sys;open(sys.argv[1],"wb").close()',str(lock)],preexec_fn=drop(UIDS[1]),check=True)
    wait(lambda: json.loads(request(browsers[1],route+'/status')[2])['state']=='uncertain','terminal fixture stopped',10)
    code,_,body=request(browsers[1],route+'/continue',csrf=browser_csrf[1])
    check(code==409 and json.loads(body)['error']['code']=='read_only_history','unmarked history denied')
    check(json.loads(request(browsers[1],route+'/status')[2])['continuation']=='read_only_history','terminal history status read-only')

    check(request(browser()[0],'/api/v1/conversations')[0]==401,'anonymous deny')
    check(len(Model.calls)==4,'one native request per send, no retry')
    # Restart a mapped daemon directly. This is not systemd service lifecycle;
    # the old controller handle is lost but native history remains readable.
    old = children[0]
    old.terminate();old.wait(timeout=5)
    path=users/'agent-a'/'daemon.sock'
    path.unlink()
    s=socket.socket(socket.AF_UNIX);s.bind(str(path));os.chown(path,UIDS[0],GATEWAY);os.chmod(path,0o660);s.listen(64)
    replacement=start(['/fixture/product','daemon','exec','--config','/etc/open-habitat-daemon/daemon/user-mappings/daemon-agent-a.json'],UIDS[0],{'HOME':'/home/agent-a','PATH':'/usr/bin:/bin'},s.fileno())
    s.close()
    wait(lambda:replacement.poll() is not None or request(browsers[0],'/api/v1/onboarding/pi/status')[0]==200,'daemon restart status',10)
    check(replacement.poll() is None,'restart daemon exited')
    code,_,data=request(browsers[0],'/api/v1/conversations/'+handles[0][3:]+'/status')
    check(code==404,'old handle cannot be reused implicitly after restart')
    code,_,data=request(browsers[0],'/api/v1/conversations/'+handles[0][3:]+'/continue',csrf=browser_csrf[0])
    check(code==200,'restart continuation after lock + history proof '+str(code)+' '+data[:120].decode(errors='replace'))
    code,_,data=request(browsers[0],'/api/v1/agents/'+handles[0]+'/history?limit=200')
    check(code==200 and b'hello from synthetic' in data,'native history after restart')
    check(len(Model.calls)==4,'restart did not resend')
    for name in NAMES:
        home=pathlib.Path('/home')/name
        check(subprocess.run(['/usr/bin/python3','-c',"import pathlib,sys;sys.exit(not any(pathlib.Path.home().joinpath('.pi/agent/sessions').rglob('*.jsonl')))"] ,preexec_fn=drop(UIDS[NAMES.index(name)]),env={'HOME':str(home),'PATH':'/usr/bin:/bin'}).returncode==0,'native Pi JSONL '+name)
    print(json.dumps({'status':'passed','scope':'rootless-real-pi-controller','uids':[21001,21002,21003],'native_pi':'0.85.1','node':'22.21.1','provider_calls':len(Model.calls),'oauth':'loopback TLS synthetic','broker':'static canonical protocol fixture','daemon_restart':'explicit_continuation_with_lock_and_history_proof','systemd':False,'browser_chromium':False}))
except Exception as e:
    import traceback
    print(json.dumps({'status':'failed','reason':str(e)[:220], 'line':traceback.extract_tb(e.__traceback__)[-1].lineno}),file=sys.stderr)
    sys.exit(1)
finally:
    for p in reversed(children):
        if p.poll() is None:p.terminate()
    for p in reversed(children):
        try:p.wait(timeout=3)
        except subprocess.TimeoutExpired:p.kill()
