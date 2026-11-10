#!/usr/bin/env python3
"""The core runtime's headless shell and the browser profile's QA wheelhouse."""
import json
from pathlib import Path, PurePosixPath
import stat
import zipfile

# The headless shell is in every installation's core runtime, for the agents'
# page reader (Jari, 2026-11-10); the browser profile's Python Playwright uses
# the same shell, so its wheel must name the core lock's browser revision.
CORE_LOCK = Path(__file__).resolve().parent.parent / 'runtime/core/browser-lock.json'


def records_for(lock, target):
    if target not in ('linux-amd64', 'linux-arm64'):
        raise ValueError('unsupported target: ' + str(target))
    return [r for r in lock['inputs'] if r.get('target', target) == target]


# Chrome for Testing publishes no Linux arm64 build; Playwright's own arm64
# headless shell is laid out differently and carries no notice file.
EXECUTABLES = ('chrome-headless-shell', 'headless_shell', 'chrome_crashpad_handler')


def safe_members(z):
    names = z.namelist()
    if len(set(names)) != len(names):
        raise ValueError('duplicate ZIP member')
    for f in z.infolist():
        name = PurePosixPath(f.filename)
        if name.is_absolute() or '..' in name.parts or '\\' in f.filename or stat.S_ISLNK(f.external_attr >> 16):
            raise ValueError('unsafe ZIP member')
        if not f.is_dir():
            yield f, name


def shell_record(lock, target):
    browsers = [r for r in records_for(lock, target) if r['kind'] == 'browser']
    if len(browsers) != 1 or browsers[0]['name'] != 'chromium-headless-shell':
        raise ValueError('incomplete browser closure')
    return browsers[0]


def add_headless_shell(lock_path, inputs, put, components, digest, target):
    """Add the locked headless shell below runtime/browsers with its notice.

    `put(data, path, owner, mode)` writes one payload file."""
    lock = json.loads(lock_path.read_text())
    selected = records_for(lock, target)
    browser = shell_record(lock, target)
    if any(r['kind'] not in ('browser', 'notice') for r in selected):
        raise ValueError('unexpected browser input')
    # A notice record supplies the browser's licence from the same Chromium
    # version's official archive when the browser archive itself lacks one.
    notice = None
    for p in selected:
        if p['kind'] == 'notice':
            archive = inputs / p['filename']
            if notice is not None or archive.parent != inputs or digest(archive) != p['sha256'] or p['name'] != 'chromium-headless-shell-notice' or p['version'] != browser['version']:
                raise ValueError('browser notice input mismatch')
            with zipfile.ZipFile(archive) as z:
                notice = z.read(p['member'])
            if not notice.strip():
                raise ValueError('browser license_unverified: empty notice')
    archive = inputs / browser['filename']
    if archive.parent != inputs or digest(archive) != browser['sha256']:
        raise ValueError('browser input digest/location mismatch')
    base = 'runtime/browsers/chromium_headless_shell-' + browser['revision'] + '/'
    notices = []
    with zipfile.ZipFile(archive) as z:
        required = browser['prefix'] + '/LICENSE.headless_shell'
        names = z.namelist()
        if required not in names and notice is not None:
            put(notice, base + required, browser['name'], 0o644)
            notices.append(base + required)
        elif required not in names or not z.read(required).strip() or notice is not None:
            raise ValueError('browser license_unverified: ' + browser['name'])
        for f, name in safe_members(z):
            if name.parts[0] != browser['prefix']:
                raise ValueError('unexpected browser prefix')
            path = base + name.as_posix()
            put(z.read(f), path, browser['name'], 0o755 if name.name in EXECUTABLES else 0o644)
            if name.name in ('LICENSE.headless_shell', 'ABOUT'):
                notices.append(path)
    components.append(dict(name=browser['name'], version=browser['version'], kind='native', license_files=sorted(notices)))
    put(lock_path.read_bytes(), 'browser-lock.json', browser['name'], 0o644)
    return browser


def add_browser(lock_path, inputs, root, owners, components, digest, target, core_lock=CORE_LOCK):
    """The browser profile: Python Playwright's offline wheelhouse for QA."""
    lock = json.loads(lock_path.read_text())
    # Shared Debian notices come from the builder OS, not a downloaded tool.
    # Bind their exact bytes too: a non-Ubuntu builder must refuse, not silently
    # seal a different licence closure under the same input lock.
    common = {p.name: digest(p) for p in (root / 'licenses/common').iterdir() if p.is_file()}
    if not common or common != lock['common_license_sha256']:
        raise ValueError('builder common licence bytes differ from lock')
    records = records_for(lock, target)
    expected = {'playwright', 'greenlet', 'pyee', 'typing-extensions'}
    if {p['name'] for p in records} != expected or len(records) != len(expected) or any(p['kind'] != 'wheel' for p in records):
        raise ValueError('incomplete wheel closure')
    browser = shell_record(json.loads(core_lock.read_text()), target)

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
            for f, name in safe_members(z):
                if 'license' in f.filename.lower() or name.name in ('ThirdPartyNotices.txt', 'NOTICE'):
                    path = 'licenses/' + ident + '/' + name.as_posix()
                    if not z.read(f).strip():
                        raise ValueError('empty wheel notice')
                    put(z.read(f), path, ident)
                    notices.append(path)
            metadata = [n for n in z.namelist() if n.endswith('.dist-info/METADATA')]
            if len(metadata) != 1 or ('Version: ' + p['version'] + '\n').encode() not in z.read(metadata[0]):
                raise ValueError('wheel identity mismatch')
            put(archive.read_bytes(), 'qualification/wheels/' + p['filename'], ident)
            if ident == 'playwright':
                browsers = json.loads(z.read('playwright/driver/package/browsers.json'))['browsers']
                actual = next(v for v in browsers if v['name'] == 'chromium-headless-shell')
                if (actual['revision'], actual['browserVersion']) != (browser['revision'], browser['version']):
                    raise ValueError('Playwright/browser version mismatch')
        if not notices or any(not (root / n).read_bytes().strip() for n in notices):
            raise ValueError('browser license_unverified: ' + ident)
        components.append(dict(name=ident, version=p['version'], kind='native', license_files=sorted(notices)))
    put(lock_path.read_bytes(), 'browser-lock.json', 'playwright')
