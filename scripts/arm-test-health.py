#!/usr/bin/env python3
"""Export ARM test health, never the native amd64 production gate receipt."""
import json
from pathlib import Path
import runpy
import subprocess


def write_health(repo):
    def git(*args):
        return subprocess.check_output(['git', '-C', str(repo), *args], text=True).strip()
    payload = {
        'schema_version': 1, 'status': 'passed', 'scope': 'native-arm-test-health',
        'platform': 'linux-arm64', 'production_release_gate': False,
        'source_commit': git('rev-parse', 'HEAD'), 'tree': git('rev-parse', 'HEAD^{tree}'),
        'source_clean': not bool(git('status', '--porcelain')),
        'native_amd64_packaging': 'not-run-requires-native-amd64-ci',
        'root_source_provenance': '/j/input-provenance.json (root runner receipt)',
    }
    output = repo / '.cache/arm-test-health/receipt.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + '\n')
    return payload


if __name__ == '__main__':
    repo = Path(__file__).resolve().parent.parent
    adapter = runpy.run_path(str(repo / 'scripts/browser-focused.py'))
    if adapter['placement'](repo, None) != 'guest':
        raise SystemExit('error: ARM test health requires verified guest placement')
    print(json.dumps({'schema_version': 1, 'data': write_health(repo), 'warnings': []}))
