#!/usr/bin/env python3
"""Disposable production CLI preparation lab. No boot acceptance."""
import base64
import json
from pathlib import Path
import sys

run=Path(sys.argv[1])
site=json.loads((Path(sys.argv[2])/'site/example.json').read_text())
site['gateway']['oauth_secret_file']='/etc/open-habitat/fixture-secret'
site['gateway']['tls_cert_file']='/etc/open-habitat/fixture-secret'
site['gateway']['tls_key_file']='/etc/open-habitat/fixture-secret'
files=[]
def add(path,data,mode='0644'):
    files.append({'path':path,'permissions':mode,'encoding':'b64','content':base64.b64encode(data.encode()).decode()})
add('/etc/open-habitat/site.json',json.dumps(site),'0600')
add('/etc/open-habitat/fixture-secret','synthetic-secret','0600')
add('/usr/local/sbin/host-prepare-proof', '''#!/usr/bin/python3
import glob,json,os,subprocess,sys
try:
 def checked(args,**kw):
  return subprocess.run(args,check=True,**kw)
 os.makedirs('/mnt/product',exist_ok=True)
 checked(['mount','-o','ro','/dev/disk/by-label/PRODUCT','/mnt/product'])
 checked(['install','-m','0755','/mnt/product/open-habitat','/usr/local/sbin/open-habitat'])
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
 site_path='/etc/open-habitat/site.json'
 site=json.load(open(site_path));site['storage']['home_uuid']=uuid
 with open(site_path,'w') as f:json.dump(site,f)
 binary='/usr/local/sbin/open-habitat'
 def command(args,code=0):
  p=subprocess.run([binary,'host','prepare','--site',site_path]+args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  if p.returncode!=code:raise RuntimeError('unexpected exit '+str(p.returncode)+': '+p.stderr)
  return p
 def preview(error=None):
  p=command(['--dry-run','--json'],1 if error else 0)
  if error:
   data=json.loads(p.stderr)
   if data['error']['code']!=error:raise RuntimeError('wrong refusal: '+p.stderr)
   plan=data['error']['result']['data']
   denied=command(['--approved-plan',plan['plan']['plan_id'],'--approve-disruption','--output=jsonl'],1)
   if json.loads(denied.stdout.splitlines()[-1]).get('code')!=error:raise RuntimeError('live negative case accepted')
   return plan
  return json.loads(p.stdout)['data']
 plan=preview()
 if not plan['plan']['approvable'] or plan['plan']['ready'] or not plan['would']:raise RuntimeError('incomplete preview')
 # A foreign apply fingerprint and a changed declaration must never authorize writes.
 stale=command(['--approved-plan','0'*64,'--approve-disruption','--output=jsonl'],1)
 if json.loads(stale.stdout.splitlines()[-1]).get('code')!='stale_plan':raise RuntimeError('stale accepted')
 def execute(plan):
  p=command(['--approved-plan',plan['plan']['plan_id'],'--approve-disruption','--output=jsonl'])
  events=[json.loads(line) for line in p.stdout.splitlines()]
  if [x['seq'] for x in events]!=list(range(1,len(events)+1)) or events[-1]['event']!='result':raise RuntimeError('invalid stream')
  if any(x['event'] in ('result','error','cancelled') for x in events[:-1]):raise RuntimeError('multiple terminals')
  return events[-1]['data']
 result=execute(plan)
 if result['outcome']!='prepared':raise RuntimeError('not prepared')
 op=result['operation'];directory='/var/lib/open-habitat/host/'
 evidence=json.load(open(directory+op['id']+'-probe.json'))
 if not evidence['edquot'] or not evidence['cleaned'] or os.path.exists('/home/'+evidence['directory']):raise RuntimeError('missing quota proof/cleanup')
 shown=checked([binary,'host','operation','show',op['id'],'--json'],stdout=subprocess.PIPE,text=True)
 if json.loads(shown.stdout)['data']['status']!='completed':raise RuntimeError('journal incomplete')
 paths=['/etc/open-habitat/storage-policy.json','/etc/tmpfiles.d/open-habitat.conf','/etc/sysusers.d/open-habitat-proc.conf','/etc/systemd/system/open-habitat-proc.service','/etc/systemd/system/systemd-logind.service.d/open-habitat-proc.conf','/etc/systemd/system/polkit.service.d/open-habitat-proc.conf']
 if any(os.stat(p).st_mode&0o777!=0o644 for p in paths):raise RuntimeError('wrong policy mode')
 before={p:(os.stat(p).st_mtime_ns,open(p,'rb').read()) for p in paths}
 again=execute(preview())
 if again['outcome']!='no_change' or again['operation']['id']!=op['id'] or before!={p:(os.stat(p).st_mtime_ns,open(p,'rb').read()) for p in paths}:raise RuntimeError('not idempotent')
 # Native enforcement and absent-volume negative cases, not callback fixtures.
 checked(['umount','/home'])
 checked(['mount',devices[0],'/home'])
 preview('quota_enforcement_required')
 checked(['umount','/home'])
 preview('home_mount_required')
 print('VM_PROOF='+json.dumps({'status':'passed','scope':'host-prepare-no-boot','edquot':True,'cleanup':True,'no_change':True,'missing_mount_refused':True,'unenforced_refused':True,'stale_refused':True,'policies':True,'pid1':'systemd'}),flush=True)
 checked(['systemd-run','--on-active=5s','--unit=fixture-shutdown','/usr/bin/systemctl','poweroff','--no-block'],stdout=subprocess.DEVNULL)
except Exception as e:
 print('VM_PROOF='+json.dumps({'status':'failed','scope':'host-prepare-no-boot','reason':str(e)}),flush=True)
 subprocess.run(['systemctl','poweroff','--no-block'])
 sys.exit(1)
''','0755')
add('/etc/systemd/system/host-prepare-proof.service','''[Service]
Type=oneshot
StandardOutput=tty
StandardError=tty
TTYPath=/dev/ttyS0
ExecStart=/usr/local/sbin/host-prepare-proof
''')
seed={'users':['default'],'write_files':files,'runcmd':[['systemctl','daemon-reload'],['systemctl','start','host-prepare-proof.service']]}
(run/'host-prepare-cloud-init.yaml').write_text('#cloud-config\n'+json.dumps(seed)+'\n')
