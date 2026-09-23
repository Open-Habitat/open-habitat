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
         {'name':'agent-a','uid':21001,'shell':'/bin/bash','homedir':'/home/agent-a'},
         {'name':'agent-b','uid':21002,'shell':'/bin/bash','homedir':'/home/agent-b'},
         {'name':'native-agent-host-gateway','uid':21003,'shell':'/usr/sbin/nologin','homedir':'/var/empty/native-agent-host-gateway','no_create_home':True}]
files = []
def add(path, data, mode='0644'):
    if isinstance(data, str): data = data.encode()
    files.append({'path':path, 'permissions':mode, 'encoding':'b64', 'content':base64.b64encode(data).decode()})
add('/etc/native-agent-host/binary.sha256', hashlib.sha256(binary.read_bytes()).hexdigest()+'\n')
# The binary is delivered on a separate read-only ISO, not embedded in
# cloud-init YAML: parsing a 17 MiB seed under QEMU TCG starves cloud-config.
add('/etc/native-agent-host/tls.crt', (run/'tls.crt').read_bytes())
add('/etc/native-agent-host/tls.key', (run/'tls.key').read_bytes(), '0600')
add('/etc/native-agent-host/fixture-ca.crt', (run/'tls.crt').read_bytes())
for name, uid, subject in [('agent-a',21001,'31001'),('agent-b',21002,'31002')]:
    sock = '/run/native-agent-host/users/'+name+'/daemon.sock'
    add('/etc/native-agent-host/daemon-'+name+'.json', json.dumps({'component':'daemon','handoff':{'gateway_uid':21003,'uid':uid,'username':name,'home':'/home/'+name,'socket':sock,'provider':'github','subject':subject}}))
    add('/etc/systemd/system/product-'+name+'.socket', f'[Socket]\nListenStream={sock}\nSocketUser={name}\nSocketGroup=native-agent-host-gateway\nSocketMode=0660\nDirectoryMode=0711\nFileDescriptorName=daemon\nAccept=no\n[Install]\nWantedBy=sockets.target\n')
    add('/etc/systemd/system/product-'+name+'.service', f'[Unit]\nRequires=product-{name}.socket\n[Service]\nUser={name}\nGroup={name}\nExecStart=/usr/bin/python3 /usr/local/sbin/product-daemon-launch daemon exec --config /etc/native-agent-host/daemon-{name}.json\nNoNewPrivileges=yes\nUMask=0077\n')
    add('/usr/local/lib/fixture/tokens/'+name, 'PRODUCT_VM_TOKEN_'+name.replace('-','_')+'_FIXTURE_ONLY_92764', '0600')
identities=[{'provider':'github','subject':str(31001+i),'uid':21001+i,'username':n,'socket':'/run/native-agent-host/users/'+n+'/daemon.sock'} for i,n in enumerate(['agent-a','agent-b'])]
add('/etc/native-agent-host/gateway.json',json.dumps({'component':'gateway','listen':'127.0.0.1:8443','tls_cert':'/etc/native-agent-host/tls.crt','tls_key':'/etc/native-agent-host/tls.key','gateway_uid':21003,'oauth':{'client_id':'fixture-client','client_secret':'fixture-secret','callback_url':'https://host.fixture:8443/auth/github/callback','origin':'https://host.fixture:8443','identities':identities}}))
add('/etc/systemd/system/product-gateway.service','[Service]\nUser=native-agent-host-gateway\nGroup=native-agent-host-gateway\nEnvironment=SSL_CERT_FILE=/etc/native-agent-host/fixture-ca.crt\nExecStart=/opt/native-agent-host/native-agent-host gateway exec --config /etc/native-agent-host/gateway.json\nNoNewPrivileges=yes\nUMask=0077\n')
add('/usr/local/sbin/product-daemon-launch', (repo/'test/vm/daemon-launch.py').read_bytes(),'0755')
add('/usr/local/sbin/product-fake-provider', (repo/'test/vm/fake-provider.py').read_bytes(),'0755')
add('/usr/local/sbin/product-proof', (repo/'test/vm/product-proof.py').read_bytes(),'0755')
add('/usr/bin/gh', (repo/'test/vm/fake-gh.py').read_bytes(),'0755')
add('/usr/bin/git', (repo/'test/vm/fake-git.py').read_bytes(),'0755')
seed={'users':users,'write_files':files,'runcmd':[
    ['mkdir','-p','/mnt/product','/opt/native-agent-host'],
    ['mount','-o','ro','/dev/disk/by-label/PRODUCT','/mnt/product'],
    ['install','-m','0755','/mnt/product/native-agent-host','/opt/native-agent-host/native-agent-host'],
    ['umount','/mnt/product'],
    ['chown','-R','21001:21001','/home/agent-a'],
    ['chown','-R','21002:21002','/home/agent-b'],
    ['chmod','0700','/home/agent-a','/home/agent-b'],
    ['/usr/bin/python3','/usr/local/sbin/product-proof']]}
(run/'product-cloud-init.yaml').write_text('#cloud-config\n'+json.dumps(seed, separators=(',',':'))+'\n')
(run/'product-cloud-init.yaml').chmod(0o600)
(run/'tls.key').unlink()
(run/'tls.crt').unlink()
