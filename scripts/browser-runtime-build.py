#!/usr/bin/env python3
"""Add version-matched headless assets and a tiny offline QA wheelhouse."""
import json
from pathlib import PurePosixPath
import stat
import zipfile


def records_for(lock, target):
    if target not in ('linux-amd64', 'linux-arm64'):
        raise ValueError('unsupported target: ' + str(target))
    return [r for r in lock['inputs'] if r.get('target', target) == target]


# Chrome for Testing publishes no Linux arm64 build; Playwright's own arm64
# headless shell is laid out differently and carries no notice file.
EXECUTABLES = ('chrome-headless-shell', 'headless_shell', 'chrome_crashpad_handler')


def add_browser(lock_path, inputs, root, owners, components, digest, target):
    lock = json.loads(lock_path.read_text())
    # Shared Debian notices come from the builder OS, not a downloaded tool.
    # Bind their exact bytes too: a non-Ubuntu builder must refuse, not silently
    # seal a different licence closure under the same input lock.
    common = {p.name: digest(p) for p in (root / 'licenses/common').iterdir() if p.is_file()}
    if not common or common != lock['common_license_sha256']:
        raise ValueError('builder common licence bytes differ from lock')
    # A notice record supplies the browser's licence from the same Chromium
    # version's official archive when the browser archive itself lacks one.
    selected = records_for(lock, target)
    records = [p for p in selected if p['kind'] != 'notice']
    expected = {'playwright', 'greenlet', 'pyee', 'typing-extensions', 'chromium-headless-shell'}
    if {p['name'] for p in records} != expected or len(records) != len(expected):
        raise ValueError('incomplete browser/wheel closure')
    notice = None
    for p in selected:
        if p['kind'] == 'notice':
            archive = inputs / p['filename']
            browser = next(r for r in records if r['kind'] == 'browser')
            if notice is not None or archive.parent != inputs or digest(archive) != p['sha256'] or p['name'] != 'chromium-headless-shell-notice' or p['version'] != browser['version']:
                raise ValueError('browser notice input mismatch')
            with zipfile.ZipFile(archive) as z:
                notice = z.read(p['member'])
            if not notice.strip():
                raise ValueError('browser license_unverified: empty notice')

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
            if p['kind'] == 'browser' and required_notice not in names and notice is not None:
                path = 'runtime/browsers/chromium_headless_shell-' + p['revision'] + '/' + required_notice
                put(notice, path, ident)
                notices.append(path)
            elif p['kind'] == 'browser' and (required_notice not in names or not z.read(required_notice).strip() or notice is not None):
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
                    mode = 0o755 if name.name in EXECUTABLES else 0o644
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
