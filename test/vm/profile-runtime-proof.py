#!/usr/bin/env python3
"""Offline native profile smoke/workflow evidence, never customer-repo acceptance."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import traceback


def run(*args, **kw):
    return subprocess.run(args, check=True, text=True, **kw)


def apt_policy_options():
    # Solving a lock must never remove customer OS packages to make it fit.
    return ['--no-download', '--no-remove', '--no-install-recommends']


def apt_preview_options(empty):
    empty.mkdir(exist_ok=True)
    return ['--simulate', '-o', 'Dir::State::lists=' + str(empty), '-o', 'Dir::Etc::sourcelist=/dev/null', '-o', 'Dir::Etc::sourceparts=-']


def install_packages(payloads, names, preview=False):
    locks = [json.loads(p.read_text()) for p in sorted(payloads.glob('*/ubuntu-packages.json')) if p.parent.name in names]
    packages = {}
    for lock in locks:
        for p in lock['packages']:
            if p['role'] == 'tool':
                old = packages.setdefault(p['name'], p)
                assert old == p, 'conflicting selected tool locks'
    debs = []
    for p in packages.values():
        source = next(payloads.glob('*/debs/' + p['filename']))
        if preview:
            debs.append(str(source))
        else:
            dest = Path('/var/cache/apt/archives') / p['filename']
            shutil.copyfile(source, dest)
            dest.chmod(0o644)
            debs.append(str(dest))
    options = []
    if preview:
        # An empty repository index is essential: --simulate alone could plan
        # fetching a missing sibling dependency without exercising acquisition.
        options = apt_preview_options(Path('/var/tmp/profile-empty-apt-lists'))
    run('/usr/bin/apt-get', '-y', *apt_policy_options(), *options, 'install', *debs,
        env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': '/root', 'LANG': 'C.UTF-8', 'DEBIAN_FRONTEND': 'noninteractive', 'NEEDRESTART_MODE': 'l'})
    if preview:
        return
    output = subprocess.check_output(['/usr/bin/dpkg-query', '--show', '--showformat=${Package}\t${Version}\t${Architecture}\t${Status}\n', *packages], text=True)
    observed = {r[0]: r[1:] for line in output.splitlines() if (r := line.split('\t'))}
    assert observed == {p['name']: [p['version'], p['architecture'], 'install ok installed'] for p in packages.values()}
    print('PROFILE_RUNTIME_DEBS_INSTALLED tools=' + str(len(packages)), flush=True)

def proof(payloads):
    # Qualify independent profiles first. A container/platform conflict must not
    # hide their evidence, nor be silently accepted as a complete candidate.
    normal = [p.name for p in payloads.iterdir() if p.is_dir() and p.name != 'containers']
    manifest = json.loads(Path('/mnt/release/release.json').read_text())
    requires = {a['profile']: a['requires'] for a in manifest['artifacts']}
    def preflight(profile):
        selected = {'core', profile}
        while True:
            expanded = selected | {dep for p in selected for dep in requires[p]}
            if expanded == selected:
                break
            selected = expanded
        install_packages(payloads, selected, preview=True)
        print('PROFILE_RUNTIME_PREFLIGHT profile=' + profile, flush=True)
    rejected = []
    for profile in [*normal, *(['containers'] if (payloads / 'containers').exists() else [])]:
        try:
            preflight(profile)
        except subprocess.CalledProcessError:
            if profile == 'core':
                raise
            rejected.append(profile)
            print('PROFILE_RUNTIME_UNAVAILABLE profile=' + profile + ' reason=runtime_package_conflict', flush=True)
    normal = [p for p in normal if p not in rejected]
    install_packages(payloads, normal)
    editor = payloads / 'editor/runtime'
    if editor.exists():
        installed = Path('/opt/open-habitat/profiles/editor')
        installed.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(editor), installed)
        for d in [installed, *[p for p in installed.rglob('*') if p.is_dir()]]:
            d.chmod(0o755)
    uv = payloads / 'uv/runtime'
    if uv.exists():
        installed = Path('/opt/open-habitat/profiles/uv')
        installed.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(uv), installed)
        for d in [installed, *[p for p in installed.rglob('*') if p.is_dir()]]:
            d.chmod(0o755)
    python = payloads / 'python'
    if python.exists():
        installed = Path('/opt/open-habitat/profiles/python')
        installed.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(python / 'runtime'), installed)
        shutil.move(str(python / 'qualification'), installed / 'qualification')
        for d in [installed, *[p for p in installed.rglob('*') if p.is_dir()]]:
            d.chmod(0o755)
    containers = payloads / 'containers/runtime'
    if containers.exists():
        installed = Path('/opt/open-habitat/profiles/containers')
        installed.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(containers), installed)
        for d in [installed, *[p for p in installed.rglob('*') if p.is_dir()]]:
            d.chmod(0o755)
        unit = Path('/usr/lib/systemd/user/open-habitat-containers.service')
        shutil.copyfile(installed / 'systemd/user/open-habitat-containers.service', unit)
        unit.chmod(0o644)
    scripts = {
        'python': r'''set -eu
python=/opt/open-habitat/profiles/python/bin/python3.14
uv=/opt/open-habitat/profiles/uv/bin/uv
export UV_PYTHON_DOWNLOADS=never UV_NO_MANAGED_PYTHON=1 UV_PYTHON="$python"
"$python" -c 'import sys,ssl,sqlite3,ctypes,_dbm,lzma,compression.zstd; assert sys.version_info[:3] == (3,14,4); assert ssl.OPENSSL_VERSION; assert sys.prefix == "/opt/open-habitat/profiles/python"'
printf '[project]\nname="native-wheel-fixture"\nversion="0.0.0"\nrequires-python="==3.14.*"\ndependencies=["MarkupSafe==3.0.4", "PyYAML==6.0.3"]\n' > pyproject.toml
"$uv" lock --offline --no-index --find-links /opt/open-habitat/profiles/python/qualification/wheels
"$uv" sync --offline --frozen --no-index --find-links /opt/open-habitat/profiles/python/qualification/wheels
"$uv" run --offline --frozen python - <<'PYTHON_PROJECT'
import sys, yaml, markupsafe, markupsafe._speedups, yaml._yaml, ssl, sqlite3
assert sys.version_info[:3] == (3,14,4)
assert sys.prefix != sys.base_prefix
assert sys.base_prefix == '/opt/open-habitat/profiles/python'
assert yaml.__with_libyaml__ and yaml._yaml.get_version_string() == '0.2.5'
assert yaml.safe_load('native: true')['native'] is True
assert str(markupsafe.escape('<native>')) == '&lt;native&gt;'
assert markupsafe._speedups.__file__.endswith('.so') and yaml._yaml.__file__.endswith('.so')
PYTHON_PROJECT
# A separate standalone lock/project must not borrow the first project's venv.
mkdir standalone
cd standalone
printf '[project]\nname="standalone-fixture"\nversion="0.0.0"\nrequires-python="==3.14.*"\n' > pyproject.toml
"$uv" lock --offline
"$uv" sync --offline --frozen
"$uv" run --offline --frozen python -c 'import sys; assert sys.version_info[:3] == (3,14,4); assert sys.prefix.endswith("standalone/.venv")'
''',
        'editor': r"""set -eu
/opt/open-habitat/profiles/editor/bin/code-server --version | grep 4.141.0
python3 - <<'EDITOR_PY'
import subprocess, time, urllib.request
with open('editor.log','w') as log:
 p=subprocess.Popen(['/opt/open-habitat/profiles/editor/bin/code-server','--auth','none','--disable-telemetry','--disable-update-check','--bind-addr','127.0.0.1:18989','.'],stdout=log,stderr=log)
 try:
  end=time.monotonic()+60
  while True:
   assert p.poll() is None, open('editor.log').read()
   try:
    with urllib.request.urlopen('http://127.0.0.1:18989/healthz',timeout=1) as r:
     assert r.status==200
    break
   except OSError:
    assert time.monotonic()<end, open('editor.log').read()
    time.sleep(.2)
 finally:
  p.terminate();p.wait(timeout=15)
EDITOR_PY
""",
        'containers': r"""set -eu
systemctl --user enable --now open-habitat-containers.service
systemctl --user is-active open-habitat-containers.service
podman info --format json | tee podman-info.json
podman version
slirp4netns --version
python3 - <<'CONTAINER_PY'
import json,os,pathlib,socket,subprocess,tarfile,time,urllib.request
uid=os.getuid()
runtime=pathlib.Path(os.environ['XDG_RUNTIME_DIR'])
assert str(runtime)=='/run/user/'+str(uid) and runtime.stat().st_uid==uid
info=json.loads(pathlib.Path('podman-info.json').read_text())
assert info['host']['security']['rootless'] is True
assert info['host']['cgroupVersion']=='v2' and info['host']['cgroupManager']=='systemd'
# This closure intentionally uses CNI/slirp, not absent netavark/aardvark/pasta.
assert info['host']['networkBackend']=='cni'
# Establish the service's effect BEFORE any direct helper/provider invocation.
# Otherwise an idempotence rerun could silently repair a dead service namespace.
pause_file=runtime/'libpod/tmp/pause.pid'
pause_pid=int(pause_file.read_text())
os.kill(pause_pid,0)
def current_mounts():
 return subprocess.check_output(['podman','unshare','cat','/proc/self/mountinfo'],text=True)
def parent_mounts():
 return [line for line in current_mounts().splitlines() if line.split()[4]==str(runtime/'netns')]
service_mounts=parent_mounts()
assert len(service_mounts)==1 and ' shared:' in service_mounts[0], service_mounts
subprocess.run(['/opt/open-habitat/profiles/containers/bin/initialize-netns'],check=True)
assert parent_mounts()==service_mounts, 'initialization duplicated/replaced the service mount'
assert int(pause_file.read_text())==pause_pid
compose='/opt/open-habitat/profiles/containers/bin/podman-compose'
assert '1.5.0' in subprocess.check_output([compose,'--version'],text=True)

def podman(*args):
 return subprocess.check_output(['podman',*args],text=True).strip()
def resources():
 return {k:podman(*args) for k,args in {
  'containers':('ps','-aq'), 'pods':('pod','ps','-q'),
  'networks':('network','ls','--format','{{.Name}}'),
  'volumes':('volume','ls','-q')}.items()}
def mounts():
 # Inspect the persistent Podman mount namespace, not the caller's host ns.
 return podman('unshare','cat','/proc/self/mountinfo')
def namespaces():
 return sorted(p.name for p in (runtime/'netns').iterdir())
# Query defaults before the baseline, so lazy creation is not a leftover.
podman('network','ls')
baseline=resources()
assert not baseline['containers'] and not baseline['pods'] and not baseline['volumes']
assert namespaces()==[]
before_mounts=mounts()
with tarfile.open('image.tar','w') as t:
 p=pathlib.Path('/mnt/container-probe');i=t.gettarinfo(str(p),arcname='probe');i.uid=i.gid=0;i.mode=0o755
 with p.open('rb') as f:t.addfile(i,f)
subprocess.run(['podman','import','--change','CMD ["/probe"]','image.tar','localhost/runtime-fixture:locked'],check=True)
pathlib.Path('data').mkdir()
pathlib.Path('compose.yaml').write_text('services:\n  probe:\n    image: localhost/runtime-fixture:locked\n    userns_mode: keep-id\n    user: "'+str(uid)+':'+str(uid)+'"\n    mem_limit: 64m\n    ports: ["127.0.0.1:18990:8080"]\n    volumes: ["./data:/data"]\n')
for cycle in (1,2,3):
 if cycle==3:
  # The oneshot remains active across a native pause-process replacement.
  # Prove a new, initially uninitialized namespace, then let only the provider
  # repair it and repeat an actual workflow rather than just --version.
  assert int(pause_file.read_text())==pause_pid
  subprocess.run(['podman','system','migrate'],check=True)
  podman('unshare','/bin/true')
  replacement=int(pause_file.read_text())
  assert replacement!=pause_pid, 'migrate did not replace the pause process'
  assert parent_mounts()==[], 'migrate retained the prior parent namespace'
  subprocess.run([compose,'--version'],check=True)
  recovered=parent_mounts()
  assert len(recovered)==1 and ' shared:' in recovered[0], recovered
  assert int(pause_file.read_text())==replacement
  pause_pid=replacement
  before_mounts=mounts()
 try:
  subprocess.run([compose,'-f','compose.yaml','up','-d'],check=True)
  end=time.monotonic()+45
  while True:
   try:
    with urllib.request.urlopen('http://127.0.0.1:18990',timeout=1) as r:assert json.load(r)=={'uid':uid,'memory_max':'67108864'}
    break
   except OSError:
    assert time.monotonic()<end
    time.sleep(.2)
  assert pathlib.Path('data/owned').stat().st_uid==uid
  assert pathlib.Path('data/owned').read_text()=='synthetic\n'
 finally:
  down=subprocess.run([compose,'-f','compose.yaml','down'],text=True,capture_output=True,check=True)
  print(down.stdout,down.stderr,flush=True)
  # Compose can return zero even if a native subprocess logs cleanup failure.
  assert not any(x in (down.stdout+down.stderr).lower() for x in ('level=error','resource busy','failed','traceback'))
 assert resources()==baseline, resources()
 assert namespaces()==[], namespaces()
 after_mounts=mounts()
 # No extra netns bind remains in the persistent rootless mount namespace.
 def netns_mounts(text):
  return [line.split(' - ',1)[1] for line in text.splitlines() if str(runtime/'netns') in line]
 assert netns_mounts(after_mounts)==netns_mounts(before_mounts), after_mounts
 with socket.socket() as sock:
  sock.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
  sock.bind(('127.0.0.1',18990))
 print('CONTAINER_LIFECYCLE_CLEAN uid='+str(uid)+' cycle='+str(cycle),flush=True)
assert int(pause_file.read_text())==pause_pid
os.kill(pause_pid,0)
podman('rmi','localhost/runtime-fixture:locked')
print('CONTAINER_POST_MIGRATE_CLEAN uid='+str(uid),flush=True)
CONTAINER_PY
""",
        'uv': r'''set -eu
uv=/opt/open-habitat/profiles/uv/bin/uv
$uv --version | grep 0.12.13
$uv venv --offline --python /usr/bin/python3 .venv
.venv/bin/python -c 'import ssl,sqlite3'
printf '[project]\nname="fixture-project"\nversion="0.0.0"\nrequires-python=">=3.12"\n' > pyproject.toml
UV_PYTHON_DOWNLOADS=never $uv lock --offline
UV_PYTHON_DOWNLOADS=never $uv sync --offline --frozen
UV_PYTHON_DOWNLOADS=never $uv run --offline --frozen python -c 'import sys; assert sys.prefix != sys.base_prefix'
''',
        'native-build': r'''set -eu
python3 -m venv probe-env
probe-env/bin/python -c 'import ssl, sqlite3; assert ssl.OPENSSL_VERSION'
printf '#include <stdio.h>\nint main(){puts("native-ok");}\n' > probe.c
cc probe.c -o probe
[ "$(./probe)" = native-ok ]
printf '#include <node_api.h>\nnapi_value init(napi_env e,napi_value x){return x;}\nNAPI_MODULE(NODE_GYP_MODULE_NAME,init)\n' > addon.c
# Headers belong to the qualified Node archive only when explicitly supplied;
# a C compiler smoke is not an npm native-addon acceptance claim.
''',
        'php': r'''set -eu
php -r 'foreach (["curl","dom","gd","intl","mbstring","pdo_pgsql","soap","zip"] as $m) { if (!extension_loaded($m)) exit(1); } if (PHP_MAJOR_VERSION != 8 || PHP_MINOR_VERSION != 3) exit(2);'
composer --no-interaction --version
printf '{"name":"fixture/plugin","description":"synthetic","license":"MIT","require":{"php":">=8.3"}}' > composer.json
composer --no-interaction install --no-plugins --no-scripts --no-progress
psql --version
''',
        'media': r'''set -eu
ffmpeg -hide_banner -loglevel error -f lavfi -i color=red:s=64x64:d=1 -c:v libx264 clip.mp4
ffprobe -v error -show_entries stream=codec_name clip.mp4 | grep h264
convert -size 16x16 xc:red image.png
identify image.png
printf '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>' > image.svg
rsvg-convert image.svg > svg.png
pdftotext -v
''',
        'documents': r'''set -eu
printf '# Synthetic document\n\nOffline text.\n' > document.md
pandoc document.md --pdf-engine=xelatex -o document.pdf
pdftotext document.pdf document.txt
grep 'Offline text' document.txt
pdftoppm -scale-to 64 -png -singlefile document.pdf page
[ -s page.png ]
fc-match -f '%{family}\n' 'DejaVu Sans' | grep -Fx 'DejaVu Sans'
''',
        'operations': r'''set -eu
age-keygen -o identity.txt
age-keygen -y identity.txt > recipient.txt
printf 'synthetic secret' > plain.txt
age -R recipient.txt -o cipher.age plain.txt
age -d -i identity.txt -o decoded.txt cipher.age
cmp plain.txt decoded.txt
mkdir destination
rsync plain.txt destination/
cmp plain.txt destination/plain.txt
ansible localhost -i localhost, -c local -m ansible.builtin.ping
''',
    }
    def qualify_one(name, uid, profile):
        # Unsupported profiles are excluded before signing, not silently
        # accepted through a version-only check here.
        assert profile in scripts, 'no qualification for ' + profile
        work = Path('/home') / name / ('profile-' + profile)
        work.mkdir(mode=0o700)
        os.chown(work, uid, uid)
        def drop():
            os.setgroups([]); os.setgid(uid); os.setuid(uid)
        env = {'HOME': '/home/' + name, 'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'TMPDIR': str(work), 'COMPOSER_DISABLE_NETWORK': '1', 'ANSIBLE_LOCAL_TEMP': str(work / 'ansible-tmp')}
        command = ['/bin/bash', '-euc', scripts[profile]]
        if profile == 'containers':
            # The product broker already owns enable-linger for mapped
            # users. Recreate that native user-manager context here;
            # setuid alone is not a delegated rootless cgroup session.
            run('/usr/bin/loginctl', 'enable-linger', name)
            run('/usr/bin/systemctl', 'start', 'user@' + str(uid) + '.service')
            env.update(XDG_RUNTIME_DIR='/run/user/' + str(uid), DBUS_SESSION_BUS_ADDRESS='unix:path=/run/user/' + str(uid) + '/bus')
            command = ['/usr/bin/systemd-run', '--user', '--wait', '--pipe', '--collect', '--quiet', '--property=Delegate=yes', '--working-directory=' + str(work), '/usr/bin/env', '-i', *[k + '=' + v for k,v in env.items()], *command]
        run(*command, cwd=work, preexec_fn=drop, env=env)
        print('PROFILE_RUNTIME_ACCEPTED profile=' + profile + ' uid=' + str(uid) + ' HOME=/home/' + name + ' PATH=/usr/bin:/bin', flush=True)
    failures = list(rejected)
    def qualify(profiles):
        for name, uid in [('agent-a', 21001), ('agent-b', 21002)]:
            for profile in profiles:
                try:
                    qualify_one(name, uid, profile)
                except Exception:
                    failures.append(profile)
                    traceback.print_exc()
                    print('PROFILE_RUNTIME_UNAVAILABLE profile=' + profile + ' uid=' + str(uid) + ' reason=workflow_unqualified', flush=True)
    qualify([p for p in normal if p != 'core'])
    if (payloads / 'containers').exists():
        if 'containers' not in rejected:
            install_packages(payloads, ['containers'])
            qualify(['containers'])
    if failures:
        raise RuntimeError('profiles remain unqualified: ' + ','.join(sorted(set(failures))))
    print('PROFILE_RUNTIME_PASS', flush=True)


if __name__ == '__main__':
    proof(Path(sys.argv[1]))
