#!/usr/bin/env python3
"""Write the signing inputs for a product-only successor of a published release.

A product-only successor reuses every runtime archive of its predecessor but
still needs its own signed manifest, because the upgrade authenticates the
exact predecessor and every successor product file. This reads the
predecessor's release directory and the successor's product package and writes
`artifacts.json` (the predecessor's descriptors, unchanged) and `upgrade.json`
(protocol 1, the predecessor's version, manifest and executable digests, and
every successor product file) into OUT, for
`runtime-release sign --platform PLATFORM --artifacts-file OUT/artifacts.json
--upgrade-file OUT/upgrade.json`, where PLATFORM is the predecessor's, printed
in the result: an upgrade never changes the host's architecture.
It signs nothing and never sees a key.
"""
import argparse
import hashlib
import json
import sys
import tarfile
from pathlib import Path


def package_files(path):
    """Product files the upgrade authenticates: the executable and the web assets."""
    files, top = [], None
    with tarfile.open(path, 'r:gz') as tar:
        for member in tar.getmembers():
            head, _, rel = member.name.partition('/')
            top = top or head
            if not member.isfile():
                continue
            if rel == 'bin/open-habitat':
                digest = hashlib.sha256(tar.extractfile(member).read()).hexdigest()
                files.append({'path': 'open-habitat', 'sha256': digest, 'mode': 0o755})
            elif rel.startswith('web/'):
                digest = hashlib.sha256(tar.extractfile(member).read()).hexdigest()
                files.append({'path': rel, 'sha256': digest, 'mode': 0o644})
    if not any(f['path'] == 'open-habitat' for f in files):
        sys.exit(f'error: {path} lacks bin/open-habitat')
    files.sort(key=lambda f: (f['path'] != 'open-habitat', f['path']))
    return files


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--predecessor', required=True, help='published release directory of the installed release')
    p.add_argument('--package', required=True, help="successor open-habitat-*-linux-<arch>.tar.gz for the predecessor's architecture")
    p.add_argument('--output', required=True, help='existing directory for artifacts.json and upgrade.json')
    args = p.parse_args(argv)
    pred, out = Path(args.predecessor), Path(args.output)
    raw = (pred / 'release.json').read_bytes()
    manifest = json.loads(raw)
    arch = manifest['platform'].removeprefix('ubuntu-24.04-')
    packages = sorted(pred.glob('open-habitat-*-linux-*.tar.gz'))
    if len(packages) != 1 or not packages[0].name.endswith('-linux-' + arch + '.tar.gz'):
        sys.exit(f'error: {pred} must hold exactly one product package for its platform {manifest["platform"]}')
    if not Path(args.package).name.endswith('-linux-' + arch + '.tar.gz'):
        sys.exit(f'error: the successor package must target the predecessor platform {manifest["platform"]}')
    previous = next(f for f in package_files(packages[0]) if f['path'] == 'open-habitat')
    upgrade = {'protocol': 1, 'predecessor_binary_sha256': previous['sha256'],
               'predecessor': {'version': manifest['version'], 'manifest_sha256': hashlib.sha256(raw).hexdigest()},
               'product': package_files(args.package)}
    for name, doc in (('artifacts.json', manifest['artifacts']), ('upgrade.json', upgrade)):
        with open(out / name, 'x') as f:
            json.dump(doc, f)
    print(json.dumps({'predecessor': upgrade['predecessor'], 'platform': manifest['platform'], 'product_files': len(upgrade['product'])}))


if __name__ == '__main__':
    main()
