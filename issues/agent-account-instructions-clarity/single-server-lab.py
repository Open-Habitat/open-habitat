#!/usr/bin/env python3
"""Networkless container lab. See result-single-server.md for invocation/limits.
Requires PI_RUNTIME, MS_RUNTIME, LAB_HOME (fresh private scratch), LAB_SOURCE.
Runs under container root; children use synthetic UID 1001, denial UID 1002.
"""
import ast
import concurrent.futures
import json
import os
from pathlib import Path
import select
import signal
import socket
import subprocess
import time
import urllib.error
import urllib.request

source = Path(os.environ['LAB_SOURCE'])
home = Path(os.environ['LAB_HOME'])
home.mkdir(mode=0o700)
os.chown(home, 1001, 1001)
node = os.environ['PI_RUNTIME'] + '/bin/node'
ms = os.environ['MS_RUNTIME']
# Read the mapping as data: importing the earlier script would launch servers.
tree = ast.parse((source / 'topic-areas.py').read_text())
areas = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'AREAS' for t in n.targets))
areas = {k: v.split() for k, v in areas.items()}
registered = sorted({n for names in areas.values() for n in names})
config = {'areas': areas, 'args': ['--org-mode', '--enabled-tools', '^(?:' + '|'.join(registered) + ')$', '--allowed-scopes', 'User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite Files.ReadWrite.All Sites.ReadWrite.All']}
(home / 'config.json').write_text(json.dumps(config))
os.chown(home / 'config.json', 1001, 1001)
env = dict(os.environ, HOME=str(home), TMPDIR=str(home), LAB_HOME=str(home), LAB_CONFIG=str(home / 'config.json'), LAB_RELAY=str(source / 'single-server-relay.py'),
           MS365_MCP_CLIENT_ID='00000000-0000-0000-0000-000000000001', MS365_MCP_TENANT_ID='11111111-1111-1111-1111-111111111111',
           MS365_MCP_USE_KEYTAR='false', MS365_MCP_TOKEN_CACHE_PATH=str(home / 'tokens.json'), MS365_MCP_SELECTED_ACCOUNT_PATH=str(home / 'selected.json'))
children = []
versions = {
    'pi': json.loads((Path(os.environ['PI_RUNTIME']) / 'node_modules/@earendil-works/pi-coding-agent/package.json').read_text())['version'],
    'microsoft': json.loads((Path(ms) / 'node_modules/@softeria/ms-365-mcp-server/package.json').read_text())['version'],
}
assert versions == {'pi': '1.5.2', 'microsoft': '0.170.1'}, versions
report = {'versions': versions, 'memory': []}

def start(args, label, extra=None):
    err = open(home / (label + '.err'), 'w')
    p = subprocess.Popen(['setpriv', '--reuid=1001', '--regid=1001', '--clear-groups', *args], env=dict(env, **(extra or {})), stdout=subprocess.PIPE, stderr=err, text=True, start_new_session=True)
    err.close()
    children.append(p)
    return p


def ready(p):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if select.select([p.stdout], [], [], 1)[0]:
            line = p.stdout.readline()
            if not line:
                raise RuntimeError('child exited: ' + str(p.poll()))
            try:
                value = json.loads(line)
            except ValueError:
                continue
            if value.get('ready'):
                return value
    raise TimeoutError('readiness')


def rss(pid):
    try:
        return int(next(l for l in Path(f'/proc/{pid}/status').read_text().splitlines() if l.startswith('VmRSS:')).split()[1])
    except (FileNotFoundError, StopIteration):
        return 0


def descendants(pid):
    result = []
    for path in Path('/proc').glob('[0-9]*/status'):
        try:
            parent = int(next(l for l in path.read_text().splitlines() if l.startswith('PPid:')).split()[1])
        except (FileNotFoundError, ProcessLookupError):
            continue
        if parent == pid:
            child = int(path.parent.name)
            result += [child] + descendants(child)
    return result


def rpc(port, method, auth=None):
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}
    if auth:
        headers['Authorization'] = auth
    body = {'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': {}}
    if method == 'initialize':
        body['params'] = {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'lab', 'version': '1'}}
    req = urllib.request.Request(f'http://127.0.0.1:{port}/mcp', json.dumps(body).encode(), headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def http_server(port, flags):
    p = start([ms + '/bin/ms-365-mcp-server', *config['args'], '--http', f'127.0.0.1:{port}', *flags], 'http-' + str(port))
    for _ in range(150):
        try:
            rpc(port, 'initialize')
            return p
        except urllib.error.URLError:
            time.sleep(.1)
    raise TimeoutError('HTTP startup')


try:
    # HTTP transport/auth/discovery, without making any Graph tool calls.
    http = http_server(18391, [])
    noauth = rpc(18391, 'initialize')
    bearer = rpc(18391, 'initialize', 'Bearer synthetic-not-a-graph-token')
    listing = rpc(18391, 'tools/list', 'Bearer synthetic-not-a-graph-token')
    assert noauth[0] == 401 and bearer[0] == 200 and listing[0] == 200
    report['http'] = {'noHeader': noauth[0], 'dummyBearerDiscovery': bearer[0],
                      'downloadToFile': 'download-bytes-to-file' in [t['name'] for t in listing[1]['result']['tools']]}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        replies = list(pool.map(lambda _: rpc(18391, 'tools/list', 'Bearer synthetic-not-a-graph-token'), range(15)))
    assert all(status == 200 for status, _ in replies)
    report['http']['concurrentListings'] = len(replies)
    pi_http_home = home / 'http-pi'; pi_http_home.mkdir(); os.chown(pi_http_home, 1001, 1001)
    pi_http = start([node, str(source / 'single-server-pi.mjs')], 'pi-http', {'HOME': str(pi_http_home), 'LAB_HTTP': 'http://127.0.0.1:18391/mcp'})
    report['http']['pi'] = ready(pi_http)
    pi_http.terminate(); pi_http.wait(timeout=15)
    http.terminate(); http.wait(timeout=15)
    trusted = http_server(18392, ['--trust-proxy-auth'])
    assert rpc(18392, 'initialize')[0] == 200
    report['http']['trustedNoHeader'] = 200
    trusted.terminate(); trusted.wait(timeout=15)
    incompatible = start([ms + '/bin/ms-365-mcp-server', *config['args'], '--http', '127.0.0.1:18393', '--trust-proxy-auth', '--http-local-file-tools'], 'http-incompatible')
    report['http']['localFilesWithCacheExit'] = incompatible.wait(timeout=15)
    assert report['http']['localFilesWithCacheExit'] != 0
    # One stdio upstream, five own-UID Unix endpoints, four actual Pi processes.
    mux = start([node, str(source / 'single-server-mux.mjs')], 'mux')
    ids = ready(mux)
    upstream_pid = ids['upstreamPid']
    assert upstream_pid
    foreign = subprocess.run(['setpriv', '--reuid=1002', '--regid=1002', '--clear-groups', '/usr/bin/python3', '-c',
        'import socket,sys; s=socket.socket(socket.AF_UNIX);\ntry: s.connect(sys.argv[1])\nexcept PermissionError: sys.exit(0)\nsys.exit(1)', str(home / 'files.sock')], timeout=5)
    assert foreign.returncode == 0
    report['foreignUidDenied'] = True
    clients = []
    for n in range(1, 5):
        pi_home = home / f'pi-{n}'; pi_home.mkdir(); os.chown(pi_home, 1001, 1001)
        p = start([node, str(source / 'single-server-pi.mjs')], f'pi-{n}', {'HOME': str(pi_home)})
        ready(p); clients.append(p)
        time.sleep(1)
        relays = [child for c in clients for child in descendants(c.pid)]
        report['memory'].append({'conversations': n, 'upstreamKiB': rss(upstream_pid), 'muxKiB': rss(mux.pid),
            'piKiB': sum(rss(c.pid) for c in clients), 'relayKiB': sum(rss(pid) for pid in relays), 'relays': len(relays)})
    # Correlated concurrent replies over one upstream; calls rejected before it.
    def unix_probe(area):
        s = socket.socket(socket.AF_UNIX); s.settimeout(15); s.connect(str(home / (area + '.sock')))
        f = s.makefile('rwb')
        def request(method, params, ident):
            f.write((json.dumps({'jsonrpc': '2.0', 'id': ident, 'method': method, 'params': params}) + '\n').encode()); f.flush()
            reply = json.loads(f.readline()); assert reply['id'] == ident
            return reply
        request('initialize', {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'lab', 'version': '1'}}, 1)
        result = request('tools/list', {}, 2)['result']
        assert {t['name'] for t in result['tools']} == set(areas[area])
        request('ping', {}, 3)
        bad = request('tools/call', {'name': 'delete-mail-folder', 'arguments': {}}, 4)
        assert bad['result']['isError']
        f.close(); s.close()
        return area
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        report['concurrentUnixProbes'] = len(list(pool.map(unix_probe, list(areas) * 4)))
    clients[0].terminate(); clients[0].wait(timeout=15)
    assert rss(upstream_pid) > 0
    report['survivesConversationClose'] = unix_probe('files') == 'files'
    print(json.dumps(report, indent=2), flush=True)
finally:
    for p in reversed(children):
        if p.poll() is None:
            p.terminate()
            try:
                p.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(p.pid, signal.SIGKILL); p.wait()
