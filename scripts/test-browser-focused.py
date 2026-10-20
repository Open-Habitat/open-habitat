#!/usr/bin/env python3
"""Cheap policy/client fixtures: no npm, Go, SSH, systemd or browser execution."""
import contextlib
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
loader = importlib.util.spec_from_file_location('browser_focused', ROOT / 'scripts/browser-focused.py')
adapter = importlib.util.module_from_spec(loader)
loader.loader.exec_module(adapter)

FAKE = r'''#!/usr/bin/env python3
import hashlib, json, os, pathlib, sys, time
argv=sys.argv[1:]; command=argv[0]
p=pathlib.Path(os.environ['FAKE_CALLS'])
with p.open('a') as f: f.write(json.dumps(argv)+'\n')
if os.environ.get('FAKE_FAIL') == command:
    print('offline',file=sys.stderr); sys.exit(2)
job=os.environ['FAKE_ID']
if command=='create':
    job=hashlib.sha256(argv[argv.index('--idempotency-key')+1].encode()).hexdigest()
    data={'id':job,'manifest':{'files':['large-manifest-sentinel']}}
elif command in ('show','wait'):
    if command=='show' and os.environ.get('FAKE_SIGNAL'):
        import signal
        os.kill(os.getppid(),signal.SIGINT); time.sleep(2)
    states=json.loads(os.environ.get('FAKE_STATES','["success"]'))
    n=sum(json.loads(line)[0]=='show' for line in p.read_text().splitlines())-1
    if command=='wait': time.sleep(float(os.environ.get('FAKE_DELAY','0')))
    data={'id':job,'state':states[min(n,len(states)-1)],'snapshot_sha256':'immutable-id','stale':False}
elif command=='logs': data={'logs':{'stdout':'log-tail-marker '+ 'x'*100000}}
elif command=='fetch':
    target=pathlib.Path(argv[argv.index('--output')+1]);target.mkdir()
    data={'id':job,'output':str(target)}
elif command=='cancel': data={'id':job,'state':'cancelled'}
else: sys.exit(3)
print(json.dumps({'schema_version':1,'data':data,'warnings':[]}))
'''


class GuestPolicy(unittest.TestCase):
    def setUp(self):
        self.facts = dict(system='Linux', machine='aarch64', user='hbjob', repo='/j/src', trusted_files=True,
                          installed_marker=True,
                          task={'task': 'oh-browser', 'spec': 'one.spec.ts', 'profile': 'oh-linux-arm64-v1', 'workers': 2},
                          cgroup='0::/system.slice/hb-exec-job-'+'b'*64+'.service\n')

    def test_actual_task_shape_admitted(self):
        self.assertTrue(adapter.guest_facts_valid(self.facts, 'one.spec.ts'))

    def test_each_missing_fact_denies(self):
        for field, bad in dict(system='Darwin', machine='x86_64', user='jdoe', repo='/outside', trusted_files=False,
                               installed_marker=False, task={}, cgroup='0::/user.slice/agent.service').items():
            with self.subTest(field=field):
                facts = copy.deepcopy(self.facts); facts[field] = bad
                self.assertFalse(adapter.guest_facts_valid(facts, 'one.spec.ts'))
        self.assertFalse(adapter.guest_facts_valid(self.facts, 'other.spec.ts'))

    def test_forged_env_on_haapa_never_admits_guest(self):
        facts = os.uname_result(('Linux', 'alder', 'fixture', 'fixture', 'aarch64'))
        with patch.object(adapter.os, 'uname', return_value=facts), patch.dict(os.environ, {'HB_EXEC_CONTEXT':'guest-v1'}):
            self.assertEqual(adapter.placement(Path('/j/src'), 'one.spec.ts'), 'remote')

    def test_unrelated_linux_local_without_private_runner(self):
        facts = type('U', (), {'nodename':'example-ci', 'machine':'x86_64', 'sysname':'Linux'})()
        with patch.object(adapter.os, 'uname', return_value=facts), patch.dict(os.environ, {}, clear=True):
            self.assertEqual(adapter.placement(ROOT, None), 'local')

    def test_forged_guest_off_haapa_denied(self):
        facts = type('U', (), {'nodename':'example-ci', 'machine':'aarch64', 'sysname':'Linux'})()
        with patch.object(adapter.os, 'uname', return_value=facts), patch.dict(os.environ, {'HB_EXEC_CONTEXT':'guest-v1'}), patch.object(adapter, 'trusted_marker', side_effect=ValueError('untrusted')):
            with self.assertRaises(ValueError): adapter.placement(ROOT, 'one.spec.ts')

    def test_private_installed_marker_does_not_need_read_permission(self):
        info=type('Info',(),dict(st_uid=0,st_mode=0o100600))()
        with patch.object(Path,'lstat',return_value=info),patch.object(Path,'read_text',side_effect=PermissionError):
            self.assertTrue(adapter.trusted_marker(Path('/opt/fixture/installed.json')))

    def test_writable_or_symlink_receipt_denied(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as tmp:
            p = Path(tmp)/'receipt';p.write_text('{}');p.chmod(0o666)
            with self.assertRaises(ValueError): adapter.trusted_json(p)
            link=Path(tmp)/'link';link.symlink_to(p)
            with self.assertRaises((ValueError, OSError)): adapter.trusted_json(link)


class Client(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='oh-adapter-test-', dir='/var/tmp')
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        (self.root/'scripts').mkdir();(self.root/'web/tests').mkdir(parents=True)
        for file in ('test-focused.sh','browser-focused.py','ci-local.sh'):
            shutil.copy(ROOT/'scripts'/file,self.root/'scripts'/file)
        shutil.copy(ROOT/'web/package.json',self.root/'web/package.json')
        (self.root/'web/tests/one.spec.ts').write_text('fixture')
        (self.root/'web/tests/lab-one.spec.ts').write_text('fixture')
        (self.root/'web/tests/synthetic-demo.spec.ts').write_text('fixture')
        subprocess.run(['git','init','-q',str(self.root)],check=True)
        subprocess.run(['git','-C',str(self.root),'add','.'],check=True)
        self.bin=self.root/'bin';self.bin.mkdir()
        # Patch kernel facts only in this test launcher, not via a production environment bypass.
        launcher=self.bin/'python3'
        launcher.write_text(f'#!{sys.executable}\nimport os,runpy,sys\nos.uname=lambda: os.uname_result(("Linux","alder","fixture","fixture","x86_64"))\nscript=sys.argv.pop(1)\nrunpy.run_path(script,run_name="__main__")\n')
        launcher.chmod(0o755)
        fake=self.bin/'fleetrepo-exec';fake.write_text(FAKE);fake.chmod(0o755)
        self.calls=self.root/'calls'
        self.env={**os.environ,'PATH':str(self.bin)+':'+os.environ['PATH'], 'FAKE_CALLS':str(self.calls),
                  'FAKE_ID':hashlib.sha256(b'fixture-key').hexdigest()}
        self.env.pop('HB_EXEC_CONTEXT', None)
        self.captured_dirs=[]
        self.addCleanup(lambda: [shutil.rmtree(p,ignore_errors=True) for p in self.captured_dirs])

    def run_script(self, *options, **env):
        proc=subprocess.run(['bash',str(self.root/'scripts/test-focused.sh'),'--area','browser',*options],
                            env={**self.env,**env},text=True,capture_output=True,timeout=10)
        for line in proc.stdout.splitlines():
            if line.startswith('Runner responses: '): self.captured_dirs.append(line.split(': ',1)[1])
        return proc

    def normal(self, **env):
        return self.run_script('--spec','one.spec.ts','--writers-paused','--idempotency-key','fixture-key',**env)

    def argv(self):
        return [json.loads(line) for line in self.calls.read_text().splitlines()] if self.calls.exists() else []

    def test_exact_create_and_no_local_dependencies(self):
        p=self.normal();self.assertEqual(p.returncode,0,p.stderr)
        self.assertEqual(self.argv()[0],['create','--source',str(self.root),'--task','oh-browser','--spec','one.spec.ts','--idempotency-key','fixture-key','--writers-paused','--json'])
        self.assertIn('immutable-id',p.stdout);self.assertNotIn('large-manifest-sentinel',p.stdout)
        self.assertIn('log-tail-marker',p.stdout);self.assertLess(len(p.stdout),20000)
        fetch=next(a for a in self.argv() if a[0]=='fetch')
        target=Path(fetch[fetch.index('--output')+1]);self.assertFalse(target.is_relative_to(self.root))
        self.assertIn(self.env['FAKE_ID'],target.name)
        self.assertEqual((self.root/'web/tests/one.spec.ts').read_text(),'fixture')

    def test_validation_refuses_before_runner(self):
        for opts in [[],['--spec','../one.spec.ts'],['--spec','absent.spec.ts'],['--spec','lab-one.spec.ts','--writers-paused'],
                     ['--spec','synthetic-demo.spec.ts','--writers-paused'],['--spec','one.spec.ts','--tag','@a11y','--writers-paused'],
                     ['--spec','one.spec.ts'],['--spec','one.spec.ts','--config','other'],['--spec','one.spec.ts','--tag','','--writers-paused'],['--spec','one.spec.ts','--wait-timeout','0'],
                     ['--spec','one.spec.ts','--job','bad'],['--spec','one.spec.ts','--writers-paused','--idempotency-key','']]:
            with self.subTest(opts=opts): self.assertNotEqual(self.run_script(*opts).returncode,0)
        self.assertEqual(self.argv(),[])

    def test_new_spec_requires_selection_and_forwards_multiple(self):
        (self.root/'web/tests/new.spec.ts').write_text('new')
        denied=self.run_script('--spec','new.spec.ts','--writers-paused');self.assertNotEqual(denied.returncode,0)
        self.assertIn('explicitly select',denied.stderr)
        p=self.run_script('--spec','new.spec.ts','--writers-paused','--idempotency-key','fixture-key',
                          '--untracked','web/tests/new.spec.ts','--untracked','new-input.txt')
        self.assertEqual(p.returncode,0,p.stderr)
        self.assertEqual(self.argv()[0][-5:],['--untracked','web/tests/new.spec.ts','--untracked','new-input.txt','--json'])

    def test_api_success_not_test_success(self):
        for state in sorted(adapter.TERMINAL-{'success'}):
            with self.subTest(state=state): self.assertEqual(self.normal(FAKE_STATES=json.dumps([state])).returncode,1)

    def test_queued_running_waits_same_job(self):
        p=self.normal(FAKE_STATES='["queued","running","success"]')
        self.assertEqual(p.returncode,0,p.stderr)
        calls=self.argv();self.assertEqual(sum(a[0]=='create' for a in calls),1)
        self.assertEqual(sum(a[0]=='wait' for a in calls),2)
        self.assertTrue(all(a[1]==self.env['FAKE_ID'] for a in calls if a[0] in ('wait','show')))

    def test_unknown_or_unrecognized_never_success(self):
        for state in ('unknown','absent','future-state'):
            with self.subTest(state=state): self.assertNotEqual(self.normal(FAKE_STATES=json.dumps([state])).returncode,0)
        self.assertFalse(any(a[0]=='fetch' for a in self.argv()))

    def test_observer_timeout_retains_job(self):
        p=self.run_script('--spec','one.spec.ts','--writers-paused','--idempotency-key','fixture-key','--wait-timeout','1',
                          FAKE_STATES='["running"]',FAKE_DELAY='1')
        self.assertNotEqual(p.returncode,0);self.assertIn('reconnect with --job',p.stderr)
        self.assertFalse(any(a[0]=='cancel' for a in self.argv()))

    def test_transport_failure_never_falls_back(self):
        for command in ('create','show','wait','logs','fetch'):
            with self.subTest(command=command):
                self.calls.unlink(missing_ok=True)
                p=self.normal(FAKE_FAIL=command,FAKE_STATES='["queued","success"]')
                self.assertNotEqual(p.returncode,0);self.assertIn('offline',p.stderr)

    def test_missing_runner_never_falls_back(self):
        (self.bin/'fleetrepo-exec').unlink()
        p=self.normal();self.assertNotEqual(p.returncode,0);self.assertIn('fleetrepo-exec',p.stderr)

    def test_reconnect_never_creates(self):
        p=self.run_script('--spec','one.spec.ts','--job',self.env['FAKE_ID'])
        self.assertEqual(p.returncode,0,p.stderr);self.assertNotIn('create',[a[0] for a in self.argv()])

    def test_npm_no_spec_explicit_refusal_without_node_modules(self):
        p=subprocess.run(['npm','run','test:browser','--prefix',str(self.root/'web')],env=self.env,text=True,capture_output=True,timeout=10)
        self.assertNotEqual(p.returncode,0);self.assertIn('no-spec',p.stderr);self.assertEqual(self.argv(),[])

    def test_other_area_preserved(self):
        fake=self.bin/'go';fake.write_text('#!/bin/sh\nprintf "%s\\n" "$@"\n');fake.chmod(0o755)
        p=subprocess.run(['bash',str(self.root/'scripts/test-focused.sh'),'--area','go','--go-package','./internal/example'],env=self.env,text=True,capture_output=True)
        self.assertEqual(p.returncode,0,p.stderr);self.assertEqual(p.stdout.splitlines(),['test','-race','-count=1','./internal/example'])
        self.assertEqual(self.argv(),[])

    def test_full_gate_preflight_refuses_on_haapa(self):
        p=subprocess.run(['bash',str(self.root/'scripts/ci-local.sh'),'--clean','--json'],env=self.env,text=True,capture_output=True)
        self.assertNotEqual(p.returncode,0);self.assertIn('full gate unsupported',p.stderr)

    def test_real_int_reaches_fake_remote_cancel(self):
        p=self.normal(FAKE_SIGNAL='1')
        self.assertEqual(p.returncode,130,p.stderr)
        self.assertIn(['cancel',self.env['FAKE_ID'],'--json'],self.argv())

    def test_explicit_signal_cancels_same_job(self):
        # Deterministic handler exercise, without racing a background job or killing this test process.
        args=type('Args',(),dict(spec='one.spec.ts',tag=None,job=self.env['FAKE_ID'],writers_paused=False,
                               untracked=[],idempotency_key=None,wait_timeout=10))()
        events=[]
        def call(_self,*argv):
            events.append(argv)
            if argv[0]=='show': raise adapter.Cancelled(signal.SIGINT)
            return {'id':self.env['FAKE_ID'],'state':'cancelled'}
        capture=io.StringIO()
        with patch.object(adapter.Runner,'call',call),contextlib.redirect_stdout(capture):
            self.assertEqual(adapter.remote(self.root,args),130)
        self.captured_dirs.append(capture.getvalue().split('Runner responses: ',1)[1].splitlines()[0])
        self.assertEqual(events[-1],('cancel',self.env['FAKE_ID']))

    def test_ordinary_local_full_tag_and_lab_are_preserved(self):
        with patch.object(adapter,'__file__',str(self.root/'scripts/browser-focused.py')),patch.object(adapter,'placement',return_value='local'),patch.object(adapter.subprocess,'call',return_value=0) as execute:
            (self.root/'web/node_modules/.bin').mkdir(parents=True)
            (self.root/'web/node_modules/.bin/playwright').touch()
            self.assertEqual(adapter.main([]),0)
            self.assertEqual(execute.call_args.args[0],['npx','playwright','test'])
            self.assertEqual(adapter.main(['--spec','lab-one.spec.ts','--tag','@fixture']),0)
            self.assertEqual(execute.call_args.args[0],['npx','playwright','test','--config','playwright.lab.config.ts','tests/lab-one.spec.ts','--grep','@fixture'])
        self.assertEqual(self.argv(),[])

    def test_guest_executes_once_no_create(self):
        with patch.object(adapter,'__file__',str(self.root/'scripts/browser-focused.py')),patch.object(adapter,'placement',return_value='guest'),patch.object(adapter.subprocess,'call',return_value=7) as execute:
            (self.root/'web/node_modules/.bin').mkdir(parents=True)
            (self.root/'web/node_modules/.bin/playwright').touch()
            self.assertEqual(adapter.main(['--spec','one.spec.ts']),7)
            execute.assert_called_once_with(['npx','playwright','test','tests/one.spec.ts'],cwd=self.root/'web')
        self.assertEqual(self.argv(),[])


if __name__=='__main__':
    unittest.main()
