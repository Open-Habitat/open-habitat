#!/usr/bin/env python3
"""Drain VM serial to EOF; retain only a private bounded prefix and safe markers.

The receipt is written only at EOF. Missing receipt, a capped stream, or a
credential in any byte (including bytes after the cap) invalidates the proof.
"""
import json
import os
import pathlib
import re
import sys

LIMIT = 2097152
# These are fixture-only credentials; scan the entire stream, across reads.
TOKENS = [f"PRODUCT_VM_TOKEN_{name}_FIXTURE_ONLY_92764".encode() for name in
          ("agent_a", "agent_b", "guestone", "guesttwo", "UNKNOWN")]
# Fixed fixture vocabulary, not arbitrary serial text with a plausible prefix.
MARKER = re.compile(
    rb"^(?:VM_PHASE=(?:lost_ack_callback_start|lost_ack_callback_returned|"
    rb"lost_ack_assertions_passed|real_reboot_requested)|"
    rb"VM_REBOOT_DIAG=(?:entry|pid1-and-origin-start|kernel-boot-changed|"
    rb"ledger-read-start|credentials-start|credential-(?:guestone|guesttwo)"
    rb"(?:-foreign-probe)?-start|persistent-ledger-and-homes|socket-status-start|"
    rb"socket-(?:guestone|guesttwo)-status-start|broker-socket-status-start|"
    rb"disabled-sockets|policy-(?:preflight|verify)-start|unprepared-boot-acl|"
    rb"cmd-[0-9]{1,3}-(?:start|timeout|exit-[0-9]{1,3})|"
    rb"unit-(?:activestate|substate|result|execmainstatus)-[a-z0-9_-]{1,32}|"
    rb"unit-status-timeout)|VM_REBOOT_JOURNAL=(?:none|(?:exited|failed|killed|timeout)(?:,(?:exited|failed|killed|timeout)){0,3})|"
    rb"VM_REBOOT_UNIT_EXIT=(?:success|exit-code|timeout|signal|core-dump|oom-kill|watchdog|resources|protocol|unknown):(?:exited|killed|dumped|dead|unknown):(?:[0-9]{1,3}|unknown))\r?$"
)


def drain(source, log, receipt):
    total = 0
    leaked = False
    overlap = b""
    line = bytearray()
    markers = []
    with open(log, "xb") as output:
        os.chmod(log, 0o600)
        while chunk := source.read(65536):
            if not isinstance(chunk, bytes):
                raise ValueError("serial source must be binary")
            scanned = overlap + chunk
            leaked |= any(token in scanned for token in TOKENS)
            overlap = scanned[-(max(map(len, TOKENS)) - 1):]
            if total < LIMIT:
                output.write(chunk[:LIMIT - total])
            total += len(chunk)
            # Split in C; retain at most 129 bytes of an unfinished line.
            parts = chunk.split(b"\n")
            for index, part in enumerate(parts):
                remaining = max(0, 129 - len(line))
                line.extend(part[:remaining])
                if len(part) > remaining and len(line) <= 128:
                    line.append(32)  # overflow sentinel
                if index != len(parts) - 1:
                    if len(line) <= 128:
                        match = MARKER.fullmatch(line)
                        if match and len(markers) < 64:
                            markers.append(match.group().decode("ascii"))
                    line.clear()
    with open(receipt, "x", encoding="utf-8") as out:
        os.chmod(receipt, 0o600)
        json.dump({"bytes": total, "capped": total > LIMIT, "token_leaked": leaked,
                   "markers": markers}, out)
        out.write("\n")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: vm-serial-drain.py LOG RECEIPT")
    drain(sys.stdin.buffer, pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
