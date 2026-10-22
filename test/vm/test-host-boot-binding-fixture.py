#!/usr/bin/env python3
"""Offline syntax and receipt refusal; never native boot evidence."""
import base64,json,pathlib,subprocess,tempfile
repo=pathlib.Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='oh-binding-',dir='/var/tmp') as d:
 subprocess.run(['python3',str(repo/'test/vm/host-boot-binding-fixture.py'),d,str(repo)],check=True)
 seed=json.loads((pathlib.Path(d)/'host-boot-binding-cloud-init.yaml').read_text().split('\n',1)[1])
 programs=[f for f in seed['write_files'] if f['path'].startswith('/usr/local/sbin/')]
 if len(programs)!=2:raise RuntimeError('missing guest program')
 for f in programs:compile(base64.b64decode(f['content']).decode(),f['path'],'exec')
validator=(repo/'scripts/vm-test.sh').read_text().split("<<'BOOT_BINDING_CHECK'\n",1)[1].split('\nBOOT_BINDING_CHECK',1)[0]
proof={'status':'passed','scope':'host-boot-binding-session','cold_boots':5,'both_listeners':True,'broker_restore':True,'named_acl':True,'pending_refused':True,'revoked_refused':True,'foreign_refused':True,'proc_isolation':True,'logind_polkit':True,'linger_user_manager':True,'pid1':'systemd'}
for opt in ([],['-O']):
 def accepts(p):return subprocess.run(['python3']+opt+['-c',validator,json.dumps(p)]).returncode==0
 if not accepts(proof):raise RuntimeError('valid proof rejected')
 for key in proof:
  bad=dict(proof);bad.pop(key)
  if accepts(bad):raise RuntimeError('missing '+key+' accepted')
  bad=dict(proof);bad[key]=False
  if accepts(bad):raise RuntimeError('false '+key+' accepted')
print('binding fixture syntax and negative receipt checks passed (offline only)')
