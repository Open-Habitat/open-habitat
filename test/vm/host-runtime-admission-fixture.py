#!/usr/bin/env python3
"""Production prepare, broker and binding gate; runtime admission enabled."""
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
 for name,obj in {'broker.json':{'version':1,'gateway_uid':21003,'gateway_gid':21003,'uid_min':21032,'uid_max':21047,'state_dir':state[:-1],'admission':'allowlist'},'allowlist.json':{'version':1,'epoch':1,'ids':[{'id':'100000001'}],'runtime_admission':True},'bindings.json':{'version':1,'generation':1,'bindings':[]},'head.json':{'version':1,'epoch':1,'generation':1}}.items():
  with open(state+name,'w') as f:json.dump(obj,f)
  os.chmod(state+name,0o600)
 checked(['systemd-tmpfiles','--create','/etc/tmpfiles.d/open-habitat.conf'])
 checked(['systemctl','daemon-reload'])
 checked(['systemctl','start','open-habitat-broker.service'])
 checked(['/usr/local/sbin/host-runtime-admission-proof'])
'''+program[end:]
  f['content']=base64.b64encode(program.encode()).decode()
def add(path,data,mode='0644'):
 seed['write_files'].append({'path':path,'permissions':mode,'encoding':'b64','content':base64.b64encode(data.encode()).decode()})
add('/etc/systemd/system/open-habitat-daemon@.service',(repo/'systemd/open-habitat-daemon@.service').read_text())
add('/usr/local/sbin/host-runtime-admission-proof',(repo/'test/vm/host-runtime-admission-proof.py').read_text(),'0755')
(run/'host-runtime-admission-cloud-init.yaml').write_text('#cloud-config\n'+json.dumps(seed)+'\n')
