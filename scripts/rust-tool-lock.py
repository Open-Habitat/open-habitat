#!/usr/bin/env python3
"""Write one core-runtime lock record for a released Rust command-line tool.

Maintainer tool, run when a pin moves: it reads the tool's published release
binaries for both targets, its LICENSE and Cargo.lock at the tag's commit, and
the SPDX licence every locked crate declares in its own published Cargo.toml.
The record goes into runtime/core/artifact-lock.json's "tools" list; the core
builder then checks the same bytes and licences again on every build.

usage: rust-tool-lock.py NAME OWNER/REPO TAG LINUX_AMD64_ASSET LINUX_ARM64_ASSET MEMBER_FORMAT
MEMBER_FORMAT names the binary inside each archive, with {asset_stem} for the
asset name without its archive suffix (e.g. '{asset_stem}/taskfleet' or 'workmux').
"""
import hashlib
import io
import json
import subprocess
import sys
import tarfile
import tomllib
import urllib.error
import urllib.request


def fetch(url):
    with urllib.request.urlopen(url, timeout=300) as r:
        return r.read()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def stem(asset):
    for suffix in ('.tar.xz', '.tar.gz', '.tgz'):
        if asset.endswith(suffix):
            return asset[:-len(suffix)]
    raise SystemExit('unsupported archive: ' + asset)


def main(name, repo, tag, amd64, arm64, member):
    commit = subprocess.run(['gh', 'api', f'repos/{repo}/commits/{tag}', '--jq', '.sha'], check=True, capture_output=True, text=True).stdout.strip()
    raw = f'https://raw.githubusercontent.com/{repo}/{commit}/'
    targets = {}
    for target, asset in (('linux-amd64', amd64), ('linux-arm64', arm64)):
        url = f'https://github.com/{repo}/releases/download/{tag}/{asset}'
        data = fetch(url)
        # cargo-dist names the checksum after the archive, workmux after its stem.
        try:
            published = fetch(url + '.sha256').decode().split()[0]
        except urllib.error.HTTPError:
            published = fetch(f'https://github.com/{repo}/releases/download/{tag}/{stem(asset)}.sha256').decode().split()[0]
        if published != sha(data):
            raise SystemExit('published checksum disagrees: ' + asset)
        targets[target] = dict(url=url, sha256=sha(data), member=member.format(asset_stem=stem(asset)))
    files = []
    for path in ('LICENSE', 'Cargo.lock'):
        data = fetch(raw + path)
        files.append(dict(filename=path, url=raw + path, sha256=sha(data)))
    cargo_lock = tomllib.loads(fetch(raw + 'Cargo.lock').decode())
    crates, git_crates = [], []
    for p in cargo_lock['package']:
        source = p.get('source', '')
        if source.startswith('registry+https://github.com/rust-lang/crates.io-index'):
            url = f"https://static.crates.io/crates/{p['name']}/{p['name']}-{p['version']}.crate"
            data = fetch(url)
            if sha(data) != p['checksum']:
                raise SystemExit('crate checksum disagrees: ' + p['name'])
            with tarfile.open(fileobj=io.BytesIO(data)) as tar:
                manifest = tomllib.loads(tar.extractfile(f"{p['name']}-{p['version']}/Cargo.toml").read().decode())
            crates.append(dict(name=p['name'], version=p['version'], license=manifest['package'].get('license', ''), sha256=p['checksum'], url=url))
        elif source.startswith('git+https://github.com/'):
            # A git dependency has no registry archive; its licence and manifest
            # are pinned at the locked commit.
            upstream, rev = source[len('git+https://github.com/'):].split('#')
            upstream = upstream.split('?')[0]
            base = f'https://raw.githubusercontent.com/{upstream}/{rev}/'
            manifest = tomllib.loads(fetch(base + 'Cargo.toml').decode())
            records = []
            for path in ('LICENSE', 'Cargo.toml'):
                records.append(dict(filename=path, url=base + path, sha256=sha(fetch(base + path))))
            git_crates.append(dict(name=p['name'], version=p['version'], source=source, license=manifest['package'].get('license', ''), files=records))
        elif source:
            raise SystemExit('unsupported crate source: ' + source)
    crates.sort(key=lambda c: (c['name'], c['version']))
    record = dict(name=name, version=tag.lstrip('v'), repository=repo, commit=commit, targets=targets, files=files, crates=crates, git_crates=git_crates)
    json.dump(record, sys.stdout, indent=2)
    print()


if __name__ == '__main__':
    if len(sys.argv) != 7:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
