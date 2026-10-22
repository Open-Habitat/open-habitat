#!/usr/bin/env python3
"""Add version-matched headless assets and a tiny offline QA wheelhouse."""
import json
from pathlib import PurePosixPath
import stat
import zipfile


def add_browser(lock_path, inputs, root, owners, components, digest):
    lock = json.loads(lock_path.read_text())
    # Shared Debian notices come from the builder OS, not a downloaded tool.
    # Bind their exact bytes too: a non-Ubuntu builder must refuse, not silently
    # seal a different licence closure under the same input lock.
    common = {p.name: digest(p) for p in (root / 'licenses/common').iterdir() if p.is_file()}
    if not common or common != lock['common_license_sha256']:
        raise ValueError('builder common licence bytes differ from lock')
    records = lock['inputs']
    expected = {'playwright', 'greenlet', 'pyee', 'typing-extensions', 'chromium-headless-shell'}
    if {p['name'] for p in records} != expected or len(records) != len(expected):
        raise ValueError('incomplete browser/wheel closure')

    def put(data, path, owner, mode=0o644):
        if path in owners:
            raise ValueError('duplicate browser payload')
        dest = root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        dest.chmod(mode)
        owners[path] = owner

    for p in records:
        archive = inputs / p['filename']
        if archive.parent != inputs or digest(archive) != p['sha256']:
            raise ValueError('browser input digest/location mismatch')
        ident = p['name']
        notices = []
        with zipfile.ZipFile(archive) as z:
            names = z.namelist()
            if len(set(names)) != len(names):
                raise ValueError('duplicate ZIP member')
            required_notice = p.get('prefix', '') + '/LICENSE.headless_shell'
            if p['kind'] == 'browser' and (required_notice not in names or not z.read(required_notice).strip()):
                raise ValueError('browser license_unverified: ' + ident)
            for f in z.infolist():
                name = PurePosixPath(f.filename)
                if name.is_absolute() or '..' in name.parts or '\\' in f.filename or stat.S_ISLNK(f.external_attr >> 16):
                    raise ValueError('unsafe ZIP member')
                if f.is_dir():
                    continue
                if p['kind'] == 'browser':
                    if name.parts[0] != p['prefix']:
                        raise ValueError('unexpected browser prefix')
                    path = 'runtime/browsers/chromium_headless_shell-' + p['revision'] + '/' + name.as_posix()
                    mode = 0o755 if name.name in ('chrome-headless-shell', 'chrome_crashpad_handler') else 0o644
                    put(z.read(f), path, ident, mode)
                    if name.name in ('LICENSE.headless_shell', 'ABOUT'):
                        notices.append(path)
                elif 'license' in f.filename.lower() or name.name in ('ThirdPartyNotices.txt', 'NOTICE'):
                    path = 'licenses/' + ident + '/' + name.as_posix()
                    if not z.read(f).strip():
                        raise ValueError('empty wheel notice')
                    put(z.read(f), path, ident)
                    notices.append(path)
            if p['kind'] == 'wheel':
                metadata = [n for n in names if n.endswith('.dist-info/METADATA')]
                if len(metadata) != 1 or ('Version: ' + p['version'] + '\n').encode() not in z.read(metadata[0]):
                    raise ValueError('wheel identity mismatch')
                put(archive.read_bytes(), 'qualification/wheels/' + p['filename'], ident)
            if ident == 'playwright':
                browsers = json.loads(z.read('playwright/driver/package/browsers.json'))['browsers']
                browser = next(v for v in records if v['kind'] == 'browser')
                actual = next(v for v in browsers if v['name'] == 'chromium-headless-shell')
                if (actual['revision'], actual['browserVersion']) != (browser['revision'], browser['version']):
                    raise ValueError('Playwright/browser version mismatch')
        if not notices or any(not (root / n).read_bytes().strip() for n in notices):
            raise ValueError('browser license_unverified: ' + ident)
        components.append(dict(name=ident, version=p['version'], kind='native', license_files=sorted(notices)))
    put(lock_path.read_bytes(), 'browser-lock.json', 'chromium-headless-shell')
