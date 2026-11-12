#!/bin/sh
# Shell entry point; Python's standard library handles ZIP paths and JSONL safely.
command -v python3 >/dev/null 2>&1 || {
    echo 'inspect-trace: missing dependency python3' >&2
    exit 2
}
exec python3 - "$@" <<'PY'
import json
import os
import re
from pathlib import Path, PurePosixPath
import shlex
import stat
import subprocess
import sys
import zipfile

HELP = """Usage: scripts/inspect-trace.sh [--json] <trace.zip|test-results dir>

Extract one Playwright trace into a fresh private directory and summarize the
last 5 failed actions, console/page errors and network errors (HTTP >= 400 or
transport failure). A directory must contain exactly one trace.zip recursively;
otherwise pass a specific archive. No viewer is launched and nothing is deleted.

Options: --help  Show this help; --json  Emit structured output.
Environment: TMPDIR  Extraction parent. Default on Linux: OH_SCRATCH_ROOT, else
  /var/tmp/agent-scratch when present and writable (an expiring scratch area),
  else /var/tmp; elsewhere /tmp.
On Linux TMPDIR must be disk-backed (not tmpfs/ramfs).
Requires: python3, mktemp; Linux also requires stat.
Exit codes: 0 success/help, 1 invalid input/archive, 2 I/O/missing dependency.
Example: scripts/inspect-trace.sh web/test-results
"""
json_mode = "--json" in sys.argv[1:]


def fail(message, code=1):
    if json_mode:
        print(json.dumps({"schema_version": 1, "error": {
            "code": "invalid_input" if code == 1 else "system_error",
            "message": message}}), file=sys.stderr)
    else:
        print(f"inspect-trace: {message}", file=sys.stderr)
    sys.exit(code)


args = sys.argv[1:]
if len(args) != len(set(args)):
    fail("Duplicate arguments are not accepted")
if "--help" in args:
    if any(a not in ("--help", "--json") for a in args):
        fail("--help accepts only --json")
    print(json.dumps({"schema_version": 1, "help": HELP}) if json_mode else HELP)
    sys.exit(0)
args = [a for a in args if a != "--json"]
if len(args) != 1 or not args[0].strip() or args[0].startswith("-"):
    fail("Expected one trace.zip or test-results directory; see --help (use ./ for a leading-hyphen path)")

try:
    source = Path(args[0]).resolve(strict=True)
    if source.is_dir():
        traces = sorted(source.rglob("trace.zip"))
        if len(traces) != 1:
            fail(f"Directory {str(source)!r} contains {len(traces)} traces; pass one trace.zip explicitly")
        source = traces[0].resolve(strict=True)
    if not source.is_file() or source.suffix != ".zip":
        fail(f"Expected a .zip file, got {str(source)!r}")
    if "TMPDIR" in os.environ:
        parent_value = os.environ["TMPDIR"]
    elif sys.platform != "linux":
        parent_value = "/tmp"
    elif os.environ.get("OH_SCRATCH_ROOT"):
        parent_value = os.environ["OH_SCRATCH_ROOT"]
    elif os.path.isdir("/var/tmp/agent-scratch") and os.access("/var/tmp/agent-scratch", os.W_OK):
        parent_value = "/var/tmp/agent-scratch"
    else:
        parent_value = "/var/tmp"
    if not parent_value.strip():
        fail("TMPDIR must not be empty or whitespace-only")
    parent = Path(parent_value).resolve(strict=True)
    if not parent.is_dir():
        fail(f"TMPDIR {parent_value!r} is not a directory")
    if sys.platform == "linux":
        fs = subprocess.check_output(["stat", "-f", "-c", "%T", "--", str(parent)], text=True).strip()
        if fs in ("tmpfs", "ramfs"):
            fail(f"TMPDIR {str(parent)!r} is {fs}; choose disk-backed storage such as /var/tmp")

    with zipfile.ZipFile(source) as archive:
        members = archive.infolist()
        names = set()
        for entry in members:
            path = PurePosixPath(entry.filename)
            if (path.is_absolute() or ".." in path.parts or "\\" in entry.filename
                    or stat.S_ISLNK(entry.external_attr >> 16) or entry.filename in names):
                fail(f"Unsafe or duplicate ZIP member: {entry.filename!r}")
            names.add(entry.filename)
        trace_files = [e for e in members if e.filename.endswith(".trace")]
        if not trace_files:
            fail(f"Archive {str(source)!r} has no Playwright .trace records")
        # Validate everything before writing. ZIP symlinks and traversal never escape.
        output = Path(subprocess.check_output(
            ["mktemp", "-d", str(parent / "oh-trace.XXXXXXXX")], text=True).strip())
        archive.extractall(output)

    def message(value):
        if isinstance(value, dict):
            value = value.get("message") or value.get("value") or value
        text = re.sub(r"\x1b\[[0-9;]*m", "", str(value))
        return text[:1000] + ("…" if len(text) > 1000 else "")

    actions, console, network = [], [], []
    before = {}
    for path in sorted(output.rglob("*")):
        if path.suffix not in (".trace", ".network") or not path.is_file():
            continue
        with path.open() as records:
            for line_number, line in enumerate(records, 1):
                if not line.strip():
                    continue
                try:
                    event = json.loads(line)
                except (ValueError, UnicodeError):
                    fail(f"Invalid JSONL at {path}:{line_number}; extracted files retained at {output}")
                kind = event.get("type")
                if kind == "before":
                    before[(path, event.get("callId"))] = event
                if kind == "after" and event.get("error"):
                    call = before.get((path, event.get("callId")), {})
                    actions.append({"action": call.get("apiName") or call.get("title") or call.get("method") or event.get("callId"),
                                    "error": message(event["error"])})
                if kind == "error" or (kind == "console" and event.get("messageType") == "error"):
                    console.append(message(event.get("text") or event.get("error") or event))
                if kind == "resource-snapshot":
                    snapshot = event.get("snapshot", {})
                    response = snapshot.get("response", {})
                    failure = snapshot.get("_failureText")
                    if response.get("status", 0) >= 400 or failure:
                        network.append((snapshot.get("_monotonicTime", 0),
                                        {"url": snapshot.get("request", {}).get("url"),
                                         "status": response.get("status"), "error": failure}))
    network = [item for _, item in sorted(network, key=lambda entry: entry[0])]
    viewer = f"cd web && npx --no-install playwright show-trace {shlex.quote(str(source))}"
    result = {"schema_version": 1, "archive": str(source), "extracted_path": str(output),
              "failed_actions": actions[-5:], "console_errors": console[-5:],
              "network_errors": network[-5:], "view_command": viewer}
    if json_mode:
        print(json.dumps(result))
    else:
        print(f"Extracted: {output}\nArchive: {source}")
        for title, items in (("Failed actions (last 5)", actions[-5:]),
                             ("Console/page errors (last 5)", console[-5:]),
                             ("Network errors (last 5)", network[-5:])):
            print(f"{title}:")
            for item in items:
                print("  " + json.dumps(item, ensure_ascii=True))
            if not items:
                print("  none recorded")
        print(f"View from repository root: {viewer}\nExtracted files are retained; no cleanup performed.")
except FileNotFoundError as error:
    fail(str(error), 2 if error.filename in ("stat", "mktemp") else 1)
except (zipfile.BadZipFile, ValueError, RuntimeError, TypeError, AttributeError) as error:
    fail(f"Invalid trace archive: {error}")
except (OSError, subprocess.SubprocessError) as error:
    fail(str(error), 2)
PY
