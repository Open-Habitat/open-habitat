#!/usr/bin/env python3
"""Offline syntax and receipt refusal; never native broker evidence."""
import base64,json,pathlib,subprocess,tempfile
repo=pathlib.Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='oh-admission-',dir='/var/tmp') as d:
 subprocess.run(['python3',str(repo/'test/vm/host-runtime-admission-fixture.py'),d,str(repo)],check=True)
 seed=json.loads((pathlib.Path(d)/'host-runtime-admission-cloud-init.yaml').read_text().split('\n',1)[1])
 programs=[f for f in seed['write_files'] if f['path'].startswith('/usr/local/sbin/')]
 if len(programs)!=2:raise RuntimeError('missing guest program')
 for f in programs:compile(base64.b64decode(f['content']).decode(),f['path'],'exec')
validator=(repo/'scripts/vm-test.sh').read_text().split("<<'RUNTIME_ADMISSION_CHECK'\n",1)[1].split('\nRUNTIME_ADMISSION_CHECK',1)[0]
proof={'status':'passed','scope':'host-runtime-admission','distinct_uids':True,'gateway_uid_only':True,'operator_protected':True,'withdraw_keeps_account':True,'restart_closed':True,'restore_rebuilds_runtime':True,'restore_same_uid':True,'never_bound_clean':True,'switch_off_refused':True,'pid1':'systemd'}
for opt in ([],['-O']):
 def accepts(p):return subprocess.run(['python3']+opt+['-c',validator,json.dumps(p)]).returncode==0
 if not accepts(proof):raise RuntimeError('valid proof rejected')
 for key in proof:
  bad=dict(proof);bad.pop(key)
  if accepts(bad):raise RuntimeError('missing '+key+' accepted')
  bad=dict(proof);bad[key]=False
  if accepts(bad):raise RuntimeError('false '+key+' accepted')
print('runtime admission fixture syntax and negative receipt checks passed (offline only)')
