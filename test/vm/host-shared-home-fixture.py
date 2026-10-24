#!/usr/bin/env python3
"""Production prepare, check and broker first login on a single-filesystem guest.

The guest has no second disk: /home is a directory on the ext4 root filesystem,
which has no quota features, and the site declares no per-user limits. Only
empty broker installation state is seeded; the broker creates both accounts.
"""
import base64,json,sys
from pathlib import Path
run=Path(sys.argv[1]);repo=Path(sys.argv[2])
site=json.loads((repo/'site/example.json').read_text())
for k in ('oauth_secret_file','tls_cert_file','tls_key_file'):site['gateway'][k]='/etc/open-habitat/fixture-secret'
site['storage']['enforce_user_quota']=False
del site['storage']['default_limit_bytes']
files=[]
def add(path,data,mode='0644'):
 files.append({'path':path,'permissions':mode,'encoding':'b64','content':base64.b64encode(data.encode()).decode()})
add('/etc/open-habitat/site.json',json.dumps(site),'0600')
add('/etc/open-habitat/fixture-secret','synthetic-secret','0600')
add('/etc/systemd/system/open-habitat-daemon@.service',(repo/'systemd/open-habitat-daemon@.service').read_text())
add('/usr/local/sbin/host-shared-home-proof',(repo/'test/vm/host-shared-home-proof.py').read_text(),'0755')
add('/etc/systemd/system/host-shared-home-proof.service','''[Unit]
Description=Disposable single-filesystem installation proof (second boot)
After=open-habitat-broker.service
ConditionPathExists=/var/lib/fixture-shared-home.json
[Service]
Type=oneshot
StandardOutput=journal+console
StandardError=journal+console
TimeoutStartSec=300
ExecStart=/usr/local/sbin/host-shared-home-proof
ExecStopPost=/bin/sh -c 'test "$SERVICE_RESULT" = success || /usr/bin/systemctl --no-block poweroff'
[Install]
WantedBy=multi-user.target
''')
add('/etc/systemd/system/host-shared-home-initialize.service','''[Unit]
Description=Disposable single-filesystem installation proof (first boot)
[Service]
Type=oneshot
StandardOutput=tty
StandardError=tty
TTYPath=/dev/ttyS0
TimeoutStartSec=600
ExecStart=/usr/local/sbin/host-shared-home-proof initialize
''')
seed={'users':['default'],'write_files':files,'runcmd':[['systemctl','daemon-reload'],['systemctl','start','--no-block','host-shared-home-initialize.service']]}
(run/'host-shared-home-cloud-init.yaml').write_text('#cloud-config\n'+json.dumps(seed)+'\n')
