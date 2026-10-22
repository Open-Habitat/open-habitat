#!/usr/bin/python3
"""Guest-only production broker and native kernel/session checks; no Fleetrepo."""
import ctypes,json,os,pathlib,pwd,socket,stat,struct,subprocess,sys,time
state=pathlib.Path('/var/lib/open-habitat/broker')
record=pathlib.Path('/var/lib/fixture-binding-boots.json')
names=('guestone','guesttwo');uids=(21032,21033)
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
def drop(uid,groups=()):
 def pre():os.setgroups(list(groups));os.setgid(uid);os.setuid(uid)
 return pre
def exchange(subject,name):
 request={'version':1,'operation':'ensure','provider':'github','id':subject,'candidate':name,'default_limit_bytes':67108864}
 code='''import json,socket,struct,sys
s=socket.socket(socket.AF_UNIX);s.settimeout(100);s.connect('/run/open-habitat/broker.sock')
b=sys.argv[1].encode();s.sendall(struct.pack('>I',len(b))+b);s.shutdown(socket.SHUT_WR)
h=s.recv(4);assert len(h)==4;size=struct.unpack('>I',h)[0];b=b''
while len(b)<size:
 p=s.recv(size-len(b));assert p;b+=p
print(b.decode())
'''
 p=subprocess.run(['python3','-c',code,json.dumps(request)],preexec_fn=drop(21003),capture_output=True,text=True,timeout=110)
 require(p.returncode==0,'broker exchange transport '+p.stderr[-300:])
 result=json.loads(p.stdout);require('route' in result,'broker ensure '+str(result))
 require(result['route']['username']==name,'wrong broker identity')
def listeners(name):return ['open-habitat-daemon@'+name+'.socket','open-habitat-agent@'+name+'.socket']
def paths(name):return [pathlib.Path('/run/open-habitat/users')/name/s for s in ('daemon.sock','agent.sock')]
def denied(name):
 for u,p in zip(listeners(name),paths(name)):
  unit('reset-failed',u,'open-habitat-binding@'+name+'.service',check=False)
  require(unit('start',u,check=False).returncode!=0,'refused binding started '+u)
  require(not active(u) and not p.exists(),'refused listener present '+u)
 require(not (pathlib.Path('/run/open-habitat/users')/name).exists(),'refused identity acquired cold ACL')
def proc_session():
 # Check host-wide proc, native logind/polkit process groups, and real PAM
 # session creation under hidepid. pkcheck must resolve that foreign subject.
 gid=int(cmd('getent','group','open-habitat-proc').stdout.split(':')[2])
 mount=next(line for line in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if line.split()[4]=='/proc')
 require(('hidepid=invisible' in mount or 'hidepid=2' in mount) and 'gid='+str(gid) in mount,'effective proc policy')
 for u in ('systemd-logind.service','polkit.service'):
  require(active(u),'session service inactive '+u)
  pid=int(unit('show','--value','--property=MainPID',u).stdout)
  groups=next(line for line in pathlib.Path('/proc/'+str(pid)+'/status').read_text().splitlines() if line.startswith('Groups:')).split()[1:]
  require(str(gid) in groups,'exemption absent from running '+u)
 # A native user manager owns this process, not the system daemon. Other UIDs
 # cannot inspect it; the service exemption GID can, without CAP_SYS_PTRACE.
 unit('start','user@21032.service')
 env={'PATH':'/usr/bin:/bin','HOME':'/home/guestone','XDG_RUNTIME_DIR':'/run/user/21032','DBUS_SESSION_BUS_ADDRESS':'unix:path=/run/user/21032/bus'}
 cmd('systemd-run','--user','--unit=fixture-native','/usr/bin/sleep','180',env=env,preexec_fn=drop(21032))
 pid=int(cmd('systemctl','--user','show','--value','--property=MainPID','fixture-native.service',env=env,preexec_fn=drop(21032)).stdout)
 code='import pathlib,sys;print(pathlib.Path(sys.argv[1]).read_text())'
 p=cmd('python3','-c',code,'/proc/'+str(pid)+'/status',preexec_fn=drop(21033),check=False)
 require(p.returncode!=0,'foreign process visible to mapped UID')
 p=cmd('python3','-c',code,'/proc/'+str(pid)+'/status',preexec_fn=drop(21033,(gid,)),check=False)
 require(p.returncode==0,'native exemption cannot inspect process')
 unit('start','fixture-pam.service')
 wait(lambda:'guestone' in cmd('loginctl','list-sessions','--no-legend').stdout,'logind did not register PAM session')
 pid=int(unit('show','--value','--property=MainPID','fixture-pam.service').stdout)
 # This native policy has allow_any=yes. Success depends on polkit resolving
 # the live non-root process despite the host-wide invisible proc mount.
 cmd('pkcheck','--action-id','org.freedesktop.login1.inhibit-block-idle','--process',str(pid))
 unit('stop','fixture-pam.service')
 cmd('systemctl','--user','stop','fixture-native.service',env=env,preexec_fn=drop(21032))
def good(restored=True):
 wait(lambda:active('open-habitat-broker.service'),'production broker inactive')
 for name,uid in zip(names,uids):
  wait(lambda:all(active(u) for u in listeners(name)),'broker did not restore both '+name)
  require(pwd.getpwnam(name).pw_uid==uid,'foreign native UID')
  acl=cmd('getfacl','-cpn','/run/open-habitat/users/'+name).stdout.strip().splitlines()
  require(set(acl)=={'user::rwx','user:'+str(uid)+':--x','user:21003:--x','group::---','mask::--x','other::---'},'named per-user ACL mismatch')
  for p,gid,mode in zip(paths(name),(21003,uid),(0o660,0o600)):
   st=p.lstat();require(stat.S_ISSOCK(st.st_mode) and st.st_uid==uid and st.st_gid==gid and stat.S_IMODE(st.st_mode)==mode,'listener inode mismatch')
  other=21033 if uid==21032 else 21032
  require(cmd('stat',str(paths(name)[0]),preexec_fn=drop(other),check=False).returncode!=0,'cross-user traversal')
  require(cmd('stat',str(paths(name)[0]),preexec_fn=drop(uid),check=False).returncode==0,'own ACL ineffective')
  require(cmd('stat',str(paths(name)[0]),preexec_fn=drop(21003),check=False).returncode==0,'gateway ACL ineffective')
  # Native logind/user-manager facts, not a broker receipt or marker.
  wait(lambda:active('user@'+str(uid)+'.service'),'lingering manager inactive')
  require(cmd('loginctl','show-user',name,'--property=Linger','--value').stdout.strip()=='yes','linger not enabled')
  require(pathlib.Path('/run/user/'+str(uid)+'/bus').is_socket(),'native user bus absent')
 # Restoration is not triggered by a browser login after reboot.
 if restored:
  def restore_evidence():
   log=cmd('journalctl','-b','-u','open-habitat-broker.service','--no-pager','-o','cat').stdout
   events=[json.loads(line) for line in log.splitlines() if line.startswith('{')]
   return all(any(e.get('event')=='broker_socket_restore' and e.get('outcome')=='ready' and e.get('user')==name for e in events) for name in names)
  # A listening inode precedes Ready's final route verification and its event.
  # Persistent linger flags/user managers may already be up from the old boot.
  wait(restore_evidence,'no production restore evidence')
 proc_session()
def native_uid(uid):
 # Deliberate offline NSS corruption in this disposable guest, not a product
 # account operation. Keep the committed UID and its real quota unchanged so
 # quota/admission cannot mask the native identity check.
 p=pathlib.Path('/etc/passwd');rows=p.read_text().splitlines();found=0
 for n,row in enumerate(rows):
  fields=row.split(':')
  if fields[0]=='guestone':fields[2]=str(uid);rows[n]=':'.join(fields);found+=1
 require(found==1,'expected one synthetic native account');p.write_text('\n'.join(rows)+'\n')
def valid_native_quota(uid):
 class Dqblk(ctypes.Structure):
  _fields_=[(n,ctypes.c_uint64) for n in ('hard','soft','current','ihard','isoft','icurrent','btime','itime')]+[('valid',ctypes.c_uint32)]
 fd=os.open('/home',os.O_RDONLY|os.O_DIRECTORY)
 try:
  q=Dqblk()
  require(ctypes.CDLL(None,use_errno=True).syscall(ctypes.c_long(443),ctypes.c_int(fd),ctypes.c_uint(0x800007<<8),ctypes.c_uint(uid),ctypes.byref(q))==0 and q.hard==65536,'foreign test must retain the real committed quota')
 finally:os.close(fd)
def write(name,obj):
 p=state/name;p.write_text(json.dumps(obj,separators=(',',':')));p.chmod(0o600)
def stop():
 unit('stop','open-habitat-broker.service','open-habitat-broker.socket',*[u for n in names for u in listeners(n)])
try:
 if len(sys.argv)>1:
  for subject,name in zip(('100000001','100000002'),names):exchange(subject,name)
  good(False)
  saved={n:json.loads((state/n).read_text()) for n in ('allowlist.json','bindings.json','head.json')}
  record.write_text(json.dumps({'stage':0,'boots':[],'saved':saved}))
  unit('reboot','--no-block');sys.exit(0)
 s=json.loads(record.read_text());stage=s['stage']
 boot=pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip()
 require(boot not in s['boots'],'not a cold boot');s['boots'].append(boot)
 if stage in (0,4):good()
 elif stage==1:
  denied('guestone');denied('guesttwo')
  require(not active('open-habitat-broker.service'),'pending broker served')
 elif stage==2:
  denied('guestone')
  wait(lambda:all(active(u) for u in listeners('guesttwo')),'admitted sibling not restored')
  require(active('open-habitat-broker.service'),'revoked identity stopped admitted sibling')
 elif stage==3:
  require(pwd.getpwnam('guestone').pw_uid==21034,'native foreign UID not injected')
  valid_native_quota(21032)
  denied('guestone');require(not active('open-habitat-broker.service'),'foreign binding broker served')
 else:raise RuntimeError('bad stage')
 if stage==4:
  require(len(s['boots'])==5,'missing cold reboots')
  print('VM_PROOF='+json.dumps({'status':'passed','scope':'host-boot-binding-session','cold_boots':5,'both_listeners':True,'broker_restore':True,'named_acl':True,'pending_refused':True,'revoked_refused':True,'foreign_refused':True,'proc_isolation':True,'logind_polkit':True,'linger_user_manager':True,'pid1':'systemd'}),flush=True)
  cmd('systemd-run','--on-active=5s','--unit=fixture-shutdown','/usr/bin/systemctl','poweroff','--no-block')
 else:
  stop()
  if stage==0:write('pending.json',{'injected':'cold-boot-fence'})
  elif stage==1:
   (state/'pending.json').unlink();a=json.loads(json.dumps(s['saved']['allowlist.json']));a['epoch']+=1;a['ids']=[{'id':'100000002'}];write('allowlist.json',a)
  elif stage==2:
   write('allowlist.json',s['saved']['allowlist.json'])
   valid_native_quota(21032);native_uid(21034)
  elif stage==3:
   native_uid(21032)
   for n,o in s['saved'].items():write(n,o)
  s['stage']+=1;record.write_text(json.dumps(s));unit('reboot','--no-block')
except Exception as e:
 print('VM_PROOF='+json.dumps({'status':'failed','scope':'host-boot-binding-session','reason':str(e)}),flush=True)
 subprocess.run(['journalctl','-b','-u','open-habitat-broker.service','-u','open-habitat-binding@guestone.service','-u','open-habitat-binding@guesttwo.service','-u','polkit.service','--no-pager','-o','cat'])
 for n in names:
  subprocess.run(['getfacl','-cpn','/run/open-habitat','/run/open-habitat/users','/run/open-habitat/users/'+n])
  subprocess.run(['/opt/open-habitat/current/open-habitat','binding-activation-check',n])
 subprocess.run(['systemctl','poweroff','--no-block']);sys.exit(1)
