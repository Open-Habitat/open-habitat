#!/usr/bin/env python3
"""Validate the rendered single-filesystem guest program and receipt check, without a VM."""
import base64,json,pathlib,subprocess,tempfile
repo=pathlib.Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='oh-shared-home-',dir='/var/tmp') as directory:
 subprocess.run(['python3',str(repo/'test/vm/host-shared-home-fixture.py'),directory,str(repo)],check=True)
 seed=json.loads((pathlib.Path(directory)/'host-shared-home-cloud-init.yaml').read_text().split('\n',1)[1])
 files={f['path']:base64.b64decode(f['content']).decode() for f in seed['write_files']}
 compile(files['/usr/local/sbin/host-shared-home-proof'],'host-shared-home-proof','exec')
 site=json.loads(files['/etc/open-habitat/site.json'])
 if site['storage']['enforce_user_quota'] is not False or 'default_limit_bytes' in site['storage']:raise RuntimeError('fixture site declares user quotas')
print('rendered single-filesystem guest syntax passed (no VM acceptance claimed)')
source=(repo/'scripts/vm-test.sh').read_text()
validator=source.split("<<'SHARED_HOME_CHECK'\n",1)[1].split('\nSHARED_HOME_CHECK',1)[0]
proof={'status':'passed','scope':'host-shared-home','pid1':'systemd'}
proof.update(dict.fromkeys(('home_on_root','quota_site_refused','prepared_without_probe','policy_without_quota','no_change','first_login_without_limit','limits_not_in_use','cold_boot_gate','broker_restore','named_acl','wrong_uuid_refused'),True))
def accepts(proof,optimized):
 return subprocess.run(['python3']+(['-O'] if optimized else [])+['-c',validator,json.dumps(proof)]).returncode==0
for optimized in (False,True):
 if not accepts(proof,optimized):raise RuntimeError('valid receipt rejected')
 for key in proof:
  broken=dict(proof);broken.pop(key)
  if accepts(broken,optimized):raise RuntimeError('missing '+key+' accepted')
  broken=dict(proof);broken[key]=False
  if accepts(broken,optimized):raise RuntimeError('false '+key+' accepted')
print('single-filesystem receipt negative oracles passed')
