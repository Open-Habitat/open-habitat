#!/usr/bin/env python3
"""Check a built integrations archive without trusting its unpacked payload."""
import hashlib
import json
import importlib.util
import os
from pathlib import Path
import platform
import subprocess
import sys
import tarfile
import tempfile

out = Path(sys.argv[1]).resolve()
# A built or installed core runtime, used read-only; no ambient Pi or Node.
core_runtime = Path(sys.argv[2]).resolve()
pi_meta = json.loads((core_runtime / 'node_modules/@earendil-works/pi-coding-agent/package.json').read_text())
artifact = json.loads((out / 'artifact.json').read_text())
archive = out / artifact['archive']
assert artifact['profile'] == 'integrations' and artifact['requires'] == []
assert [p['name'] for p in artifact['packages']] == ['curl']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == artifact['sha256']
records = {f['path']: f for f in artifact['closure']['files']}
components = {c['name']: c for c in artifact['closure']['components']}
assert len(records) == artifact['entries']
with tempfile.TemporaryDirectory(prefix='oh-ms-package-', dir=os.environ.get('TMPDIR', '/var/tmp')) as directory:
    root = Path(directory)
    with tarfile.open(archive) as tar:
        seen = set()
        for member in tar:
            assert member.isfile() and member.name in records and member.name not in seen
            assert not member.name.startswith('/') and '..' not in Path(member.name).parts
            seen.add(member.name)
            record = records[member.name]
            data = tar.extractfile(member).read()
            assert hashlib.sha256(data).hexdigest() == record['sha256']
            assert member.mode == record['mode'] and member.mode in (0o644, 0o755)
            target = root / member.name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            target.chmod(member.mode)
        assert seen == records.keys()
    for name, component in components.items():
        text = ''.join(f['sha256'] + ' ' + f['path'] + '\n' for f in artifact['closure']['files'] if f['component'] == name)
        assert hashlib.sha256(text.encode()).hexdigest() == component['sha256']
        assert component['license_files']
        for name in component['license_files']:
            assert records[name]['component'] == component['name']
    lock = json.loads((root / 'runtime/package-lock.json').read_text())
    def matches(values, target):
        return not values or ('!' + target not in values and (all(v.startswith('!') for v in values) or target in values))
    applicable = {k: p['version'] for k, p in lock['packages'].items() if k and all(matches(p.get(key), value) for key, value in [('os', 'linux'), ('cpu', {'x86_64': 'x64', 'aarch64': 'arm64'}[platform.machine()]), ('libc', 'glibc')])}
    actual = {c['name'].removeprefix('npm:'): c['version'] for c in components.values() if c['kind'] == 'npm'}
    assert actual == applicable, 'complete npm closure required'
    assert actual['node_modules/@azure/msal-node'] == '5.6.0'
    assert actual['node_modules/@softeria/ms-365-mcp-server'] == '0.170.1'
    # The agent's file tools carry the scope patch the build applied.
    patch = json.loads((root / 'runtime/ms-365-mcp-server-scopes.json').read_text())
    endpoints = {e['toolName']: e for e in json.loads((root / 'runtime' / patch['package'] / patch['file']).read_text())}
    for name, change in patch['tools'].items():
        assert all(endpoints[name].get(k) == v for k, v in change['to'].items()), name
    runtime = root / 'runtime'
    pins = {'himalaya': '2.2.1', 'rclone': '1.71.2', 'gog': '0.39.1', 'tea': '0.16.0', 'glab': '1.124.0', 'sops': '3.13.3', 'tailscale': '1.104.4', 'tailscaled': '1.104.4'}
    for name, version in pins.items():
        assert components[name]['kind'] == 'native' and components[name]['version'] == version
        assert records['runtime/bin/' + name]['component'] == name and records['runtime/bin/' + name]['mode'] == 0o755
        assert all(f.startswith('licenses/' + name + '/') for f in components[name]['license_files'])
    # Each Go tool's notice covers every module its executable embeds.
    spec = importlib.util.spec_from_file_location('go_notices', Path(__file__).with_name('go-binary-notices.py'))
    go_notices = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(go_notices)
    for name in pins:
        data = (runtime / 'bin' / name).read_bytes()
        assert go_notices.is_go(data) == (name != 'himalaya'), name
        if name != 'himalaya':
            assert components[name]['license_files'] == ['licenses/' + name + '/THIRD-PARTY-NOTICES']
            go_notices.check((root / 'licenses' / name / 'THIRD-PARTY-NOTICES').read_text(), data)
    tool_env = {'HOME': str(root / 'home'), 'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'}
    (root / 'home').mkdir()
    for argv, expected in [(['himalaya', '--version'], 'v2.2.1'), (['rclone', 'version'], 'v1.71.2'), (['gog', '--version'], '0.39.1'), (['tea', '--version'], '0.16.0'), (['glab', '--version'], '1.124.0'), (['sops', '--disable-version-check', '--version'], '3.13.3'), (['tailscale', 'version'], '1.104.4'), (['tailscaled', '--version'], '1.104.4')]:
        out = subprocess.check_output([runtime / 'bin' / argv[0], *argv[1:]], env=tool_env, text=True, timeout=30)
        assert expected in out, (argv, out)
    # The Pi wrapper resolves core through the stable profile link, as host
    # apply publishes it, never through ambient node.
    gen = root / 'gen'
    (gen / 'payloads/integrations').mkdir(parents=True)
    (runtime).rename(gen / 'payloads/integrations/runtime')
    runtime = gen / 'payloads/integrations/runtime'
    core = gen / 'payloads/core/runtime'
    core.parent.mkdir(parents=True)
    core.symlink_to(core_runtime, target_is_directory=True)
    (root / 'profiles').mkdir()
    (root / 'profiles/integrations').symlink_to(runtime)
    pi = root / 'profiles/integrations/bin/pi'
    out = subprocess.check_output([pi, '--version'], env=tool_env, text=True, timeout=30)
    assert out.strip() == pi_meta['version'], out
    # Microsoft and tenant setup use add/remove; exit 0 without changing the
    # native file (the former library entry) must not count as success.
    subprocess.run([pi, 'mcp', 'add', 'fixture', '--env', 'FIXTURE=value with spaces', '--', '/bin/false', '--fixture'], env=tool_env, check=True, capture_output=True, timeout=30)
    config = root / 'home/.pi/agent/mcp.json'
    server = json.loads(config.read_text())['mcpServers']['fixture']
    assert server['command'] == '/bin/false' and server['args'] == ['--fixture']
    assert server['env'] == {'FIXTURE': 'value with spaces'}
    subprocess.run([pi, 'mcp', 'remove', 'fixture'], env=tool_env, check=True, capture_output=True, timeout=30)
    assert 'fixture' not in json.loads(config.read_text())['mcpServers']
    subprocess.run([pi, 'mcp', 'add', 'fixture', '--url', 'http://127.0.0.1:1/mcp'], env=tool_env, check=True, capture_output=True, timeout=30)
    auth = config.with_name('mcp-auth.json')
    auth.write_text(json.dumps({'mcp__fixture|http://127.0.0.1:1/mcp': {'tokens': {'access_token': 'synthetic'}}}))
    subprocess.run([pi, 'mcp', 'logout', 'fixture'], env=tool_env, check=True, capture_output=True, timeout=30)
    assert 'mcp__fixture|http://127.0.0.1:1/mcp' not in json.loads(auth.read_text())
    env = {'HOME': str(root / 'home'), 'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'MS365_MCP_USE_KEYTAR': 'false', 'MS365_MCP_TOKEN_CACHE_PATH': str(root / 'home/cache'), 'MS365_MCP_SELECTED_ACCOUNT_PATH': str(root / 'home/selected')}
    assert subprocess.check_output([runtime / 'bin/node', '--version'], env=env, text=True).strip() == 'v22.21.1'
    result = subprocess.run([runtime / 'bin/microsoft-native'], input='{}', text=True, env=env, capture_output=True, timeout=30)
    assert result.returncode == 1 and json.loads(result.stdout) == {'success': False, 'reason': 'native_failed'}
    accounts = subprocess.check_output([runtime / 'bin/ms-365-mcp-server', '--list-accounts'], env=env, text=True, stderr=subprocess.DEVNULL, timeout=30)
    assert json.loads(accounts)['accounts'] == []
print('PASS sealed native tools, Microsoft npm closure, notices, modes, wrappers and pinned interpreter')
