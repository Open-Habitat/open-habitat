#!/usr/bin/env python3
"""Report same-UID stray synthetic browser hosts; destruction requires --kill."""
import argparse
import json
import os
from pathlib import Path
import signal
import sys


def snapshot(pid):
    proc = Path('/proc') / str(pid)
    try:
        if proc.stat().st_uid != os.getuid():
            return None
        exe = os.readlink(proc / 'exe').removesuffix(' (deleted)')
        if not exe.endswith('/.cache/browser-host'):
            return None
        stat = (proc / 'stat').read_text().rsplit(')', 1)[1].split()
        if stat[0] in ('Z', 'X'):
            return None
        parent = int(stat[1])
        root = str(Path(exe).parent.parent)
        reasons = []
        if not Path(root).is_dir():
            reasons.append('worktree-missing')
        # Under hidepid=invisible a process we may not ptrace has no /proc
        # entry. The launcher of a synthetic host is our own test runner and
        # stays visible, so an invisible parent is the adopting reaper: init,
        # or a user manager made non-dumpable (Birch's, since 2026-10-30).
        try:
            parent_name = (Path('/proc') / str(parent) / 'comm').read_text().strip()
        except FileNotFoundError:
            parent_name = 'invisible' if parent > 0 else ''
        # lab.sh intentionally detaches from its launcher, but records the
        # caller shell as owner. Do not mistake a live owned lab for a stray.
        env = (proc / 'environ').read_bytes().split(b'\0')
        owner = next((v.split(b'=', 1)[1] for v in env
                      if v.startswith(b'BROWSER_HOST_OWNER_PID=')), None)
        owner_alive = False
        if owner and owner.isdigit() and int(owner) > 1:
            try:
                owner_stat = (Path('/proc') / owner.decode() / 'stat').read_text()
                owner_alive = owner_stat.rsplit(')', 1)[1].split()[0] not in ('Z', 'X')
            except FileNotFoundError:
                pass
            if not owner_alive:
                reasons.append('owner-missing')
        if (parent == 1 or parent_name in ('systemd', 'init', 'invisible')) and not owner_alive:
            reasons.append('parent-init-or-systemd')
        return dict(pid=pid, parent=parent, worktree=root,
                    starttime=stat[19], reasons=reasons)
    except (FileNotFoundError, ProcessLookupError, PermissionError):
        return None


def run(args):
    hosts = {}
    for entry in Path('/proc').iterdir():
        if entry.name.isdecimal():
            host = snapshot(int(entry.name))
            if host:
                hosts[host['pid']] = host
    # Include synthetic Pi belonging to an observed orphan, even before reparenting.
    changed = True
    while changed:
        changed = False
        for host in hosts.values():
            parent = hosts.get(host['parent'])
            if not host['reasons'] and parent and parent['reasons']:
                host['reasons'] = ['stray-host-child']
                changed = True
    rows = [h for h in hosts.values() if h['reasons'] and
            (args.pid is None or h['pid'] == args.pid)]
    for host in sorted(rows, key=lambda h: h['pid'], reverse=True):
        host['killed'] = False
        if args.kill:
            # A pidfd pins the target; a second snapshot fences exit/PID reuse
            # between discovery and opening the descriptor. Never kill a group
            # that might contain a developer's shell or unrelated agents.
            try:
                fd = os.pidfd_open(host['pid'])
                try:
                    current = snapshot(host['pid'])
                    if current and current['starttime'] == host['starttime']:
                        signal.pidfd_send_signal(fd, signal.SIGKILL)
                        host['killed'] = True
                finally:
                    os.close(fd)
            except ProcessLookupError:
                pass
    if args.json:
        print(json.dumps({'schema_version': 1, 'data': {'hosts': rows}}))
    else:
        for host in rows:
            print(f"{host['pid']} parent={host['parent']} {host['worktree']} "
                  f"{','.join(host['reasons'])}" + (' killed' if host['killed'] else ''))
        if not rows:
            print('No stray browser hosts.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--kill', action='store_true', help='SIGKILL reported hosts (default: report only)')
    parser.add_argument('--json', action='store_true', help='emit structured JSON')
    parser.add_argument('--pid', type=int, help='restrict report/cleanup to one positive PID')
    args = parser.parse_args()
    if args.pid is not None and args.pid <= 0:
        parser.error('--pid must be positive')
    try:
        run(args)
    except OSError as error:
        print(json.dumps({'error': {'code': 'host-inspection-failed', 'message': str(error)}}), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
