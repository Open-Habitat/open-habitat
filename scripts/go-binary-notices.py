#!/usr/bin/env python3
"""Third-party notices for an upstream Go binary, bound to its module list.

A Go executable embeds the exact module versions and go.sum hashes it was
built from. `generate` downloads each of those modules through the Go
toolchain, which verifies them against the Go checksum database, and writes
their licence files into one notice. The notice starts with the module list
it was made for, so the runtime builder can refuse a binary whose embedded
list differs (`check`), and a lock update cannot ship stale notices.

    go-binary-notices.py generate --out NOTICE BINARY [BINARY...]
    go-binary-notices.py check NOTICE BINARY
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

MAGIC = b'\xff Go buildinf:'
LICENSE_FILE = re.compile(r'(?i)^(licen[cs]e|copying|notice|patents|unlicense)([._-].*)?$')
RULE = '=' * 72


def _varint(data, i):
    value = shift = 0
    while True:
        b = data[i]
        i += 1
        value |= (b & 0x7f) << shift
        if b < 0x80:
            return value, i
        shift += 7


def buildinfo(data):
    """The (go version, module info text) a Go 1.18+ binary embeds inline."""
    at = data.find(MAGIC)
    # Flag 2 is the inline-string form every Go 1.18+ toolchain writes; the
    # older pointer form would need the executable's section table.
    if at < 0 or data.find(MAGIC, at + 1) >= 0 or data[at + 15] & 2 == 0:
        raise ValueError('go_buildinfo_unreadable')
    i = at + 32
    n, i = _varint(data, i)
    version = data[i:i + n].decode()
    i += n
    n, i = _varint(data, i)
    mod = data[i:i + n]
    if len(mod) < 33 or mod[-17] != 0x0a:
        raise ValueError('go_buildinfo_unreadable')
    return version, mod[16:-16].decode()


def modules(data):
    """The canonical module block: the toolchain, the main module, then every
    dependency (and replacement) with its go.sum hash, in the binary's order."""
    version, info = buildinfo(data)
    lines = ['go ' + version]
    for line in info.splitlines():
        kind, _, rest = line.partition('\t')
        if kind in ('mod', 'dep', '=>'):
            lines.append(kind + ' ' + ' '.join(rest.split('\t')).strip())
    if not any(l.startswith('mod ') for l in lines):
        raise ValueError('go_buildinfo_unreadable')
    return '\n'.join(lines) + '\n'


def module_block(notice):
    head, sep, _ = notice.partition('\n' + RULE + '\n')
    marker = '\nmodules:\n'
    if not sep or marker not in head:
        raise ValueError('notice_unreadable')
    return head.split(marker, 1)[1].rstrip('\n') + '\n'


def check(notice, data):
    """Refuse a binary whose embedded modules are not the ones noticed."""
    if module_block(notice) != modules(data):
        raise ValueError('notice_module_mismatch')


def _download(go, env, path, version):
    out = subprocess.run([go, 'mod', 'download', '-json', path + '@' + version], env=env, capture_output=True, text=True, timeout=600)
    record = json.loads(out.stdout or '{}')
    if out.returncode or record.get('Error') or not record.get('Dir'):
        raise ValueError('module_download_failed: ' + path + '@' + version + ': ' + (record.get('Error') or out.stderr.strip()))
    return record


def _licences(directory, name):
    files = sorted(p for p in Path(directory).iterdir() if p.is_file() and LICENSE_FILE.match(p.name))
    if not files:
        raise ValueError('license_unverified: ' + name)
    return files


def generate(binaries, out):
    blocks = {modules(Path(b).read_bytes()) for b in binaries}
    if len(blocks) != 1:
        raise ValueError('binaries embed different modules')
    block = blocks.pop()
    lines = block.splitlines()
    main = lines[1].split()
    go = os.environ.get('GO', 'go')
    with tempfile.TemporaryDirectory(prefix='oh-go-notices-', dir='/var/tmp') as tmp:
        # A private module cache and the default proxy and checksum database:
        # nothing here trusts or changes the developer's Go setup.
        env = {'PATH': os.environ['PATH'], 'HOME': tmp, 'GOMODCACHE': tmp + '/mod', 'GOCACHE': tmp + '/cache', 'GOPATH': tmp + '/gopath',
               'GOFLAGS': '-mod=mod', 'GOTOOLCHAIN': 'local', 'GOPROXY': 'https://proxy.golang.org', 'GOSUMDB': 'sum.golang.org', 'GONOSUMDB': '', 'GOPRIVATE': '', 'GOINSECURE': ''}
        sections = []
        toolchain = lines[0].split()[1]
        # The standard library and runtime are linked in under Go's licence.
        record = _download(go, env, 'golang.org/toolchain', 'v0.0.1-' + toolchain + '.linux-amd64')
        sections.append((toolchain + ' (Go standard library and runtime)', _licences(record['Dir'], 'golang.org/toolchain')))
        record = _download(go, env, main[1], main[2])
        sections.append((main[1] + ' ' + main[2], _licences(record['Dir'], main[1])))
        effective = []
        for line in lines[2:]:
            fields = line.split()
            if fields[0] == '=>':
                effective[-1] = fields[1:]
            else:
                effective.append(fields[1:])
        for path, version, *sumhash in effective:
            if path.startswith(('.', '/')):
                raise ValueError('local replacement cannot be verified: ' + path)
            record = _download(go, env, path, version)
            if not sumhash or record.get('Sum') != sumhash[0]:
                raise ValueError('module_sum_mismatch: ' + path + '@' + version)
            sections.append((path + ' ' + version, _licences(record['Dir'], path)))
        text = [f'Third-party notices for {main[1]} {main[2]}, generated by scripts/go-binary-notices.py from the',
                'module list embedded in its release binaries. Every module was downloaded through',
                'the Go toolchain and verified against the Go checksum database.', '',
                # MPL-2.0 (and good practice) asks that recipients can obtain the source.
                'The source of each module below is available, unmodified, from the Go module',
                'proxy as https://proxy.golang.org/<module path>/@v/<version>.zip; the Go',
                'toolchain\'s from https://go.dev/dl/. Upstream: ' + main[1] + '.', '', 'modules:', block.rstrip('\n')]
        for title, files in sections:
            for f in files:
                text += [RULE, title + ': ' + f.name, RULE, f.read_text(errors='replace').rstrip('\n'), '']
        Path(out).write_text('\n'.join(text) + '\n')


if __name__ == '__main__':
    args = sys.argv[1:]
    if len(args) >= 4 and args[0] == 'generate' and args[1] == '--out':
        generate(args[3:], args[2])
    elif len(args) == 3 and args[0] == 'check':
        check(Path(args[1]).read_text(), Path(args[2]).read_bytes())
        print('ok')
    else:
        sys.exit(__doc__.split('\n\n')[-1])
