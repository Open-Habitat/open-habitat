#!/usr/bin/env python3
"""Validate the actual rendered guest program, without guest/root mutations."""
import base64,json,pathlib,subprocess,tempfile
repo=pathlib.Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='oh-prepare-',dir='/var/tmp') as directory:
 subprocess.run(['python3',str(repo/'test/vm/host-prepare-fixture.py'),directory,str(repo)],check=True)
 seed=json.loads((pathlib.Path(directory)/'host-prepare-cloud-init.yaml').read_text().split('\n',1)[1])
 for file in seed['write_files']:
  if file['path']=='/usr/local/sbin/host-prepare-proof':
   program=base64.b64decode(file['content']).decode()
   compile(program,file['path'],'exec')
   break
 else:raise RuntimeError('missing guest program')
print('rendered prepare guest syntax passed (no VM acceptance claimed)')
# Exercise the exact host-side receipt validator, including optimized Python.
source=(repo/'scripts/vm-test.sh').read_text()
validator=source.split("<<'PREPARE_CHECK'\n",1)[1].split('\nPREPARE_CHECK',1)[0]
proof={'status':'passed','scope':'host-prepare-no-boot','pid1':'systemd'}
proof.update(dict.fromkeys(('edquot','cleanup','no_change','missing_mount_refused','unenforced_refused','stale_refused','policies'),True))
def accepts(proof,optimized):
 return subprocess.run(['python3']+(['-O'] if optimized else [])+['-c',validator,json.dumps(proof)]).returncode==0
for optimized in (False,True):
 if not accepts(proof,optimized):raise RuntimeError('valid prepare receipt rejected')
 for key in proof:
  broken=dict(proof);broken.pop(key)
  if accepts(broken,optimized):raise RuntimeError('missing '+key+' accepted')
  broken=dict(proof);broken[key]=False
  if accepts(broken,optimized):raise RuntimeError('false '+key+' accepted')
print('prepare receipt negative oracles passed')
