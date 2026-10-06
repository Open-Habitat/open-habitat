#!/usr/bin/env python3
"""Disposable JIT broker seed; only hash-verified public Fleetrepo gate bytes."""
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

repo = Path(__file__).resolve().parents[2]
# Read exact committed blobs, not a mutable checkout (Fleetrepo need not be at
# the historical commit). No git checkout/worktree or host write is performed.
source = Path(os.environ['FLEETREPO_JIT_SOURCE'])
head = '3a165c4f3a455e76f29b04f97823b4ee5fcfa40d'
if subprocess.check_output(['git','-C',str(source),'rev-parse',head],text=True).strip() != head:
    raise ValueError('Reviewed Fleetrepo JIT commit unavailable')
receipts = {
 'jit_policy.py':'f9a9b1fe377264ef21b8861388dad6e23938cea72463af7a3f7bb5a3f20344f2',
 'jit_acl_prepare.py':'86303fd6922082897ce26bf0d026209ff7c33f66855ed7267260143daebaea06',
 'native-agent-host-jit-policy-gate.service':'4f5c2cd4fb1050c18729bc89c68f688b63d673a0c81bf112b51bf28c0edd4a87',
 'native-agent-host-jit-policy-gate@.service':'5943cb8a58a0136fcb07858774faa39ee2ad91361ee3ebf24cb62778effee22b',
 'native-agent-host-broker.socket.d/10-fleetrepo-jit-gate.conf':'7ebe6f363cc8c87d2c114c01c5cdf2b05715104478224ade3074b46794d66191',
 'native-agent-host-daemon@.socket.d/10-fleetrepo-jit-gate.conf':'118f129b5169c753a8096bea6f935a94d32afe77db86b813fe8356338f561e7e',
 'jit_guest_fixture.py':'ca5892b129ceb972113aec74de485729a738b442f18009283df478b2eae4a5d1',
 'jit_guest_proof.py':'32a729c10cfd3e137bf9590c598b597f110d82304838123d4ecbca3f930c5aa7',
 'test-jit-guest.sh':'90a05994b174a1767a28dcd691aac03e6ef9ee9cca2d9ef21ad5687981c4c480',
}
staged = {name: subprocess.check_output(['git','-C',str(source),'show',
    f'{head}:infra/native-agent-host-test/{name}']) for name in receipts}
for name, digest in receipts.items():
    if hashlib.sha256(staged[name]).hexdigest() != digest:
        raise ValueError(f'Fleetrepo JIT policy hash mismatch: {name}')
if len(sys.argv) not in (3,4) or (len(sys.argv)==4 and sys.argv[3] not in ('login','reboot','concurrent','broker-crash')) or not Path(sys.argv[2]).is_file():
    raise ValueError('Expected output directory and regular product binary')
run = Path(sys.argv[1]); binary = Path(sys.argv[2])
(run/'jit-receipt.json').write_text(json.dumps({'commit':head,'sha256':receipts},sort_keys=True))
login = len(sys.argv)==4
seed = {'users':[{'name':'ubuntu','uid':22000,'shell':'/bin/bash'},
 {'name':'native-agent-host-gateway','uid':21003,'shell':'/usr/sbin/nologin','no_create_home':True},
 {'name':'alice','uid':21001,'shell':'/usr/sbin/nologin'},
 {'name':'bob','uid':21002,'shell':'/usr/sbin/nologin'}], 'write_files': [], 'runcmd': []}
def add(path, data, mode='0644'):
    if isinstance(data,str): data=data.encode()
    seed['write_files'].append({'path':path,'permissions':mode,'encoding':'b64','content':base64.b64encode(data).decode()})
release_root = Path(os.environ['PRODUCT_RELEASE_ROOT']) if os.environ.get('PRODUCT_RELEASE_ROOT') else repo
for name in ('native-agent-host-broker.socket','native-agent-host-broker.service','native-agent-host-daemon@.socket','native-agent-host-daemon@.service',
             'native-agent-host-gateway.service'):
    add('/etc/systemd/system/'+name,(release_root/'systemd'/name).read_bytes())
for name in ('jit_policy.py','jit_acl_prepare.py'):
    add('/usr/local/libexec/native-agent-host-test-jit/'+name,staged[name],'0755')
for name in ('native-agent-host-jit-policy-gate.service','native-agent-host-jit-policy-gate@.service'):
    add('/etc/systemd/system/'+name,staged[name])
for name in ('native-agent-host-broker.socket','native-agent-host-daemon@.socket'):
    add('/etc/systemd/system/'+name+'.d/10-fleetrepo-jit-gate.conf',staged[name+'.d/10-fleetrepo-jit-gate.conf'])
proof='jit-broker-crash-proof.py' if len(sys.argv)==4 and sys.argv[3]=='broker-crash' else 'jit-concurrent-proof.py' if len(sys.argv)==4 and sys.argv[3]=='concurrent' else 'jit-login-proof.py' if login else 'jit-proof.py'
add('/usr/local/sbin/jit-proof',(repo/'test/vm'/proof).read_bytes(),'0755')
if len(sys.argv)==4 and sys.argv[3]=='reboot':
    add('/etc/native-agent-host/reboot-fixture','reboot\n')
    add('/usr/local/sbin/jit-reboot-proof',(repo/'test/vm/jit-reboot-proof.py').read_bytes(),'0755')
    add('/usr/local/sbin/jit-reboot-watchdog',(repo/'test/vm/jit-reboot-watchdog.py').read_bytes(),'0755')
    add('/etc/systemd/system/jit-reboot-proof.service','[Unit]\nDescription=Disposable post-JIT reboot verification\nConditionPathExists=/var/lib/native-agent-host/reboot-fixture.json\n[Service]\nType=oneshot\nStandardOutput=tty\nTTYPath=/dev/ttyS0\nTimeoutStartSec=100\nExecStart=/usr/local/sbin/jit-reboot-proof\nExecStopPost=/usr/local/sbin/jit-reboot-watchdog\n[Install]\nWantedBy=multi-user.target\n')
add('/etc/systemd/system/jit-proof.service','[Service]\nType=oneshot\nStandardOutput=tty\nTTYPath=/dev/ttyS0\nExecStart=/usr/local/sbin/jit-proof\n')
state='/var/lib/native-agent-host/broker'
for name, obj in {'broker.json':{'version':1,'gateway_uid':21003,'gateway_gid':21003,'uid_min':21032,'uid_max':21047,'state_dir':state},'allowlist.json':{'version':1,'epoch':1,'ids':[]},'bindings.json':{'version':1,'generation':1,'bindings':[]},'head.json':{'version':1,'epoch':1,'generation':1}}.items():
    add(state+'/'+name,json.dumps(obj,separators=(',',':')),'0600')
if login:
    subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=github.com','-addext','subjectAltName=DNS:github.com,DNS:api.github.com,DNS:host.fixture','-keyout',str(run/'tls.key'),'-out',str(run/'tls.crt')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    add('/etc/native-agent-host/binary.sha256',hashlib.sha256(binary.read_bytes()).hexdigest()+'\n')
    add('/etc/native-agent-host/tls.crt',(run/'tls.crt').read_bytes())
    add('/etc/native-agent-host/tls.key',(run/'tls.key').read_bytes(),'0600')
    add('/etc/native-agent-host/fixture-ca.crt',(run/'tls.crt').read_bytes())
    add('/etc/native-agent-host/gateway.json',json.dumps({'component':'gateway','listen':'127.0.0.1:8443','tls_cert':'/etc/native-agent-host/tls.crt','tls_key':'/etc/native-agent-host/tls.key','gateway_uid':21003,'oauth':{'client_id':'fixture-client','client_secret':'fixture-secret','callback_url':'https://host.fixture:8443/auth/github/callback','origin':'https://host.fixture:8443'}}))
    add('/etc/systemd/system/native-agent-host-revoke.socket',
        (release_root/'systemd/native-agent-host-revoke.socket').read_text().replace(
            'Service=native-agent-host-gateway.service', 'Service=product-gateway.service'))
    add('/etc/systemd/system/product-gateway.service','[Service]\nSockets=native-agent-host-revoke.socket\nUser=native-agent-host-gateway\nGroup=native-agent-host-gateway\nEnvironment=SSL_CERT_FILE=/etc/native-agent-host/fixture-ca.crt\nExecStart=/opt/native-agent-host/current/native-agent-host gateway exec --config /etc/native-agent-host/gateway.json\nNoNewPrivileges=yes\nUMask=0077\n')
    for script, target in [('fake-provider.py','product-fake-provider'),('fake-gh.py','gh'),('fake-git.py','git')]:
        data=(repo/'test/vm'/script).read_text()
        data=data.replace('agent-a','guestone').replace('agent-b','guesttwo').replace('agent-c','guestthree').replace('agent_a','guestone').replace('agent_b','guesttwo').replace('agent_c','guestthree').replace('31003','100000003').replace('21001','21032').replace('21002','21033').replace('31001','100000001').replace('31002','100000002')
        add(('/usr/bin/' if target in ('gh','git') else '/usr/local/sbin/')+target,data,'0755')
    for name in ('guestone','guesttwo','guestthree'):
        add('/usr/local/lib/fixture/tokens/'+name,'PRODUCT_VM_TOKEN_'+name+'_FIXTURE_ONLY_92764','0600')
    (run/'tls.key').unlink();(run/'tls.crt').unlink()
seed['runcmd'] = [
 ['mkdir','-p','/mnt/product','/opt/native-agent-host/current','/etc/native-agent-host'],
 ['install','-d','-o','root','-g','root','-m','0711','/etc/omega-habitat','/etc/omega-habitat/daemon','/etc/omega-habitat/daemon/user-mappings'],
 ['mount','-o','ro','/dev/disk/by-label/PRODUCT','/mnt/product'],
 ['install','-m','0755','/mnt/product/native-agent-host','/opt/native-agent-host/current/native-agent-host'],
 ['install','-m','0755','/mnt/product/setfacl','/usr/bin/setfacl'],
 ['install','-m','0755','/mnt/product/getfacl','/usr/bin/getfacl'],
 ['install','-m','0644','/mnt/product/libacl.so.1','/lib/x86_64-linux-gnu/libacl.so.1'],
 ['umount','/mnt/product'],
 ['chown','-R','root:root',state],['chmod','0700',state],
 ['systemctl','daemon-reload'],['systemctl','start','jit-proof.service']]
(run/'jit-cloud-init.yaml').write_text('#cloud-config\n'+json.dumps(seed,separators=(',',':'))+'\n')
(run/'jit-cloud-init.yaml').chmod(0o600)
