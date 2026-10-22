#!/usr/bin/env python3
"""Cold-boot storage ordering only; broker body/ACL restoration are not tested."""
import base64,json,subprocess,sys
from pathlib import Path
run=Path(sys.argv[1]); repo=Path(sys.argv[2])
subprocess.run(['python3',str(repo/'test/vm/host-prepare-fixture.py'),str(run),str(repo)],check=True)
seed=json.loads((run/'host-prepare-cloud-init.yaml').read_text().split('\n',1)[1])
for f in seed['write_files']:
 if f['path']=='/usr/local/sbin/host-prepare-proof':
  program=base64.b64decode(f['content']).decode()
  start=program.index(" print('VM_PROOF='")
  end=program.index('\nexcept Exception',start)
  program=program[:start]+''' # Install the product binary at the shipped unit's fixed generation path.
 os.makedirs('/opt/open-habitat/current',exist_ok=True)
 checked(['install','-m','0755',binary,'/opt/open-habitat/current/open-habitat'])
 checked(['groupadd','--system','open-habitat-gateway'])
 checked(['useradd','--system','--no-create-home','--gid','open-habitat-gateway','open-habitat-gateway'])
 checked(['useradd','--no-create-home','--uid','21001','agent-a'])
 # The operator guide requires applying sysusers before proc policy activation.
 # On Ubuntu its stock boot unit may skip via ConditionNeedsUpdate=/etc.
 # Prepare deliberately installs files only; group activation is not its claim.
 checked(['systemd-sysusers','/etc/sysusers.d/open-habitat-proc.conf'])
 with open('/etc/modules-load.d/fixture-quota.conf','w') as f:f.write('quota_v2\\n')
 with open('/etc/fstab','a') as f:f.write('UUID='+uuid+' /home ext4 usrquota,nofail 0 0\\n')
 # Deliberately synthetic runtime directories; named ACL/binding restoration is
 # a separate broker acceptance, not inferred from this storage-ordering lab.
 with open('/etc/tmpfiles.d/fixture-socket.conf','w') as f:f.write('d /run/open-habitat/users/agent-a 0710 root root -\\n')
 # Isolate startup ordering from the broker's independent config/ledger gates.
 os.makedirs('/etc/systemd/system/open-habitat-broker.service.d',exist_ok=True)
 with open('/etc/systemd/system/open-habitat-broker.service.d/fixture.conf','w') as f:f.write('[Service]\\nType=oneshot\\nRemainAfterExit=yes\\nExecStart=\\nExecStart=/usr/bin/touch /run/open-habitat/broker-body-started\\n')
 with open('/var/lib/fixture-boot-state.json','w') as f:json.dump({'stage':0,'uuid':uuid,'boots':[]},f)
 checked(['systemctl','daemon-reload'])
 checked(['systemctl','enable','host-boot-storage-proof.service','open-habitat-broker.service','open-habitat-broker.socket','open-habitat-daemon@agent-a.socket','open-habitat-agent@agent-a.socket'])
 checked(['systemctl','reboot','--no-block'])
'''+program[end:]
  f['content']=base64.b64encode(program.encode()).decode()
def add(path,data,mode='0644'):
 seed['write_files'].append({'path':path,'permissions':mode,'encoding':'b64','content':base64.b64encode(data.encode()).decode()})
add('/etc/systemd/system/open-habitat-daemon@.service',(repo/'systemd/open-habitat-daemon@.service').read_text())
add('/usr/local/sbin/host-boot-storage-proof',(repo/'test/vm/host-boot-storage-proof.py').read_text(),'0755')
add('/etc/systemd/system/host-boot-storage-proof.service','''[Unit]
Description=Synthetic storage boot ordering proof
After=open-habitat-broker.service open-habitat-broker.socket open-habitat-daemon@agent-a.socket open-habitat-agent@agent-a.socket
[Service]
Type=oneshot
StandardOutput=tty
StandardError=tty
TTYPath=/dev/ttyS0
ExecStart=/usr/local/sbin/host-boot-storage-proof
[Install]
WantedBy=multi-user.target
''')
(run/'host-boot-storage-cloud-init.yaml').write_text('#cloud-config\n'+json.dumps(seed)+'\n')
