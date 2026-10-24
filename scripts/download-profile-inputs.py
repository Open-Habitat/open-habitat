#!/usr/bin/env python3
"""Build-only fetch: exact URLs/digests, no solver or customer authorization."""
import concurrent.futures
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import urllib.request

spec = importlib.util.spec_from_file_location('profiles', Path(__file__).with_name('profile-runtime-build.py'))
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)


def fetch_inputs(lock_path, out, target):
    lock = json.loads(lock_path.read_text())
    if 'inputs' in lock:
        blobs = [(p['filename'], p) for p in profiles.for_target(lock['inputs'], target)]
    elif 'crates' in lock:
        blobs = [('uv.tar.gz', profiles.target_pin(lock, target)), ('source.tar.gz', lock['source'])]
        blobs += [(p['filename'], p) for p in lock['crates']]
    else:
        blobs = [('editor.tar.gz', profiles.target_pin(lock, target))]
    if len({name for name, _ in blobs}) != len(blobs):
        raise ValueError('duplicate input filename')

    def fetch(item):
        name, record = item
        if Path(name).name != name or not record['url'].startswith('https://'):
            raise ValueError('invalid locked artifact location')
        p = out / name
        for attempt in range(3):
            try:
                with urllib.request.urlopen(record['url'], timeout=90) as src, p.open('wb') as dest:
                    shutil.copyfileobj(src, dest)
                h = hashlib.sha256()
                with p.open('rb') as src:
                    for b in iter(lambda: src.read(1024 * 1024), b''):
                        h.update(b)
                if h.hexdigest() != record['sha256']:
                    raise ValueError('locked digest mismatch')
                return
            except Exception:
                p.unlink(missing_ok=True)
                if attempt == 2:
                    raise
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        list(executor.map(fetch, blobs))


if __name__ == '__main__':
    fetch_inputs(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
