#!/usr/bin/env python3
"""Disposable native probe lab. Does NOT claim host prepare/boot acceptance."""
import base64
import json
from pathlib import Path
import sys

run=Path(sys.argv[1])
files=[]
def add(path,data,mode='0644'):
    files.append({'path':path,'permissions':mode,'encoding':'b64','content':base64.b64encode(data.encode()).decode()})
add('/usr/local/sbin/host-prepare-probe-proof', '''#!/usr/bin/python3
import glob,json,os,subprocess,sys
try:
 def checked(args,**kw):
  return subprocess.run(args,check=True,**kw)
 os.makedirs('/mnt/product',exist_ok=True)
 checked(['mount','-o','ro','/dev/disk/by-label/PRODUCT','/mnt/product'])
 checked(['install','-m','0755','/mnt/product/open-habitat','/usr/local/sbin/host-probe.test'])
 for module in ('quota_tree','quota_v2'):
  target='/lib/modules/6.8.0-139-generic/kernel/fs/quota/'+module+'.ko.zst'
  checked(['install','-D','-m','0644','/mnt/product/'+module+'.ko.zst',target])
 checked(['depmod','-a'])
 checked(['modprobe','quota_v2'])
 checked(['udevadm','settle'])
 devices=glob.glob('/dev/disk/by-id/*oh-quota-home')
 if len(devices)!=1:raise RuntimeError("expected exactly one disposable home device")
 # Customer-owned storage provisioning; never performed by product code.
 checked(['mkfs.ext4','-F','-O','quota','-E','quotatype=usrquota',devices[0]],stdout=subprocess.DEVNULL)
 checked(['udevadm','settle'])
 checked(['mount','-o','usrquota',devices[0],'/home'])
 uuid=subprocess.check_output(['blkid','-s','UUID','-o','value',devices[0]],text=True).strip()
 env={**os.environ,'HOST_PREPARE_PROBE_VM':'1','HOST_PREPARE_HOME_UUID':uuid}
 result=checked(['/usr/local/sbin/host-probe.test','-test.run','^TestPrepareProbeNativeVM$','-test.v'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 print(result.stdout,end='',flush=True)
 markers=[json.loads(line.split('=',1)[1]) for line in result.stdout.splitlines() if line.startswith('PROBE_RESULT=')]
 if len(markers)!=1:raise RuntimeError('native probe did not emit one completed evidence marker')
 evidence=markers[0]['evidence']
 if evidence.get('edquot') is not True or evidence.get('cleaned') is not True or markers[0].get('fenced') is not True:raise RuntimeError('incomplete native probe evidence')
 print('VM_PROOF='+json.dumps({'status':'passed','scope':'host-prepare-probe-only','edquot':evidence['edquot'],'cleanup':evidence['cleaned'],'fenced':markers[0]['fenced'],'pid1':'systemd'}),flush=True)
 checked(['systemd-run','--on-active=5s','--unit=fixture-shutdown','/usr/bin/systemctl','poweroff','--no-block'],stdout=subprocess.DEVNULL)
except Exception as e:
 print('VM_PROOF='+json.dumps({'status':'failed','scope':'host-prepare-probe-only','reason':str(e)}),flush=True)
 subprocess.run(['systemctl','poweroff','--no-block'])
 sys.exit(1)
''','0755')
add('/etc/systemd/system/host-prepare-probe-proof.service','''[Service]
Type=oneshot
StandardOutput=tty
StandardError=tty
TTYPath=/dev/ttyS0
ExecStart=/usr/local/sbin/host-prepare-probe-proof
''')
seed={'users':['default'],'write_files':files,'runcmd':[['systemctl','daemon-reload'],['systemctl','start','host-prepare-probe-proof.service']]}
(run/'host-prepare-probe-cloud-init.yaml').write_text('#cloud-config\n'+json.dumps(seed)+'\n')
