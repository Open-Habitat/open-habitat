#!/usr/bin/env python3
"""Production prepare and broker, with only empty installation state seeded."""
import base64,json,subprocess,sys
from pathlib import Path
run=Path(sys.argv[1]);repo=Path(sys.argv[2])
subprocess.run(['python3',str(repo/'test/vm/host-prepare-fixture.py'),str(run),str(repo)],check=True)
seed=json.loads((run/'host-prepare-cloud-init.yaml').read_text().split('\n',1)[1])
for f in seed['write_files']:
 if f['path']=='/usr/local/sbin/host-prepare-proof':
  program=base64.b64decode(f['content']).decode()
  start=program.index(" print('VM_PROOF='");end=program.index('\nexcept Exception',start)
  program=program[:start]+''' checked(['mount','-o','usrquota',devices[0],'/home'])
 os.makedirs('/opt/open-habitat/current',exist_ok=True)
 checked(['install','-m','0755',binary,'/opt/open-habitat/current/open-habitat'])
 for tool in ('setfacl','getfacl'):
  checked(['install','-m','0755','/mnt/product/'+tool,'/usr/bin/'+tool])
 checked(['install','-m','0644','/mnt/product/libacl.so.1','/lib/x86_64-linux-gnu/libacl.so.1'])
 checked(['groupadd','--gid','21003','open-habitat-gateway'])
 checked(['useradd','--no-create-home','--uid','21003','--gid','21003','--shell','/usr/sbin/nologin','open-habitat-gateway'])
 checked(['install','-d','-m','0711','/etc/open-habitat-daemon','/etc/open-habitat-daemon/daemon','/etc/open-habitat-daemon/daemon/user-mappings'])
 checked(['install','-d','-m','0700','/var/lib/open-habitat/broker'])
 state='/var/lib/open-habitat/broker/'
 for name,obj in {'broker.json':{'version':1,'gateway_uid':21003,'gateway_gid':21003,'uid_min':21032,'uid_max':21047,'state_dir':state[:-1],'admission':'allowlist'},'allowlist.json':{'version':1,'epoch':1,'ids':[{'id':'100000001'},{'id':'100000002'}]},'bindings.json':{'version':1,'generation':1,'bindings':[]},'head.json':{'version':1,'epoch':1,'generation':1}}.items():
  with open(state+name,'w') as f:json.dump(obj,f)
  os.chmod(state+name,0o600)
 with open('/etc/modules-load.d/fixture-quota.conf','w') as f:f.write('quota_v2\\n')
 with open('/etc/fstab','a') as f:f.write('UUID='+uuid+' /home ext4 usrquota,nofail 0 0\\n')
 checked(['systemd-tmpfiles','--create','/etc/tmpfiles.d/open-habitat.conf'])
 checked(['systemctl','daemon-reload'])
 checked(['systemctl','enable','open-habitat-broker.service','open-habitat-broker.socket','host-boot-binding-proof.service'])
 # Under TCG, cloud-init and snapd keep later boots so busy that a broker
 # NSS probe outlives its fixed 3s budget and startup refuses. The proof
 # boots need neither; keep the product budgets and quiet the guest instead.
 with open('/etc/cloud/cloud-init.disabled','w') as f:f.write('fixture proof boots\\n')
 checked(['systemctl','mask','snapd.service','snapd.socket','snapd.seeded.service'])
 checked(['systemctl','start','open-habitat-broker.service'])
 checked(['/usr/local/sbin/host-boot-binding-proof','initialize'])
'''+program[end:]
  f['content']=base64.b64encode(program.encode()).decode()
def add(path,data,mode='0644'):
 seed['write_files'].append({'path':path,'permissions':mode,'encoding':'b64','content':base64.b64encode(data.encode()).decode()})
add('/etc/systemd/system/open-habitat-daemon@.service',(repo/'systemd/open-habitat-daemon@.service').read_text())
add('/etc/systemd/system/fixture-pam.service','[Service]\nType=simple\nUser=guestone\nPAMName=login\nExecStart=/usr/bin/sleep 180\n')
add('/usr/local/sbin/host-boot-binding-proof',(repo/'test/vm/host-boot-binding-proof.py').read_text(),'0755')
add('/etc/systemd/system/host-boot-binding-proof.service','''[Unit]
Description=Disposable production binding and session boot proof
After=open-habitat-broker.service
ConditionPathExists=/var/lib/fixture-binding-boots.json
[Service]
Type=oneshot
StandardOutput=journal+console
StandardError=journal+console
TimeoutStartSec=300
ExecStart=/usr/local/sbin/host-boot-binding-proof
ExecStopPost=/bin/sh -c 'test "$SERVICE_RESULT" = success || /usr/bin/systemctl --no-block poweroff'
[Install]
WantedBy=multi-user.target
''')
(run/'host-boot-binding-cloud-init.yaml').write_text('#cloud-config\n'+json.dumps(seed)+'\n')
