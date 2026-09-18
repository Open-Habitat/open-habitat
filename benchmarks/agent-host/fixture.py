#!/usr/bin/env python3
"""Non-interactive CLI for validating the candidate-neutral benchmark fixture."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any

# Importing the fixture must not create __pycache__ beside tracked source.
sys.dont_write_bytecode = True

from fixture_core import FixtureError, SystemFixtureError, SCHEMA_VERSION, validate_descriptors, validate_output_root, load_json

VERSION = "0.1.0"
BASE = Path(__file__).resolve().parent


class Parser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise FixtureError("invalid_arguments", f"Invalid command arguments: {message}")


def repository_commit() -> str | None:
    try:
        value = subprocess.run(["git", "rev-parse", "HEAD"], cwd=BASE, text=True, capture_output=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None
    return value if len(value) == 40 and all(c in "0123456789abcdef" for c in value) else None


def version_payload() -> dict[str, Any]:
    commit = repository_commit()
    payload: dict[str, Any] = {"schema_version": SCHEMA_VERSION, "version": VERSION, "commit": commit, "supported_schemas": [1], "fixture_id": "agent-host-common-v1"}
    payload["build_provenance"] = {"kind": "git", "note": "resolved from fixture repository at invocation"} if commit else {"kind": "vendored", "note": "no .git provenance available"}
    return payload


def parser() -> Parser:
    root = Parser(prog="fixture.py", description="Validate the candidate-neutral agent-host benchmark fixture. Never executes a candidate protocol.")
    root.add_argument("--json", action="store_true", help="emit schema-versioned JSON")
    root.add_argument("--verbose", action="store_true", help="emit diagnostic JSONL to stderr")
    sub = root.add_subparsers(dest="command", required=True)
    sub.add_parser("version", help="show fixture CLI and schema versions")
    sub.add_parser("doctor", help="read-only validation of descriptors, schemas, identity separation, and safety declarations")
    scenario = sub.add_parser("scenario", help="scenario descriptor operations")
    scenario_sub = scenario.add_subparsers(dest="scenario_command", required=True)
    scenario_sub.add_parser("list", help="list frozen B1-B8 scenario descriptors")
    preflight = sub.add_parser("preflight", help="read-only environment and disposable-root readiness checks")
    preflight.add_argument("--output-root", required=True, help="absolute marked directory below the OS temporary root")
    return root


def preflight_payload(output_root: str) -> dict[str, Any]:
    root = validate_output_root(output_root)
    checks = validate_descriptors(BASE)
    git = shutil.which("git")
    if git is None:
        raise SystemFixtureError("dependency_missing", "Required dependency 'git' is not on PATH")
    try:
        version = subprocess.run([git, "--version"], text=True, capture_output=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as exc:
        raise SystemFixtureError("dependency_failed", f"Could not execute git --version: {exc}") from exc
    if not root.stat().st_mode:
        raise SystemFixtureError("output_root_unreadable", "Could not inspect output root mode")
    if not os.access(root, os.W_OK | os.X_OK):
        raise FixtureError("output_root_not_writable", f"Output root is not writable/searchable: {root}", invalid_value=str(root))
    checks.extend([
        {"id": "dependency.git", "status": "ok", "message": version},
        {"id": "output_root.safety", "status": "ok", "message": "absolute, marked, non-symlink temporary child"},
        {"id": "network.policy", "status": "ok", "message": "fixture declares no network destinations"},
        {"id": "candidate.execution", "status": "ok", "message": "preflight performs no candidate execution"},
    ])
    return {"schema_version": SCHEMA_VERSION, "fixture_id": "agent-host-common-v1", "ready": True, "checks": checks, "summary": {"ok": len(checks), "warn": 0, "fail": 0}}


def help_payload(path: list[str]) -> dict[str, Any]:
    command = " ".join(path) if path else "fixture.py"
    surfaces = {
        "fixture.py": {
            "description": "Validate the candidate-neutral agent-host benchmark fixture; never executes a candidate protocol.",
            "subcommands": ["version", "doctor", "scenario", "preflight"],
            "flags": ["--json", "--verbose", "--version", "--help"],
            "examples": [{"description": "Validate all descriptors", "argv": ["fixture.py", "--json", "doctor"]}],
        },
        "doctor": {"description": "Read-only validation of descriptors, identity separation, and safety declarations", "subcommands": [], "flags": ["--json", "--verbose", "--help"], "examples": [{"description": "Return validation JSON", "argv": ["fixture.py", "doctor", "--json"]}]},
        "scenario": {"description": "Scenario descriptor operations", "subcommands": ["list"], "flags": ["--json", "--verbose", "--help"], "examples": [{"description": "List scenarios", "argv": ["fixture.py", "scenario", "list", "--json"]}]},
        "scenario list": {"description": "List frozen B1-B8 descriptors", "subcommands": [], "flags": ["--json", "--verbose", "--help"], "examples": [{"description": "List scenarios", "argv": ["fixture.py", "scenario", "list", "--json"]}]},
        "preflight": {"description": "Run read-only readiness checks", "subcommands": [], "flags": ["--output-root <ABSOLUTE_PATH>", "--json", "--verbose", "--help"], "examples": [{"description": "Check a marked temporary root", "argv": ["fixture.py", "preflight", "--output-root", "/tmp/agent-host-fixture.EXAMPLE", "--json"]}]},
        "version": {"description": "Show fixture CLI and schema versions", "subcommands": [], "flags": ["--json", "--verbose", "--help"], "examples": [{"description": "Show version JSON", "argv": ["fixture.py", "version", "--json"]}]},
    }
    if command not in surfaces:
        raise FixtureError("invalid_help_target", f"Unknown help target: {command}", invalid_value=command)
    return {"schema_version": SCHEMA_VERSION, "command": command, **surfaces[command]}


def text_render(payload: dict[str, Any]) -> str:
    if "checks" in payload:
        lines = [f"OK {item['id']}: {item['message']}" for item in payload["checks"]]
        summary = payload.get("summary", {})
        lines.append(f"summary: {summary.get('ok', 0)} ok, {summary.get('warn', 0)} warn, {summary.get('fail', 0)} fail")
        return "\n".join(lines)
    if "scenarios" in payload:
        return "\n".join(f"{item['id']}\t{item['title']}" for item in payload["scenarios"])
    if "version" in payload:
        return f"fixture.py {payload['version']} (schema {payload['schema_version']}, commit {payload['commit'] or 'unavailable'})"
    return json.dumps(payload, sort_keys=True)


def emit_error(exc: FixtureError, json_mode: bool) -> int:
    if json_mode:
        error: dict[str, Any] = {"code": exc.code, "message": str(exc)}
        if exc.invalid_value is not None:
            error["invalid_value"] = exc.invalid_value
        if exc.expected is not None:
            error["expected"] = exc.expected
        print(json.dumps({"schema_version": SCHEMA_VERSION, "error": error}, sort_keys=True), file=sys.stderr)
    else:
        print(f"error [{exc.code}]: {exc}", file=sys.stderr)
    return 2 if isinstance(exc, SystemFixtureError) else 1


def main(argv: list[str] | None = None) -> int:
    args_list = list(sys.argv[1:] if argv is None else argv)
    # Global invocation flags are accepted before or after subcommands.
    json_mode = "--json" in args_list
    verbose = "--verbose" in args_list
    args_list = [x for x in args_list if x not in {"--json", "--verbose"}]
    if "--version" in args_list:
        if len(args_list) != 1:
            return emit_error(FixtureError("invalid_arguments", "--version cannot be combined with a subcommand"), json_mode)
        args_list = ["version"]
    if json_mode and "--help" in args_list:
        help_path = [item for item in args_list if item != "--help"]
        try:
            print(json.dumps(help_payload(help_path), sort_keys=True))
            return 0
        except FixtureError as exc:
            return emit_error(exc, True)
    try:
        args = parser().parse_args(args_list)
        args.json = json_mode
        args.verbose = verbose
        if verbose:
            print(json.dumps({"schema_version": SCHEMA_VERSION, "level": "INFO", "target": "fixture.cli", "event": "command_started", "command": args.command}, sort_keys=True), file=sys.stderr)
        if args.command == "version":
            payload = version_payload()
        elif args.command == "doctor":
            checks = validate_descriptors(BASE)
            payload = {"schema_version": SCHEMA_VERSION, "fixture_id": "agent-host-common-v1", "valid": True, "checks": checks, "summary": {"ok": len(checks), "warn": 0, "fail": 0}}
        elif args.command == "scenario" and args.scenario_command == "list":
            descriptor = load_json(BASE / "scenarios.json")
            payload = {"schema_version": SCHEMA_VERSION, "fixture_id": "agent-host-common-v1", "count": len(descriptor["scenarios"]), "scenarios": descriptor["scenarios"]}
        elif args.command == "preflight":
            payload = preflight_payload(args.output_root)
        else:
            raise FixtureError("invalid_command", "Unsupported command")
        print(json.dumps(payload, sort_keys=True) if json_mode else text_render(payload))
        return 0
    except FixtureError as exc:
        return emit_error(exc, json_mode)
    except Exception as exc:  # central invariant failure mapping
        return emit_error(SystemFixtureError("internal_error", f"Unexpected fixture failure: {exc}"), json_mode)


if __name__ == "__main__":
    raise SystemExit(main())
