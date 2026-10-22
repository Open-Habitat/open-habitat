#!/usr/bin/env python3
"""Offline syntax and exact-receipt negative oracles; not boot evidence."""
import base64,json,pathlib,subprocess,tempfile
repo=pathlib.Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='oh-boot-',dir='/var/tmp') as directory:
 subprocess.run(['python3',str(repo/'test/vm/host-boot-storage-fixture.py'),directory,str(repo)],check=True)
 seed=json.loads((pathlib.Path(directory)/'host-boot-storage-cloud-init.yaml').read_text().split('\n',1)[1])
 programs=[f for f in seed['write_files'] if f['path'].startswith('/usr/local/sbin/')]
 if len(programs)!=2:raise RuntimeError('missing program')
 for file in programs:compile(base64.b64decode(file['content']).decode(),file['path'],'exec')
source=(repo/'scripts/vm-test.sh').read_text()
validator=source.split("<<'BOOT_STORAGE_CHECK'\n",1)[1].split('\nBOOT_STORAGE_CHECK',1)[0]
proof={'status':'passed','scope':'host-boot-storage-only','cold_boots':4,'good_boot':True,'quota_off_refused':True,'missing_home_refused':True,'wrong_uuid_refused':True,'both_listeners':True,'broker_ordering':True,'pid1':'systemd'}
def accepts(p,opt):return subprocess.run(['python3']+(['-O'] if opt else [])+['-c',validator,json.dumps(p)]).returncode==0
for opt in (False,True):
 if not accepts(proof,opt):raise RuntimeError('valid receipt rejected')
 for key in proof:
  bad=dict(proof);bad.pop(key)
  if accepts(bad,opt):raise RuntimeError('missing '+key+' accepted')
  bad=dict(proof);bad[key]=False
  if accepts(bad,opt):raise RuntimeError('false '+key+' accepted')
print('boot fixture syntax and negative receipt oracles passed (offline only)')
