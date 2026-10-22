#!/usr/bin/env python3
"""Fresh offline guest: independent verify, private stage, production daemon startup."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time
import traceback


def run(*args, **kw):
    return subprocess.run(args, check=True, text=True, **kw)


def proof():
    run('mount', '-o', 'ro', '/dev/disk/by-label/PRODUCT', '/mnt')
    # Trust/target come from the seed, not from the artifact ISO.
    target = json.loads(Path('/etc/core-runtime-target.json').read_text())
    args = ['/mnt/verifier', '--directory', '/mnt/release', '--key-file', '/etc/core-runtime-key.pub', '--version', target['version'], '--manifest-sha256', target['manifest_sha256']]
    def unprivileged():
        os.setgroups([]); os.setgid(65534); os.setuid(65534)
    run(args[0], 'verify', *args[1:], preexec_fn=unprivileged, env={'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent', 'TMPDIR': '/var/tmp'})
    print('CORE_RUNTIME_VERIFIED', flush=True)
    stage = Path('/var/lib/core-runtime-stage')
    stage.mkdir(mode=0o700)
    result = json.loads(subprocess.check_output([args[0], 'stage', *args[1:], '--stage-parent', str(stage)], text=True))
    payload = stage / result['data']['name'] / 'payloads/core'
    # Staging is intentionally private. Explicit fixture publication of only
    # the verified immutable runtime is NOT the product activation executor.
    installed = Path('/opt/open-habitat/core')
    installed.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(payload / 'runtime'), installed)
    installed.chmod(0o755)
    print('CORE_RUNTIME_STAGED', flush=True)
    # Independently exercise the deb solver result completely offline. No holds,
    # force-depends, allow-downgrades or install-time network resolution.
    debs = sorted(str(p) for p in (payload / 'debs').glob('*.deb'))
    run('/usr/bin/apt-get', '-y', '--no-download', '--no-install-recommends', 'install', *debs, env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'DEBIAN_FRONTEND': 'noninteractive', 'HOME': '/root'})
    print('CORE_RUNTIME_DEBS_INSTALLED', flush=True)
    for tool in ('git', 'gh', 'tmux', 'setfacl', 'quota', 'useradd'):
        assert shutil.which(tool, path='/usr/sbin:/usr/bin:/sbin:/bin'), tool
    for name, uid in [('agent-a', 21001), ('agent-b', 21002)]:
        run('/usr/sbin/useradd', '-m', '-u', str(uid), name)
    run('/usr/sbin/useradd', '-M', '-u', '21003', 'fixture-gateway')
    selector = {'node': str(installed / 'bin/node'), 'entry': str(installed / 'node_modules/@earendil-works/pi-coding-agent/dist/index.js'), 'manifest': str(installed / 'node_modules/@earendil-works/pi-coding-agent/package.json')}
    Path('/opt/open-habitat/pi-runtime.json').write_text(json.dumps(selector))
    Path('/opt/open-habitat/pi-runtime.json').chmod(0o644)
    shutil.copyfile('/mnt/product', '/opt/open-habitat/product')
    Path('/opt/open-habitat/product').chmod(0o755)
    for name, uid in [('agent-a', 21001), ('agent-b', 21002)]:
        directory = Path('/run/open-habitat/users') / name
        directory.mkdir(parents=True)
        directory.chmod(0o755)
        sockpath = str(directory / 'daemon.sock')
        listener = socket.socket(socket.AF_UNIX)
        listener.bind(sockpath)
        os.chown(sockpath, uid, 21003)
        os.chmod(sockpath, 0o660)
        listener.listen()
        cfgdir = Path('/etc/open-habitat-daemon/daemon/user-mappings')
        cfgdir.mkdir(parents=True, exist_ok=True)
        for d in [cfgdir, cfgdir.parent, cfgdir.parent.parent]:
            d.chmod(0o711)
        cfg = cfgdir / ('daemon-' + name + '.json')
        cfg.write_text(json.dumps({'component': 'daemon', 'handoff': {'gateway_uid': 21003, 'uid': uid, 'username': name, 'home': '/home/' + name, 'socket': sockpath, 'provider': 'github', 'subject': str(uid), 'binding_file': str(cfg)}}))
        os.chown(cfg, 0, uid)
        cfg.chmod(0o640)
        # Both systemd activation descriptors are required by the production CLI.
        agent = socket.socket(socket.AF_UNIX)
        agentpath = directory / 'agent.sock'
        agent.bind(str(agentpath)); os.chown(agentpath, uid, uid); os.chmod(agentpath, 0o600); agent.listen()
        trampoline = '''import os,sys
fds=[int(sys.argv[1]),int(sys.argv[2])]
# Duplicate high first so fd3/fd4 replacement cannot destroy a source.
fds=[os.dup(f) for f in fds]
for f,dest in zip(fds,(3,4)):os.dup2(f,dest);os.set_inheritable(dest,True)
os.setgroups([]);os.setgid(int(sys.argv[3]));os.setuid(int(sys.argv[3]))
os.environ.clear();os.environ.update(HOME=sys.argv[4],PATH='/usr/bin:/bin',LISTEN_PID=str(os.getpid()),LISTEN_FDS='2',LISTEN_FDNAMES='daemon:agent')
os.execv('/opt/open-habitat/product',['/opt/open-habitat/product','daemon','exec','--config',sys.argv[5]])'''
        log = open('/var/log/core-runtime-' + name + '.log', 'w')
        p = subprocess.Popen(['/usr/bin/python3', '-c', trampoline, str(listener.fileno()), str(agent.fileno()), str(uid), '/home/' + name, str(cfg)], pass_fds=(listener.fileno(), agent.fileno()), stdout=log, stderr=log)
        listener.close(); agent.close()
        # A successful request as the mapped UID proves handlers were published
        # after ServeHTTP's real pi.validate, not merely that a PID was launched.
        probe = '''import socket,sys
s=socket.socket(socket.AF_UNIX);s.settimeout(2);s.connect(sys.argv[1]);s.sendall(b'GET /agent/v1/environment HTTP/1.1\\r\\nHost: unix\\r\\nConnection: close\\r\\n\\r\\n');data=s.recv(1024);assert data.startswith(b'HTTP/1.1 200 '),data'''
        def drop():
            os.setgroups([]); os.setgid(uid); os.setuid(uid)
        end = time.monotonic() + 60
        while True:
            if p.poll() is not None:
                log.close()
                raise RuntimeError(Path('/var/log/core-runtime-' + name + '.log').read_text())
            reply = subprocess.run(['/usr/bin/python3', '-c', probe, str(agentpath)], preexec_fn=drop, capture_output=True)
            if reply.returncode == 0:
                break
            assert time.monotonic() < end, reply.stderr
            time.sleep(.25)
        # The same probe must fail as root; a generic HTTP/403 reply is not
        # evidence that the mapped user's authenticated handler was reached.
        refused = subprocess.run(['/usr/bin/python3', '-c', probe, str(agentpath)], capture_output=True)
        assert refused.returncode != 0, 'root unexpectedly reached own-UID handler'
        print('CORE_RUNTIME_DAEMON_ACCEPTED uid=' + str(uid) + ' HOME=/home/' + name + ' PATH=/usr/bin:/bin', flush=True)
        p.terminate(); p.wait(timeout=10); log.close()
    print('CORE_RUNTIME_PASS', flush=True)


try:
    proof()
except Exception:
    subprocess.run(['/bin/df', '-h', '/'])
    traceback.print_exc()
    print('CORE_RUNTIME_FAIL', flush=True)
finally:
    subprocess.run(['/sbin/poweroff', '-f'])
