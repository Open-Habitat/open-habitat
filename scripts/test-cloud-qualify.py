#!/usr/bin/env python3
"""Offline regressions for cloud-qualify.py: scripted fake SSH target and fake operator."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('cloud_qualify', HERE / 'cloud-qualify.py')
cq = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cq)

OWNER = '/opt/open-habitat/generations/' + 'e' * 64 + '/open-habitat'
UUID = '11111111-2222-4333-8444-555555555555'
# Ordinary OS tools a customer has on a stock image. Anything else executed on
# the target must be the delivered product binary or its staged owner.
OS_TOOLS = {'cloud-init', 'sh', 'test', 'env', 'uname', 'readlink', 'blkid', 'findmnt', 'find', 'modprobe',
            'mkfs.ext4', 'udevadm', 'systemctl', 'mount', 'install', 'sha256sum', 'python3', 'kill', 'cat'}


def package(root, version, binary):
    top = f'open-habitat-{version}-linux-amd64'
    path = root / f'{top}.tar.gz'
    with tarfile.open(path, 'w:gz') as tar:
        for name, data in ((f'{top}/bin/open-habitat', binary), (f'{top}/web/index.html', b'<!doctype html>')):
            info = tarfile.TarInfo(name)
            info.size, info.mode = len(data), 0o755
            tar.addfile(info, io.BytesIO(data))
    return top


def release(root, version, binary, predecessor=None):
    root.mkdir()
    top = package(root, version, binary)
    # Core bytes are shared across releases, as in a product-only successor.
    archives = {'core.tar.gz': b'core archive', 'editor.tar.gz': version.encode() + b'editor.tar.gz'}
    manifest = {'schema_version': 2, 'version': version, 'artifacts': [
        {'profile': name.split('.')[0], 'archive': name, 'sha256': hashlib.sha256(data).hexdigest()}
        for name, data in archives.items()]}
    if predecessor:
        manifest['upgrade'] = {'protocol': 1, 'predecessor': predecessor}
    (root / 'release.json').write_text(json.dumps(manifest))
    (root / 'release.sig').write_bytes(b's' * 64)
    for name, data in archives.items():
        (root / name).write_bytes(data)
    return top, {'version': version, 'manifest_sha256': hashlib.sha256((root / 'release.json').read_bytes()).hexdigest()}


class Lines:
    """Stream stdout; the fake commits the outcome only once it is read to the end."""

    def __init__(self, lines, commit):
        self.lines, self.commit = [line + '\n' for line in lines], commit

    def readline(self):
        return self.lines.pop(0) if self.lines else ''

    def __iter__(self):
        while self.lines:
            yield self.lines.pop(0)
        self.commit()

    def read(self):
        rest, self.lines = ''.join(self.lines), []
        return rest


class Proc:
    """Popen stand-in for a streamed remote operator: PID line, then JSONL events."""

    def __init__(self, lines, code, commit=lambda: None):
        self.stdout = Lines(lines, commit)
        self.stderr = io.StringIO('')
        self.code = code

    def kill(self):
        pass

    def wait(self):
        return self.code


class FakeTarget:
    def __init__(self, pred_top, succ_top, succ_binary_sha, **faults):
        self.pred = f'/opt/{pred_top}/bin/open-habitat'
        self.succ = f'/opt/{succ_top}/bin/open-habitat' if succ_top else None
        self.succ_sha = succ_binary_sha
        self.faults = faults
        self.files, self.calls, self.streams, self.kills, self.uploads = {}, [], [], [], []
        self.boot = 1
        self.fenced = self.applied = self.bound = self.granted = self.upgraded = False
        self.pid = 4000

    # transport API
    def put(self, source, remote, mode):
        self.files[remote] = (source if isinstance(source, bytes) else Path(source).read_bytes(), mode)
        self.uploads.append(remote)

    def sleep(self, seconds):
        pass

    def reachable(self):
        return subprocess.CompletedProcess([], 0, f'boot-{self.boot}\n', '')

    def run(self, argv, input=None, timeout=900, check=True):
        argv = list(argv)
        self.calls.append(argv)
        code, out, *err = self.answer(argv)
        if check and code != 0:
            raise cq.Failure('remote_command_failed', f'fake {argv[0]} exited {code}')
        return subprocess.CompletedProcess(argv, code, out, ''.join(err))

    def answer(self, a):
        joined = ' '.join(a)
        if a[0] == 'sh' and 'os-release' in a[2]:
            return 0, f'ubuntu 24.04\nx86_64\nsystemd\nboot-{self.boot}\n'
        if a[:2] == ['test', '-e']:
            if a[2] == '/var/run/reboot-required':
                return (0 if self.faults.get('reboot_required') and self.boot == 1 else 1), ''
            return 1, ''
        if a[0] == 'sh' and 'sources.list' in a[2]:
            return 0, 'Types: deb\nURIs: https://mirror.hetzner.com/ubuntu/packages\n'
        if a[0] == 'sh' and 'apt list' in a[2]:
            return 0, '7\n'
        if a[0] == 'readlink':
            return 0, '/dev/sdb\n'
        if a[:2] == ['blkid', '-p']:
            return (0 if self.faults.get('volume_signature') else 2), ''
        if a[:2] == ['blkid', '-s']:
            return 0, UUID + '\n'
        if a[0] == 'findmnt':
            return 1, ''
        if a[0] == 'sha256sum':
            if a[1] not in self.files:
                return 1, ''
            return 0, hashlib.sha256(self.files[a[1]][0]).hexdigest() + '  ' + a[1] + '\n'
        if a[0] == 'uname':
            return 0, '6.8.0-90-generic\n'
        if a[:2] == ['cat', '/proc/sys/kernel/random/boot_id']:
            return 0, f'boot-{self.boot}\n'
        if a[:2] == ['systemctl', 'reboot']:
            self.boot += 1
            return 255, ''
        if a[0] == 'kill':
            self.kills.append(a[2])
            return 0, ''
        if a[0] == 'python3':
            return 0, json.dumps(self.probe(a[2:])) + '\n'
        if a[0] in (self.pred, self.succ, OWNER):
            return self.product(a)
        if a[0] in OS_TOOLS:
            return 0, ''
        raise AssertionError('unexpected remote command ' + joined)

    def probe(self, a):
        if a[0] == 'ensure':
            self.bound = True
            return {'uid': 32000 if a[1] == '1001' else 32001, 'username': a[2]}
        if a[0] == 'agent':
            leak = self.faults.get('cross_uid') or (self.faults.get('cross_uid_after_boot') and self.boot > 1)
            return {'uid': 32000, 'own_uid_200': True, 'other_uid_denied': not leak}
        if a[0] == 'state':
            return {'sha256': 'f' * 64}
        if a[0] == 'gateway-exe':
            return {'pid': 77, 'sha256': self.succ_sha if self.upgraded else 'old'}
        return {'active': a[1:]}

    def product(self, a):
        if a[1:3] == ['host', 'config'] or a[1:3] == ['host', 'check'] or a[1:4] == ['admin', 'storage', 'update']:
            return 0, '{}'
        if a[1:4] == ['admin', 'storage', 'list']:
            users = [{'id': '1001', 'limit_bytes': cq.DEFAULT_LIMIT}, {'id': '1002', 'limit_bytes': cq.OVERRIDE_LIMIT}]
            return 0, json.dumps({'data': {'users': users}})
        kind = a[2]
        approvable = not (kind == 'prepare' and self.faults.get('prepare_blocked'))
        plan = {'plan_id': kind[0] * 64, 'approvable': approvable,
                'checks': [] if approvable else [{'id': 'storage.home', 'status': 'blocked'}]}
        if kind == 'upgrade':
            plan['owner_binary'] = OWNER
        if not approvable:
            return 1, '', json.dumps({'error': {'code': 'host_not_ready', 'result': {'data': {'plan': plan}}}})
        return 0, json.dumps({'data': {'plan': plan}})

    def stream(self, argv):
        self.pid += 1
        a = list(argv)
        self.streams.append(a)
        binary, kind, plan = a[0], a[2], a[a.index('--approved-plan') + 1]
        if plan == '0' * 64:
            return Proc([str(self.pid), json.dumps({'event': 'error', 'seq': 1, 'code': 'stale_plan'})], 1)
        phases = {'prepare': ['probe_armed', 'policy_installing'],
                  'apply': ['quiescing', 'staging', 'activating', 'converging', 'verifying', 'verified'],
                  'upgrade': ['quiescing', 'activating', 'verifying', 'verified']}[kind]
        events = [{'event': 'progress', 'phase': p} for p in phases]
        outcome, extra = None, {}
        if kind == 'prepare':
            outcome = 'prepared'
        elif kind == 'apply':
            if not self.applied:
                outcome, extra = 'applied', {'administrators': [{'subject': '1001', 'outcome': 'deferred_until_bound'}]}
            elif self.bound and not self.granted:
                outcome, extra = 'applied', {'administrators': [{'subject': '1001', 'outcome': 'granted'}]}
            else:
                outcome = 'no_change'
        elif binary != OWNER:
            outcome = 'staged'
        elif not self.upgraded:
            outcome = 'upgraded'
        else:
            outcome = 'no_change'
        events.append({'event': 'result', 'data': {'outcome': outcome, **extra}})
        for i, e in enumerate(events, 1):
            e['seq'] = i
        return Proc([str(self.pid), *map(json.dumps, events)], 0, lambda: self.commit(kind, binary, outcome))

    def commit(self, kind, binary, outcome):
        if kind == 'apply' and outcome == 'applied':
            if self.applied:
                self.granted = True
            self.applied = True
        if kind == 'upgrade' and outcome == 'upgraded':
            self.upgraded, self.fenced = True, False

    def https(self, host, name, cafile):
        if self.fenced:
            self.fenced_samples = getattr(self, 'fenced_samples', 0) + 1
            # A late-opening gateway: refused first, then serving.
            if self.faults.get('fence_leaks') and self.fenced_samples > 2:
                return 200
            return None if self.fenced_samples == 1 else 503
        return 200


class Harness(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir='/var/tmp')
        root = Path(self.tmp.name)
        self.pred_top, pred = release(root / 'pred', '0.1.0-q.1', b'old-binary')
        self.succ_top, _ = release(root / 'succ', '0.1.0-q.2', b'new-binary', predecessor=pred)
        self.key = root / 'release-key.pub'
        self.key.write_bytes(b'k' * 32)
        self.args = ['--predecessor', str(root / 'pred'), '--successor', str(root / 'succ'), '--release-key', str(self.key)]
        self.root = root

    def tearDown(self):
        self.tmp.cleanup()

    def spec(self, successor=True):
        ns = cq.parser().parse_args(['plan', *self.args[:2], *(self.args[2:4] if successor else []), *self.args[4:]])
        return cq.inputs(ns)

    def journey(self, successor=True, interrupt=True, **faults):
        spec = self.spec(successor)
        fake = FakeTarget(self.pred_top, self.succ_top if successor else None, spec['successor']['binary_sha256'] if successor else None, **faults)
        real_live = cq.Qualification.live
        def live(q, binary, kind, plan_id, interrupt_at=None):
            result = real_live(q, binary, kind, plan_id, interrupt_at)
            if interrupt_at == 'activating' and kind == 'upgrade':
                fake.fenced = True
            return result
        target = {'host': '203.0.113.7', 'port': 22, 'user': 'root', 'home_device': '/dev/disk/by-id/scsi-0HC_Volume_1',
                  'expect_apt_mirror': 'mirror.hetzner.com'}
        with mock.patch.object(cq.Qualification, 'live', live):
            q, failure = cq.qualify(spec, target, interrupt, transport=fake, https=fake.https, log=lambda e: None)
        return fake, q, failure, cq.receipt(spec, target, q, failure)

    def test_full_journey_uses_only_released_operator_and_threads_approvals(self):
        fake, q, failure, doc = self.journey()
        self.assertIsNone(failure, doc)
        self.assertEqual([s['name'] for s in doc['stages']], cq.stages(self.spec()))
        self.assertTrue(all(s['status'] == 'passed' for s in doc['stages']))
        products = {fake.pred, fake.succ, OWNER}
        for argv in fake.calls + fake.streams:
            self.assertTrue(argv[0] in OS_TOOLS or argv[0] in products, argv)
            self.assertFalse(any('fleetrepo' in str(x).lower() or str(HERE.parent) in str(x) for x in argv), argv)
        # Each approval is the plan ID the preceding dry run returned, and only
        # the matching explicit approval flags accompany it.
        live = [s for s in fake.streams if s[s.index('--approved-plan') + 1] != '0' * 64]
        for s in live:
            kind = s[2]
            self.assertEqual(s[s.index('--approved-plan') + 1], kind[0] * 64)
            self.assertEqual('--approve-disruption' in s, kind == 'prepare')
            self.assertEqual('--approve-maintenance' in s and '--approve-interruption' in s, kind == 'upgrade')
        upgrades = [s[0] for s in live if s[2] == 'upgrade']
        self.assertEqual(upgrades[0], fake.succ)
        self.assertTrue(all(b == OWNER for b in upgrades[1:]))
        self.assertEqual(len(fake.kills), 2)
        site = json.loads(fake.files[cq.SITE][0])
        self.assertEqual(site['gateway']['listen'], '0.0.0.0:443')
        self.assertEqual(site['storage']['home_uuid'], UUID)
        self.assertEqual(site['release']['version'], '0.1.0-q.2')
        # The fixture ships editor, so the site must declare its separate origin.
        # Identical core bytes are not sent twice; the changed editor archive is.
        self.assertEqual(fake.uploads.count(cq.INCOMING + '/core.tar.gz'), 1)
        self.assertEqual(fake.uploads.count(cq.INCOMING + '/editor.tar.gz'), 2)
        self.assertEqual(site['editor'], {'origin_template': 'https://*.code.qualification.invalid'})
        for path in (cq.SITE, cq.SECRETS + '/tls.key', cq.SECRETS + '/github'):
            self.assertEqual(fake.files[path][1], '0600')
        self.assertIn(['install', '-d', '-o', 'root', '-g', 'root', '-m', '0711', '/etc/open-habitat'], fake.calls)
        upgrade = next(s for s in doc['stages'] if s['name'] == 'upgrade')['observations']
        self.assertEqual(upgrade['fenced_public_statuses'], [503, None])
        self.assertTrue(any(c[:2] == ['systemctl', 'is-system-running'] for c in fake.calls))
        self.assertEqual(upgrade['gateway_exe_sha256'], self.spec()['successor']['binary_sha256'])

    def test_customer_reboot_after_security_updates(self):
        fake, q, failure, doc = self.journey(successor=False, interrupt=False, reboot_required=True)
        self.assertIsNone(failure)
        self.assertTrue(doc['stages'][1]['observations']['rebooted'])
        self.assertEqual(fake.kills, [])
        self.assertIn('upgrade (no successor release supplied)', doc['not_covered'])

    def test_open_entry_after_interrupted_upgrade_fails_and_stops(self):
        fake, q, failure, doc = self.journey(fence_leaks=True)
        self.assertEqual(failure.code, 'fenced_entry_open')
        self.assertEqual(doc['failed_stage'], 'upgrade')
        self.assertNotIn('reboot_upgraded', [s['name'] for s in doc['stages']])

    def test_blocked_preparation_never_approves(self):
        fake, q, failure, doc = self.journey(prepare_blocked=True)
        self.assertEqual(failure.code, 'prepare_not_approvable')
        self.assertEqual(doc['stages'][-1]['detail']['checks'][0]['id'], 'storage.home')
        self.assertEqual(fake.streams, [])

    def test_nonblank_home_volume_is_never_formatted(self):
        fake, q, failure, doc = self.journey(volume_signature=True)
        self.assertEqual(failure.code, 'home_volume_not_blank')
        self.assertFalse(any(c[0] == 'mkfs.ext4' for c in fake.calls))

    def test_cross_uid_agent_access_fails(self):
        fake, q, failure, doc = self.journey(cross_uid=True)
        self.assertEqual(failure.code, 'cross_uid_agent_reachable')
        fake, q, failure, doc = self.journey(cross_uid_after_boot=True)
        self.assertEqual((failure.code, doc['failed_stage']), ('cross_uid_agent_reachable', 'reboot_installed'))

    def test_ssh_pins_host_key_and_uses_sudo_for_nonroot(self):
        key = self.root / 'id'
        key.write_text('private')
        target = {'host': '203.0.113.7', 'port': 2222, 'user': 'ubuntu', 'identity_file': str(key),
                  'known_hosts': '203.0.113.7 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA', 'home_device': '/dev/sdb'}
        ssh = cq.SSH(target, self.root)
        argv = ssh.remote(['host', 'apply', "it's"])
        self.assertIn('StrictHostKeyChecking=yes', argv)
        self.assertIn('UserKnownHostsFile=' + str(self.root / 'known_hosts'), argv)
        self.assertEqual((self.root / 'known_hosts').read_text(), target['known_hosts'] + '\n')
        self.assertEqual(argv[-1], "sudo -n host apply 'it'\"'\"'s'")


class Commands(unittest.TestCase):
    def setUp(self):
        self.h = Harness('test_full_journey_uses_only_released_operator_and_threads_approvals')
        self.h.setUp()

    def tearDown(self):
        self.h.tearDown()

    def main(self, *argv, env=None):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err), mock.patch.dict(os.environ, env or {}):
            code = cq.main(list(argv))
        return code, out.getvalue(), err.getvalue()

    def test_plan_is_offline_and_rejects_foreign_successor(self):
        with mock.patch.object(cq.subprocess, 'run', side_effect=AssertionError('no process')), \
             mock.patch.object(cq.subprocess, 'Popen', side_effect=AssertionError('no process')):
            code, out, err = self.main('plan', *self.h.args, '--json')
        self.assertEqual(code, 0, err)
        data = json.loads(out)['data']
        self.assertEqual(data['stages'][-2:], ['upgrade', 'reboot_upgraded'])
        self.assertEqual(data['profiles'], ['core', 'editor'])
        manifest = self.h.root / 'succ' / 'release.json'
        doc = json.loads(manifest.read_text())
        doc['upgrade']['predecessor']['manifest_sha256'] = '0' * 64
        manifest.write_text(json.dumps(doc))
        code, out, err = self.main('plan', *self.h.args, '--json')
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(err)['error']['code'], 'successor_not_for_predecessor')

    def test_usage_errors_are_json(self):
        code, out, err = self.main('target', *self.h.args)
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(err)['error']['code'], 'usage_invalid')
        existing = self.h.root / 'receipt.json'
        existing.write_text('{}')
        code, out, err = self.main('target', *self.h.args, '--target', '/nonexistent', '--receipt', str(existing))
        self.assertEqual(json.loads(err)['error']['code'], 'receipt_exists')
        self.assertEqual(existing.read_text(), '{}')

    def test_run_without_operator_is_informative(self):
        code, out, err = self.main('run', *self.h.args, '--json', env={'PATH': str(self.h.root)})
        self.assertEqual(code, 1)
        error = json.loads(err)['error']
        self.assertEqual(error['code'], 'qualification_vm_operator_missing')
        self.assertIn('target --target', error['message'])

    def operator(self, destroy_code=0):
        log = self.h.root / 'operator.log'
        script = self.h.root / 'operator'
        script.write_text(f'''#!/usr/bin/env python3
import json, sys
open({str(log)!r}, 'a').write(json.dumps(sys.argv[1:]) + '\\n')
if sys.argv[1] == 'create':
    print(json.dumps({{'schema_version': 1, 'data': {{'run_id': sys.argv[3], 'ipv4': '203.0.113.9',
        'server': {{'id': 42, 'type': 'cx33', 'location': 'nbg1'}}, 'expires_at': '2026-01-01T03:00:00Z',
        'ssh': {{'port': 22, 'user': 'root', 'known_hosts': '203.0.113.9 ssh-ed25519 AAAA'}},
        'volume': {{'id': 7, 'device': '/dev/disk/by-id/scsi-0HC_Volume_7'}}}}}}))
elif {destroy_code} == 0:
    print(json.dumps({{'schema_version': 1, 'data': {{'run_id': sys.argv[3], 'deleted': ['server', 'volume'], 'remaining': []}}}}))
else:
    print(json.dumps({{'schema_version': 1, 'error': {{'code': 'api_unavailable', 'message': 'synthetic'}}}}), file=sys.stderr)
    sys.exit(1)
''')
        script.chmod(0o755)
        return script, log

    def calls(self, log):
        return [json.loads(line) for line in log.read_text().splitlines()]

    def test_run_destroys_after_failure_and_interrupt(self):
        script, log = self.operator()
        def failing(spec, target, interrupt):
            self.assertEqual(target['home_device'], '/dev/disk/by-id/scsi-0HC_Volume_7')
            self.assertEqual(target['expect_apt_mirror'], 'mirror.hetzner.com')
            q = cq.Qualification(spec, target, None, None, None)
            q.stages = [{'name': 'connect', 'status': 'failed', 'code': 'target_not_fresh'}]
            return q, cq.Failure('target_not_fresh', 'synthetic')
        with mock.patch.object(cq, 'qualify', failing):
            code, out, err = self.main('run', *self.h.args, '--operator', str(script), '--json')
        self.assertEqual(code, 1)
        data = json.loads(out)['data']
        self.assertEqual(data['status'], 'failed')
        create, destroy = self.calls(log)
        self.assertEqual(create[0], 'create')
        self.assertEqual(destroy[:3], ['destroy', '--run-id', create[2]])
        self.assertEqual(data['vm']['teardown']['remaining'], [])
        log.unlink()
        with mock.patch.object(cq, 'qualify', side_effect=KeyboardInterrupt):
            code, out, err = self.main('run', *self.h.args, '--operator', str(script), '--json')
        self.assertEqual(code, 130)
        self.assertEqual([c[0] for c in self.calls(log)], ['create', 'destroy'])

    def test_signal_during_teardown_waits_for_destroy(self):
        script, log = self.operator()
        # The operator itself sends SIGTERM to the harness mid-destroy, then
        # finishes deleting; the harness must let it complete before exiting.
        text = script.read_text().replace("elif {destroy_code} == 0:".format(destroy_code=0),
            "elif True:\n    import os, signal, time\n    os.kill(os.getppid(), signal.SIGTERM)\n    time.sleep(0.5)\n    open({!r}, 'a').write('finished\\n')\nif False:".format(str(log)))
        script.write_text(text)
        def passing(spec, target, interrupt):
            return cq.Qualification(spec, target, None, None, None), None
        with mock.patch.object(cq, 'qualify', passing):
            with self.assertRaises(SystemExit) as raised:
                self.main('run', *self.h.args, '--operator', str(script), '--json')
        self.assertEqual(raised.exception.code, 143)
        self.assertTrue(log.read_text().endswith('finished\n'))

    def test_failed_teardown_turns_pass_into_failure(self):
        script, log = self.operator(destroy_code=1)
        def passing(spec, target, interrupt):
            return cq.Qualification(spec, target, None, None, None), None
        with mock.patch.object(cq, 'qualify', passing):
            code, out, err = self.main('run', *self.h.args, '--operator', str(script), '--json')
        self.assertEqual(code, 1)
        data = json.loads(out)['data']
        self.assertEqual(data['status'], 'failed')
        self.assertTrue(data['vm']['teardown']['server_may_remain'])

    def test_remote_probe_compiles(self):
        compile(cq.PROBE, 'probe', 'exec')


if __name__ == '__main__':
    unittest.main()
