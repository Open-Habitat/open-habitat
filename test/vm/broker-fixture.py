#!/usr/bin/env python3
"""Private disposable root broker/systemd seed, never a host declaration."""
import base64
import json
import pathlib
import sys

repo = pathlib.Path(__file__).resolve().parents[2]
run = pathlib.Path(sys.argv[1])
binary = pathlib.Path(sys.argv[2])
files = []
def add(path, content, mode='0644'):
    if isinstance(content, str): content = content.encode()
    files.append({'path': path, 'permissions': mode, 'encoding': 'b64', 'content': base64.b64encode(content).decode()})
add('/etc/systemd/system/native-agent-host-broker.socket', (repo/'systemd/native-agent-host-broker.socket').read_bytes())
service = (repo/'systemd/native-agent-host-broker.service').read_text().replace('/opt/native-agent-host/current/native-agent-host', '/opt/native-agent-host/native-agent-host')
add('/etc/systemd/system/native-agent-host-broker.service', service)
add('/usr/local/sbin/broker-proof', (repo/'test/vm/broker-proof.py').read_bytes(), '0755')
add('/etc/systemd/system/broker-proof.service', '[Service]\nType=oneshot\nStandardOutput=tty\nTTYPath=/dev/ttyS0\nExecStart=/usr/local/sbin/broker-proof\n')
state = '/var/lib/native-agent-host/broker'
add(state+'/broker.json', json.dumps({'version':1,'gateway_uid':21003,'gateway_gid':21003,'uid_min':22010,'uid_max':22011,'state_dir':state}), '0600')
add(state+'/allowlist.json', '{"version":1,"epoch":2,"ids":[]}', '0600')
add(state+'/bindings.json', '{"version":1,"generation":1,"bindings":[]}', '0600')
add(state+'/head.json', '{"version":1,"epoch":2,"generation":1}', '0600')
seed = {'users':['default', {'name':'native-agent-host-gateway','uid':21003,'shell':'/usr/sbin/nologin','no_create_home':True}, {'name':'broker-stranger','uid':21005,'shell':'/usr/sbin/nologin','no_create_home':True}], 'write_files': files, 'runcmd': [
    ['mkdir','-p','/mnt/product','/opt/native-agent-host'],
    ['mount','-o','ro','/dev/disk/by-label/PRODUCT','/mnt/product'],
    ['install','-m','0755','/mnt/product/native-agent-host','/opt/native-agent-host/native-agent-host'],
    ['umount','/mnt/product'],
    ['mkdir','-p','/run/native-agent-host'],
    ['chown','root:native-agent-host-gateway','/run/native-agent-host'],
    ['chmod','0750','/run/native-agent-host'],
    ['chown','-R','root:root',state],
    ['chmod','0700',state],
    ['systemctl','daemon-reload'],
    ['systemctl','start','broker-proof.service']]}
(run/'broker-cloud-init.yaml').write_text('#cloud-config\n'+json.dumps(seed, separators=(',',':'))+'\n')
(run/'broker-cloud-init.yaml').chmod(0o600)
