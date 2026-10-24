#!/usr/bin/python3
"""Guest-only proof of an installation without user quotas; no Fleetrepo.

First boot: production host check and prepare on /home inside the root
filesystem, refusal of a quota site on the same host, and the production
broker creating two accounts at first login with no default limit. Second,
cold boot: the storage gate, broker restoration and named ACLs."""
import json,os,pathlib,pwd,stat,subprocess,sys,time
binary='/opt/open-habitat/current/open-habitat'
site_path='/etc/open-habitat/site.json'
state=pathlib.Path('/var/lib/open-habitat/broker')
record=pathlib.Path('/var/lib/fixture-shared-home.json')
names=('guestone','guesttwo');uids=(21032,21033);subjects=('100000001','100000002')
def require(v,label):
 if not v:raise RuntimeError(label)
def cmd(*args,check=True,**kw):return subprocess.run(args,check=check,capture_output=True,text=True,timeout=300,**kw)
def unit(*args,**kw):return cmd('systemctl',*args,**kw)
def active(u):return unit('is-active','--quiet',u,check=False).returncode==0
def wait(fn,label):
 deadline=time.monotonic()+120
 while time.monotonic()<deadline:
  if fn():return
  time.sleep(.2)
 raise RuntimeError(label)
def drop(uid):
 def pre():os.setgroups([]);os.setgid(uid);os.setuid(uid)
 return pre
def broker(request):
 request={'version':1,'provider':'github',**request}
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
 return json.loads(p.stdout)
def checks(path=site_path):
 p=cmd(binary,'--json','host','check','--site',path,check=False)
 doc=json.loads(p.stdout) if p.returncode==0 else json.loads(p.stderr)['error']['result']
 return {c['code']:(c['status'],c['reason']) for c in doc['data']['checks']}
def storage_checks():
 c=checks()
 require(c['storage.home']==('pass','home_on_root_filesystem_observed'),'home check '+str(c['storage.home']))
 for code in ('storage.quota_format','storage.enforcement'):
  require(c[code]==('pass','user_quota_not_declared'),code+' '+str(c[code]))
 return c
def storage_gate():
 p=cmd(binary,'boot-storage-check',check=False)
 return p.returncode,p.stderr
def listeners(name):return ['open-habitat-daemon@'+name+'.socket','open-habitat-agent@'+name+'.socket']
def paths(name):return [pathlib.Path('/run/open-habitat/users')/name/s for s in ('daemon.sock','agent.sock')]
def restored():
 wait(lambda:active('open-habitat-broker.service'),'production broker inactive')
 for name,uid in zip(names,uids):
  wait(lambda:all(active(u) for u in listeners(name)),'broker did not restore both '+name)
  require(pwd.getpwnam(name).pw_uid==uid,'foreign native UID')
  home=os.stat('/home/'+name)
  require(home.st_uid==uid and home.st_dev==os.stat('/').st_dev,'home not on the root filesystem')
  acl=cmd('getfacl','-cpn','/run/open-habitat/users/'+name).stdout.strip().splitlines()
  require(set(acl)=={'user::rwx','user:'+str(uid)+':--x','user:21003:--x','group::---','mask::--x','other::---'},'named per-user ACL mismatch')
  for p,gid,mode in zip(paths(name),(21003,uid),(0o660,0o600)):
   st=p.lstat();require(stat.S_ISSOCK(st.st_mode) and st.st_uid==uid and st.st_gid==gid and stat.S_IMODE(st.st_mode)==mode,'listener inode mismatch')
  other=21033 if uid==21032 else 21032
  require(cmd('stat',str(paths(name)[0]),preexec_fn=drop(other),check=False).returncode!=0,'cross-user traversal')
  require(cmd('ls','/home/'+name,preexec_fn=drop(other),check=False).returncode!=0,'cross-user home read')
def storage_replies():
 for subject in subjects:
  r=broker({'operation':'quota_read','id':subject})
  q=r.get('quota') or {}
  require(q.get('not_in_use') is True and q.get('usage_bytes')==0 and q.get('limit_bytes')==0 and q.get('capacity_bytes',0)>0,'quota read '+str(r))
 r=broker({'operation':'quota_set','id':subjects[0],'limit_bytes':1048576})
 require(r.get('failure')=='quota_not_in_use','quota set '+str(r))
 r=broker({'operation':'quota_list','id':'0'})
 require(r.get('quotas',{}).get('not_in_use') is True and r['quotas']['rows']==[],'quota list '+str(r))
def initialize():
 os.makedirs('/mnt/product',exist_ok=True)
 cmd('mount','-o','ro','/dev/disk/by-label/PRODUCT','/mnt/product')
 os.makedirs('/opt/open-habitat/current',exist_ok=True)
 cmd('install','-m','0755','/mnt/product/open-habitat',binary)
 for tool in ('setfacl','getfacl'):cmd('install','-m','0755','/mnt/product/'+tool,'/usr/bin/'+tool)
 cmd('install','-m','0644','/mnt/product/libacl.so.1','/lib/x86_64-linux-gnu/libacl.so.1')
 mounts=[l.split()[4] for l in pathlib.Path('/proc/self/mountinfo').read_text().splitlines()]
 require('/home' not in mounts,'fixture must not mount a separate /home')
 uuid=cmd('findmnt','-no','UUID','-T','/home').stdout.strip()
 site=json.load(open(site_path));site['storage']['home_uuid']=uuid
 with open(site_path,'w') as f:json.dump(site,f)
 # The same host refuses a site that asks for per-user limits.
 quota=json.loads(json.dumps(site));quota['storage']['enforce_user_quota']=True;quota['storage']['default_limit_bytes']=67108864
 quota_path='/etc/open-habitat/site-quota.json'
 fd=os.open(quota_path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(quota,f)
 require(checks(quota_path)['storage.home']==('fail','separate_home_required'),'quota site accepted /home on root')
 p=cmd(binary,'host','prepare','--site',quota_path,'--dry-run','--json',check=False)
 require(p.returncode==1 and json.loads(p.stderr)['error']['code']=='home_mount_required','quota prepare not refused')
 os.unlink(quota_path)
 storage_checks()
 p=cmd(binary,'host','prepare','--site',site_path,'--dry-run','--json')
 plan=json.loads(p.stdout)['data']
 require(plan['plan']['approvable'] and plan['would'][0]=={'code':'prepare.quota_probe','status':'no_change','reason':'user_quota_not_declared'},'preview '+json.dumps(plan['would']))
 p=cmd(binary,'host','prepare','--site',site_path,'--approved-plan',plan['plan']['plan_id'],'--approve-disruption','--output=jsonl')
 events=[json.loads(line) for line in p.stdout.splitlines()]
 require(events[-1]['event']=='result' and events[-1]['data']['outcome']=='prepared','prepare '+p.stdout[-400:])
 require(not any(e.get('data',{}).get('phase')=='quota_probe' for e in events[:-1]) and 'quota_probe' not in p.stdout.replace('prepare.quota_probe',''),'quota probe ran')
 op=events[-1]['data']['operation']['id']
 require(not os.path.exists('/var/lib/open-habitat/host/'+op+'-probe.json'),'probe evidence without quotas')
 policy=json.load(open('/etc/open-habitat/storage-policy.json'))
 require(policy=={'schema_version':1,'home_uuid':uuid,'user_quota':False},'installed policy '+str(policy))
 code,why=storage_gate();require(code==0,'storage gate '+why)
 p=cmd(binary,'host','prepare','--site',site_path,'--dry-run','--json')
 again=json.loads(p.stdout)['data']
 p=cmd(binary,'host','prepare','--site',site_path,'--approved-plan',again['plan']['plan_id'],'--approve-disruption','--output=jsonl')
 require(json.loads(p.stdout.splitlines()[-1])['data']['outcome']=='no_change','prepare not idempotent')
 # Empty broker installation state, as apply seeds it; never bindings.
 cmd('groupadd','--gid','21003','open-habitat-gateway')
 cmd('useradd','--no-create-home','--uid','21003','--gid','21003','--shell','/usr/sbin/nologin','open-habitat-gateway')
 cmd('install','-d','-m','0711','/etc/open-habitat-daemon','/etc/open-habitat-daemon/daemon','/etc/open-habitat-daemon/daemon/user-mappings')
 cmd('install','-d','-m','0700',str(state))
 for name,obj in {'broker.json':{'version':1,'gateway_uid':21003,'gateway_gid':21003,'uid_min':21032,'uid_max':21047,'state_dir':str(state),'admission':'allowlist'},'allowlist.json':{'version':1,'epoch':1,'ids':[{'id':s} for s in subjects]},'bindings.json':{'version':1,'generation':1,'bindings':[]},'head.json':{'version':1,'epoch':1,'generation':1}}.items():
  p=state/name;p.write_text(json.dumps(obj));p.chmod(0o600)
 cmd('systemd-tmpfiles','--create','/etc/tmpfiles.d/open-habitat.conf')
 unit('daemon-reload')
 unit('enable','open-habitat-broker.service','open-habitat-broker.socket','host-shared-home-proof.service')
 # Under TCG, cloud-init and snapd keep the next boot busy enough to outlive
 # the broker's fixed NSS budget; the proof boot needs neither.
 pathlib.Path('/etc/cloud/cloud-init.disabled').write_text('fixture proof boot\n')
 unit('mask','snapd.service','snapd.socket','snapd.seeded.service')
 unit('start','open-habitat-broker.service')
 # First login: the gateway sends no default limit, as it has none here.
 for subject,name in zip(subjects,names):
  r=broker({'operation':'ensure','id':subject,'candidate':name})
  require(r.get('route',{}).get('username')==name and r.get('created') is True,'first-login ensure '+str(r))
 restored()
 storage_replies()
 # No limit exists: a write larger than any test default succeeds.
 cmd('dd','if=/dev/zero','of=/home/guestone/fill','bs=1M','count=80',preexec_fn=drop(21032))
 os.unlink('/home/guestone/fill')
 record.write_text(json.dumps({'boot':pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip()}))
 unit('reboot','--no-block')
def second_boot():
 s=json.loads(record.read_text())
 require(pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip()!=s['boot'],'not a cold boot')
 wait(lambda:unit('show','--value','--property=Result','open-habitat-storage.service').stdout.strip()=='success' and active('open-habitat-broker.service'),'storage gate or broker did not pass at boot')
 restored()
 storage_replies()
 storage_checks()
 # A different declared filesystem is refused by the same gate.
 p=pathlib.Path('/etc/open-habitat/storage-policy.json');good=p.read_text()
 p.write_text(json.dumps({'schema_version':1,'home_uuid':'00000000-0000-4000-8000-000000000009','user_quota':False},separators=(',',':'))+'\n')
 code,why=storage_gate();p.write_text(good)
 require(code!=0 and 'home_uuid_unavailable' in why,'wrong UUID passed the gate '+why)
 require(storage_gate()[0]==0,'restored policy refused')
 print('VM_PROOF='+json.dumps({'status':'passed','scope':'host-shared-home','home_on_root':True,'quota_site_refused':True,'prepared_without_probe':True,'policy_without_quota':True,'no_change':True,'first_login_without_limit':True,'limits_not_in_use':True,'cold_boot_gate':True,'broker_restore':True,'named_acl':True,'wrong_uuid_refused':True,'pid1':'systemd'}),flush=True)
 cmd('systemd-run','--on-active=5s','--unit=fixture-shutdown','/usr/bin/systemctl','poweroff','--no-block')
try:
 if len(sys.argv)>1:initialize()
 else:second_boot()
except Exception as e:
 print('VM_PROOF='+json.dumps({'status':'failed','scope':'host-shared-home','reason':str(e)[:600]}),flush=True)
 subprocess.run(['journalctl','-b','-u','open-habitat-broker.service','-u','open-habitat-storage.service','-u','open-habitat-binding@guestone.service','--no-pager','-o','short-monotonic','-n','80'])
 subprocess.run(['systemctl','poweroff','--no-block']);sys.exit(1)
