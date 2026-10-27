#!/usr/bin/env python3
"""Run a command while holding the host-wide whole-browser-suite lock.

Two concurrent whole suites (each with its own Chromes and synthetic hosts)
saturate an 8-vCPU host for far longer than running them one after the other,
and slow every other worker and the live product with them. A whole-suite run
therefore waits here for any other one on the same host. Focused runs of named
specs or tags do not take the lock.

The lock is flock(2) on a shared /var/tmp file, so the kernel releases it when
the holder dies, however it dies. The descriptor is close-on-exec: the suite's
children (browsers, synthetic hosts) never inherit it, so a leaked child cannot
keep the lock held after this wrapper is gone.
"""
import argparse
import fcntl
import os
import signal
import subprocess
import sys
import time

DEFAULT_LOCK = '/var/tmp/open-habitat-browser-suite.lock'
POLL_SECONDS = 2


def open_lock(path):
    # Another user's existing file in sticky /var/tmp refuses O_CREAT
    # (fs.protected_regular), so open an existing file without it first.
    # Read-only is enough for flock; it only loses the holder description.
    for flags in (os.O_RDWR, os.O_RDONLY):
        try:
            return os.open(path, flags | os.O_NOFOLLOW | os.O_CLOEXEC), flags == os.O_RDWR
        except FileNotFoundError:
            break
        except PermissionError:
            continue
    fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_CLOEXEC, 0o644)
    os.fchmod(fd, 0o644)  # the caller's umask 077 would hide the holder from others
    return fd, True


def holder(fd):
    try:
        return os.pread(fd, 4096, 0).decode(errors='replace').strip() or 'an unknown run'
    except OSError:
        return 'an unknown run'


def acquire(fd, status):
    seen = None
    started = time.monotonic()
    while True:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if seen is not None:
                print(f'browser suite lock acquired after {time.monotonic() - started:.0f}s',
                      file=status, flush=True)
            return
        except BlockingIOError:
            pass
        current = holder(fd)
        if current != seen:
            print(f'waiting for browser suite lock held by {current}', file=status, flush=True)
            seen = current
        time.sleep(POLL_SECONDS)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--label', default=os.getcwd(),
                        help='who holds the lock, shown to waiters (default: working directory)')
    parser.add_argument('--status-fd', type=int, default=2,
                        help='descriptor for waiting messages (default: stderr)')
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command:
        parser.error('a command is required after --')
    status = os.fdopen(os.dup(args.status_fd), 'w')
    path = os.environ.get('OH_BROWSER_SUITE_LOCK', DEFAULT_LOCK)
    fd, writable = open_lock(path)
    acquire(fd, status)
    if writable:
        description = f'{args.label} (pid {os.getpid()}, since {time.strftime("%H:%M:%S")})'
        os.ftruncate(fd, 0)
        os.pwrite(fd, description.encode() + b'\n', 0)
    status.close()
    child = subprocess.Popen(command)
    # SIGTERM to the wrapper must not leave an unlocked suite running.
    signal.signal(signal.SIGTERM, lambda *_: child.terminate())
    while True:
        try:
            rc = child.wait()
            return 128 - rc if rc < 0 else rc
        except KeyboardInterrupt:
            continue  # SIGINT reached the child's process group too; wait for it


if __name__ == '__main__':
    sys.exit(main())
