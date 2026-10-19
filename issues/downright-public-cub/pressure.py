#!/usr/bin/env python3
"""Bounded synthetic load for this issue; runs only the supplied test command."""
import ctypes
import multiprocessing
import os
import subprocess
import sys
import time


def burn(cpus):
    os.sched_setaffinity(0, cpus)
    until = time.monotonic() + 600
    while time.monotonic() < until:
        pass


def main():
    cpus = set(sorted(os.sched_getaffinity(0))[:2])
    if len(cpus) != 2 or len(sys.argv) < 2:
        raise SystemExit("requires two CPUs and a test command")
    libc = ctypes.CDLL(None, use_errno=True)
    context = multiprocessing.get_context("fork")
    fds, workers = [], []
    try:
        for _ in range(16):
            fd = libc.inotify_init1(os.O_NONBLOCK | os.O_CLOEXEC)
            if fd < 0:
                raise OSError(ctypes.get_errno(), "inotify_init1")
            fds.append(fd)
        for _ in range(2):
            worker = context.Process(target=burn, args=(cpus,))
            worker.start()
            workers.append(worker)
        print(f"pressure: 16 extra inotify instances, 2 CPU burners; CPUs {cpus}", flush=True)
        return subprocess.call(
            ["taskset", "-c", ",".join(map(str, sorted(cpus)))] + sys.argv[1:],
            timeout=590,
        )
    finally:
        for worker in workers:
            worker.terminate()
            worker.join()
        for fd in fds:
            os.close(fd)


if __name__ == "__main__":
    sys.exit(main())
