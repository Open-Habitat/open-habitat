#!/usr/bin/python3
"""Guest-only runtime admission through the production broker and gate.

Every broker request comes from the real gateway kernel UID over the real
socket; two people get real, distinct Unix accounts. No Fleetrepo, no network.
"""
import fcntl,json,os,pathlib,pwd,stat,subprocess,sys,time
state=pathlib.Path('/var/lib/open-habitat/broker')
OP,RT,NB='100000001','100000002','100000003'
names={OP:'guestone',RT:'guesttwo'}
def require(v,label):
 if not v:raise RuntimeError(label)
def cmd(*args,check=True,**kw):return subprocess.run(args,check=check,capture_output=True,text=True,timeout=45,**kw)
def unit(*args,**kw):return cmd('systemctl',*args,**kw)
def active(u):return unit('is-active','--quiet',u,check=False).returncode==0
def wait(fn,label):
 deadline=time.monotonic()+90
 while time.monotonic()<deadline:
  if fn():return
  time.sleep(.2)
 raise RuntimeError(label)
def drop(uid):
 def pre():os.setgroups([]);os.setgid(uid);os.setuid(uid)
 return pre
CLIENT='''import json,socket,struct,sys
s=socket.socket(socket.AF_UNIX);s.settimeout(100)
try:s.connect('/run/open-habitat/broker.sock')
except PermissionError:print('DAC_DENIED');sys.exit(0)
b=sys.argv[1].encode();s.sendall(struct.pack('>I',len(b))+b);s.shutdown(socket.SHUT_WR)
h=s.recv(4)
if len(h)!=4:print('NO_REPLY');sys.exit(0)
size=struct.unpack('>I',h)[0];b=b''
while len(b)<size:
 p=s.recv(size-len(b));assert p;b+=p
print(b.decode())
'''
def broker(request,uid=21003):
 request={'version':1,'provider':'github',**request}
 p=subprocess.run(['python3','-c',CLIENT,json.dumps(request)],preexec_fn=drop(uid),capture_output=True,text=True,timeout=110)
 require(p.returncode==0,'broker exchange transport '+p.stderr[-300:])
 out=p.stdout.strip()
 return out if out in ('DAC_DENIED','NO_REPLY') else json.loads(out)
def row(reply,label):
 require('access' in reply and len(reply['access']['rows'])==1,label+' '+str(reply))
 return reply['access']['rows'][0]
def admit(id,hint):return broker({'operation':'admit','id':id,'login_hint':hint,'actor':OP})
def withdraw(id):return broker({'operation':'withdraw','id':id,'actor':'root'})
def ensure(id,name):return broker({'operation':'ensure','id':id,'candidate':name,'default_limit_bytes':67108864})
def authorize(id):return broker({'operation':'authorize','id':id})
def listeners(name):return ['open-habitat-daemon@'+name+'.socket','open-habitat-agent@'+name+'.socket']
def allow():return json.loads((state/'allowlist.json').read_text())
def bindings():return json.loads((state/'bindings.json').read_text())['bindings']
def restart_broker():
 # A broker restart with the per-user listeners down: only admitted bindings
 # may be restored, by the unmodified production gate.
 # Like a boot, every per-user unit starts from inactive.
 units=[u for n in names.values() for u in listeners(n)+['open-habitat-daemon@'+n+'.service']]
 unit('stop','open-habitat-broker.service','open-habitat-broker.socket',*units)
 unit('reset-failed',*units,check=False)
 unit('start','open-habitat-broker.service')
 wait(lambda:active('open-habitat-broker.service'),'broker inactive after restart')
def publish(declaration):
 fd=os.open(state,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:
  fcntl.flock(fd,fcntl.LOCK_EX)
  nxt=state/'login_shells.json.next'
  with os.fdopen(os.open(nxt,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'w') as f:
   json.dump(declaration,f,separators=(',',':'));f.flush();os.fsync(f.fileno())
  nxt.replace(state/'login_shells.json');os.fsync(fd)
 finally:os.close(fd)
def restored(name):wait(lambda:all(active(u) for u in listeners(name)),'admitted binding not restored '+name)
def refused(name):
 time.sleep(3)
 for u in listeners(name):
  unit('reset-failed',u,'open-habitat-binding@'+name+'.service',check=False)
  require(unit('start',u,check=False).returncode!=0,'withdrawn binding listener started '+u)
  require(not active(u),'withdrawn binding listener active '+u)
try:
 wait(lambda:active('open-habitat-broker.service'),'production broker inactive')
 require(pathlib.Path('/proc/1/comm').read_text().strip()=='systemd','pid1')
 # host apply declares a login shell for guestone (simulated under the
 # broker lock): first login creates that account with it, guesttwo's not.
 publish({'version':1,'shell':'/bin/bash','subjects':[OP]})
 # The operator source admits guestone; the gateway cannot withdraw it.
 r=ensure(OP,'guestone');require('route' in r and r['route']['uid']==21032,'operator ensure '+str(r))
 require(withdraw(OP).get('failure')=='operator_owned','operator id withdrawn')
 # Only the gateway's kernel UID reaches the broker, for admit as for ensure.
 require(broker({'operation':'admit','id':NB,'login_hint':'intruder','actor':OP},uid=21032)=='DAC_DENIED','mapped UID reached admit')
 # Runtime admission creates nothing until the person's own login.
 a=row(admit(RT,'GuestTwo'),'admit');require(a['source']=='site_admin' and a['state']=='allowed','admit row '+str(a))
 require(not any(u.pw_name=='guesttwo' for u in pwd.getpwall()),'account before login')
 r=ensure(RT,'guesttwo');require('route' in r and r['route']['uid']==21033 and r['route']['username']=='guesttwo','runtime ensure '+str(r))
 require(pwd.getpwnam('guestone').pw_shell=='/bin/bash' and pwd.getpwnam('guesttwo').pw_shell=='/usr/sbin/nologin','created login shells')
 restored('guestone');restored('guesttwo')
 # Withdrawal ends admission only: account, home and binding stay.
 w=row(withdraw(RT),'withdraw');require(w['state']=='withdrawn' and w['username']=='guesttwo','withdraw row '+str(w))
 require(authorize(RT).get('failure')=='denied' and ensure(RT,'guesttwo').get('failure')=='denied','withdrawn id still authorized')
 require(pwd.getpwnam('guesttwo').pw_uid==21033 and pathlib.Path('/home/guesttwo').stat().st_uid==21033,'withdrawal removed the account')
 require(any(b['id']==RT and b['uid']==21033 for b in bindings()),'withdrawal removed the binding')
 restart_broker();restored('guestone');refused('guesttwo')
 require(authorize(RT).get('failure')=='denied','restart reopened a withdrawn id')
 # A boot loses /run: the withdrawn binding's runtime directory is gone, and
 # startup does not rebuild it for a binding the broker does not admit.
 cmd('rm','-r','--one-file-system','/run/open-habitat/users/guesttwo')
 require(not pathlib.Path('/run/open-habitat/users/guesttwo').exists(),'runtime directory still present')
 # Restore returns the same account, through another restart.
 b=row(admit(RT,'GuestTwo'),'restore');require(b['state']=='joined' and b['username']=='guesttwo','restore row '+str(b))
 r=authorize(RT)
 if 'failure' in r:
  # The listeners stayed down after the refused restart; ensure starts them.
  r=ensure(RT,'guesttwo')
 require('route' in r and r['route']['uid']==21033 and r['route']['username']=='guesttwo','restore changed the account '+str(r))
 restart_broker();restored('guestone');restored('guesttwo')
 require(len(bindings())==2,'restore created another binding')
 # A never-bound withdrawal leaves nothing.
 row(admit(NB,'GuestThree'),'admit never-bound')
 n=row(withdraw(NB),'withdraw never-bound');require(n['state']=='removed','never-bound row '+str(n))
 require(NB not in json.dumps(allow()) and not any(b['id']==NB for b in bindings()),'never-bound withdrawal left state')
 require(not any(u.pw_name=='guestthree' for u in pwd.getpwall()) and not pathlib.Path('/home/guestthree').exists(),'never-bound account')
 # host apply turns the switch off (simulated under the broker lock): admit
 # is refused even from the gateway UID, withdraw still works, entries stay.
 fd=os.open(state,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:
  fcntl.flock(fd,fcntl.LOCK_EX)
  cur=allow();cur['epoch']+=1;cur['runtime_admission']=False
  nxt=state/'allowlist.json.next'
  with os.fdopen(os.open(nxt,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'w') as f:
   json.dump(cur,f,separators=(',',':'));f.flush();os.fsync(f.fileno())
  nxt.replace(state/'allowlist.json');os.fsync(fd)
 finally:os.close(fd)
 require(admit(NB,'GuestThree').get('failure')=='runtime_admission_disabled','admit with the switch off')
 require('route' in authorize(RT),'switch-off dropped runtime entries')
 require(row(withdraw(RT),'withdraw switch off')['state']=='withdrawn','withdraw with the switch off')
 listing=broker({'operation':'access_list','id':'0'})
 require(not listing['access']['runtime_admission'] and [x['id'] for x in listing['access']['rows']]==[OP,RT],'list '+str(listing))
 # Startup verification takes exactly the declared shell: once the
 # declaration no longer names guestone, its bash account is drift and the
 # broker refuses to start until the account matches again.
 publish({'version':1,'shell':'','subjects':[]})
 units=[u for n in names.values() for u in listeners(n)+['open-habitat-daemon@'+n+'.service']]
 unit('stop','open-habitat-broker.service','open-habitat-broker.socket',*units)
 unit('reset-failed','open-habitat-broker.service',*units,check=False)
 unit('start','open-habitat-broker.service',check=False);time.sleep(3)
 require(not active('open-habitat-broker.service'),'broker started with an undeclared login shell')
 cmd('usermod','--shell','/usr/sbin/nologin','--','guestone')
 unit('reset-failed','open-habitat-broker.service',check=False)
 restart_broker();restored('guestone')
 print('VM_PROOF='+json.dumps({'status':'passed','scope':'host-runtime-admission','login_shell':True,'distinct_uids':True,'gateway_uid_only':True,'operator_protected':True,'withdraw_keeps_account':True,'restart_closed':True,'restore_rebuilds_runtime':True,'restore_same_uid':True,'never_bound_clean':True,'switch_off_refused':True,'pid1':'systemd'}),flush=True)
 cmd('systemd-run','--on-active=5s','--unit=fixture-shutdown','/usr/bin/systemctl','poweroff','--no-block')
except Exception as e:
 print('VM_PROOF='+json.dumps({'status':'failed','scope':'host-runtime-admission','reason':str(e)[:400]}),flush=True)
 for u in listeners('guesttwo')+['open-habitat-daemon@guesttwo.service','open-habitat-binding@guesttwo.service']:
  subprocess.run(['systemctl','show',u,'--property=ActiveState,SubState,Result','--no-pager'])
 subprocess.run(['ls','-la','/run/open-habitat/users'])
 subprocess.run(['journalctl','-b','-u','open-habitat-broker.service','-u','open-habitat-binding@guesttwo.service','-u','open-habitat-daemon@guesttwo.service','--no-pager','-o','cat','-n','80'])
 sys.exit(1)
