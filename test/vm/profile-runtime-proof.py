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
    run('/usr/bin/apt-get', '-y', '--no-download', '--no-install-recommends', *options, 'install', *debs,
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
    for profile in normal:
        preflight(profile)
    container_error = None
    if (payloads / 'containers').exists():
        try:
            preflight('containers')
        except subprocess.CalledProcessError as error:
            container_error = error
            print('PROFILE_RUNTIME_UNAVAILABLE profile=containers reason=runtime_package_conflict', flush=True)
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
    scripts = {
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
podman info --format json > podman-info.json
podman unshare cat /proc/self/uid_map > uid-map.txt
python3 - <<'CONTAINER_PY'
import io,json,os,pathlib,subprocess,tarfile,time,urllib.request
with tarfile.open('image.tar','w') as t:
 p=pathlib.Path('/mnt/container-probe');i=t.gettarinfo(str(p),arcname='probe');i.uid=i.gid=0;i.mode=0o755
 with p.open('rb') as f:t.addfile(i,f)
subprocess.run(['podman','import','--change','CMD ["/probe"]','image.tar','localhost/runtime-fixture:locked'],check=True)
pathlib.Path('data').mkdir()
uid=os.getuid()
pathlib.Path('compose.yaml').write_text('services:\n  probe:\n    image: localhost/runtime-fixture:locked\n    userns_mode: keep-id\n    user: "'+str(uid)+':'+str(uid)+'"\n    mem_limit: 64m\n    ports: ["127.0.0.1:18990:8080"]\n    volumes: ["./data:/data"]\n')
try:
 subprocess.run(['podman-compose','-f','compose.yaml','up','-d'],check=True)
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
 subprocess.run(['podman-compose','-f','compose.yaml','down'],check=True)
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
    failures = []
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
        if container_error is None:
            install_packages(payloads, ['containers'])
            qualify(['containers'])
        else:
            failures.append('containers')
    if failures:
        raise RuntimeError('profiles remain unqualified: ' + ','.join(sorted(set(failures))))
    print('PROFILE_RUNTIME_PASS', flush=True)


if __name__ == '__main__':
    proof(Path(sys.argv[1]))
