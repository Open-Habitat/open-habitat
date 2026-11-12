#!/usr/bin/env python3
"""Build a private, boot-only cloud-init seed. Never print fixture secrets."""
import base64
import hashlib
import json
import pathlib
import subprocess
import sys

repo = pathlib.Path(__file__).resolve().parents[2]
run = pathlib.Path(sys.argv[1])
binary = pathlib.Path(sys.argv[2])
assert binary.is_file() and binary.stat().st_size < 60_000_000
subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=github.com', '-addext', 'subjectAltName=DNS:github.com,DNS:api.github.com,DNS:host.fixture', '-keyout', str(run/'tls.key'), '-out', str(run/'tls.crt')], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
# Independent recipe: the same three synthetic IDs as the environment fixture,
# without requiring PyYAML on the host or parsing executable configuration.
users = ['default',
         {'name':'agent-a','uid':21001,'shell':'/usr/sbin/nologin','homedir':'/home/agent-a'},
         {'name':'agent-b','uid':21002,'shell':'/usr/sbin/nologin','homedir':'/home/agent-b'},
         {'name':'open-habitat-gateway','uid':21003,'shell':'/usr/sbin/nologin','homedir':'/var/empty/open-habitat-gateway','no_create_home':True}]
files = []
def add(path, data, mode='0644'):
    if isinstance(data, str): data = data.encode()
    files.append({'path':path, 'permissions':mode, 'encoding':'b64', 'content':base64.b64encode(data).decode()})
add('/etc/open-habitat/binary.sha256', hashlib.sha256(binary.read_bytes()).hexdigest()+'\n')
# The binary is delivered on a separate read-only ISO, not embedded in
# cloud-init YAML: parsing a 17 MiB seed under QEMU TCG starves cloud-config.
add('/etc/open-habitat/tls.crt', (run/'tls.crt').read_bytes())
add('/etc/open-habitat/tls.key', (run/'tls.key').read_bytes(), '0600')
add('/etc/open-habitat/fixture-ca.crt', (run/'tls.crt').read_bytes())
# Routing-only guest: a root-owned synthetic Pi status adapter unlocks snapshot
# reads. This is NOT the pinned Pi CLI and must not count as controller proof.
pi_root='/opt/open-habitat/fixture-pi'
pi_pkg=pi_root+'/node_modules/@earendil-works/pi-coding-agent'
add(pi_root+'/bin/node', '#!/bin/sh\nif [ "$1" = "--version" ]; then echo v22.21.1; else echo \'{"type":"status","state":"usable"}\'; fi\n', '0755')
add(pi_pkg+'/package.json', json.dumps({'name':'@earendil-works/pi-coding-agent','version':'1.5.2','exports':{'.':{'import':'./dist/index.js'}},'bin':{'pi':'dist/bundle/cli.js'}}))
add(pi_pkg+'/dist/index.js', '// routing fixture; never runs a prompt\n')
add(pi_pkg+'/dist/bundle/cli.js', '// routing fixture; never runs a prompt\n')
add('/opt/open-habitat/pi-runtime.json',json.dumps({'node':pi_root+'/bin/node','entry':pi_pkg+'/dist/index.js','manifest':pi_pkg+'/package.json'}))
for name, uid, subject in [('agent-a',21001,'31001'),('agent-b',21002,'31002')]:
    sock = '/run/open-habitat/users/'+name+'/daemon.sock'
    binding='/etc/open-habitat-daemon/daemon/user-mappings/daemon-'+name+'.json'
    add(binding, json.dumps({'component':'daemon','handoff':{'gateway_uid':21003,'uid':uid,'username':name,'home':'/home/'+name,'socket':sock,'provider':'github','subject':subject,'binding_file':binding}},separators=(',',':')))
    add('/usr/local/lib/fixture/tokens/'+name, 'PRODUCT_VM_TOKEN_'+name.replace('-','_')+'_FIXTURE_ONLY_92764', '0600')
# Historical pre-provisioned fixture: committed bindings and account/ACL/unit
# material exist BEFORE browser OAuth. This does not exercise first-login JIT.
state='/var/lib/open-habitat/broker'
add(state+'/broker.json',json.dumps({'version':1,'gateway_uid':21003,'gateway_gid':21003,'uid_min':21001,'uid_max':21002,'state_dir':state}), '0600')
add(state+'/allowlist.json',json.dumps({'version':1,'epoch':2,'ids':[{'id':'31001'},{'id':'31002'}]}), '0600')
add(state+'/bindings.json',json.dumps({'version':1,'generation':2,'bindings':[{'id':'31001','uid':21001,'username':'agent-a'},{'id':'31002','uid':21002,'username':'agent-b'}]}), '0600')
add(state+'/head.json',json.dumps({'version':1,'epoch':2,'generation':2}), '0600')
# Storage, proc, broker, binding-gate and listener units, the proc group and
# the storage policy come from production `host prepare` inside the guest
# (product-proof), after the quota home exists. Only the daemon service, which
# apply installs, is copied here.
add('/etc/systemd/system/open-habitat-daemon@.service',(repo/'systemd/open-habitat-daemon@.service').read_text())
site=json.loads((repo/'site/example.json').read_text())
for key in ('oauth_secret_file','tls_cert_file','tls_key_file'):site['gateway'][key]='/etc/open-habitat/prepare-unused'
add('/etc/open-habitat/site.json',json.dumps(site),'0600')
add('/etc/open-habitat/prepare-unused','synthetic-unused','0600')
add('/etc/open-habitat/gateway.json',json.dumps({'component':'gateway','listen':'127.0.0.1:8443','tls_cert':'/etc/open-habitat/tls.crt','tls_key':'/etc/open-habitat/tls.key','gateway_uid':21003,'oauth':{'client_id':'fixture-client','client_secret':'fixture-secret','callback_url':'https://host.fixture:8443/auth/github/callback','origin':'https://host.fixture:8443'}}))
add('/etc/systemd/system/open-habitat-revoke.socket',(repo/'systemd/open-habitat-revoke.socket').read_text().replace('Service=open-habitat-gateway.service','Service=product-gateway.service'))
add('/etc/systemd/system/product-gateway.service','[Service]\nSockets=open-habitat-revoke.socket\nStateDirectory=open-habitat-gateway\nStateDirectoryMode=0700\nUser=open-habitat-gateway\nGroup=open-habitat-gateway\nEnvironment=SSL_CERT_FILE=/etc/open-habitat/fixture-ca.crt\nExecStart=/opt/open-habitat/current/open-habitat gateway exec --config /etc/open-habitat/gateway.json\nNoNewPrivileges=yes\nUMask=0077\n')
add('/usr/local/sbin/product-daemon-launch', (repo/'test/vm/daemon-launch.py').read_bytes(),'0755')
add('/usr/local/sbin/product-fake-provider', (repo/'test/vm/fake-provider.py').read_bytes(),'0755')
add('/usr/local/sbin/product-proof', (repo/'test/vm/product-proof.py').read_bytes(),'0755')
add('/usr/bin/gh', (repo/'test/vm/fake-gh.py').read_bytes(),'0755')
add('/usr/bin/git', (repo/'test/vm/fake-git.py').read_bytes(),'0755')
seed={'users':users,'write_files':files,'runcmd':[
    ['mkdir','-p','/mnt/product','/opt/open-habitat/current'],
    ['mount','-o','ro','/dev/disk/by-label/PRODUCT','/mnt/product'],
    ['install','-m','0755','/mnt/product/open-habitat','/opt/open-habitat/current/open-habitat'],
    ['/bin/sh','-c','test -e /usr/lib/x86_64-linux-gnu/libacl.so.1 || install -m 0644 /mnt/product/libacl.so.1 /usr/lib/x86_64-linux-gnu/libacl.so.1'],
    ['install','-m','0755','/mnt/product/setfacl','/usr/bin/setfacl'],
    ['install','-m','0755','/mnt/product/getfacl','/usr/bin/getfacl'],
    ['install','-D','-m','0644','/mnt/product/quota_tree.ko.zst','/lib/modules/6.8.0-139-generic/kernel/fs/quota/quota_tree.ko.zst'],
    ['install','-D','-m','0644','/mnt/product/quota_v2.ko.zst','/lib/modules/6.8.0-139-generic/kernel/fs/quota/quota_v2.ko.zst'],
    ['depmod','-a'],
    ['umount','/mnt/product'],
    ['chown','-R','21001:21001','/home/agent-a'],
    ['chown','-R','21002:21002','/home/agent-b'],
    ['chmod','0700','/home/agent-a','/home/agent-b'],
    ['chown','-R','root:root',state],
    ['chmod','0700',state],
    ['chown','root:root','/etc/open-habitat-daemon','/etc/open-habitat-daemon/daemon','/etc/open-habitat-daemon/daemon/user-mappings'],
    ['chmod','0711','/etc/open-habitat-daemon','/etc/open-habitat-daemon/daemon','/etc/open-habitat-daemon/daemon/user-mappings'],
    ['chown','root:open-habitat-gateway','/etc/open-habitat'],
    ['chmod','0750','/etc/open-habitat'],
    ['/usr/bin/python3','/usr/local/sbin/product-proof']]}
(run/'product-cloud-init.yaml').write_text('#cloud-config\n'+json.dumps(seed, separators=(',',':'))+'\n')
(run/'product-cloud-init.yaml').chmod(0o600)
(run/'tls.key').unlink()
(run/'tls.crt').unlink()
