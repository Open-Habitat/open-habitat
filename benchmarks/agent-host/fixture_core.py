#!/usr/bin/env python3
"""Dependency-free core for the candidate-neutral agent-host benchmark fixture."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import tempfile
from typing import Any, Iterable

SCHEMA_VERSION = 1
FIXTURE_ID = "agent-host-common-v1"
ROOT_MARKER = ".agent-host-fixture-root"
ROOT_MARKER_CONTENT = "agent-host-disposable-v1\n"
FAILURE_MODES = ("success", "failure", "timeout_before_side_effect", "timeout_after_side_effect")
RESULT_STATES = ("observed_as_specified", "observed_with_deviation", "delegated", "not_exercised", "not_applicable")
SECRET_KEY = re.compile(r"(?:token|secret|password|credential)(?:_|$)", re.IGNORECASE)
ABSOLUTE_PATH = re.compile(r"(?:^|\s)/(?:[^\s/]+/)+[^\s]*")
MAX_BUNDLE_BYTES = 1_048_576
RFC3339_UTC_SECONDS = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")
SAFE_LABEL = re.compile(r"[a-z0-9][a-z0-9._-]{0,127}")


class FixtureError(Exception):
    """Caller-actionable fixture error with a stable machine code."""

    def __init__(self, code: str, message: str, *, invalid_value: Any = None, expected: Any = None):
        super().__init__(message)
        self.code = code
        self.invalid_value = invalid_value
        self.expected = expected


class SystemFixtureError(FixtureError):
    """System/internal failure, mapped to exit 2 by the CLI."""


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def stable_id(kind: str, *parts: str) -> str:
    if not kind or any(not part for part in parts):
        raise FixtureError("invalid_id_input", "Stable ID inputs must be non-empty", invalid_value=[kind, *parts])
    digest = hashlib.sha256("\x00".join((FIXTURE_ID, kind, *parts)).encode()).hexdigest()[:20]
    return f"{kind}-{digest}"


def _reject_symlink_components(path: Path) -> None:
    current = Path(path.anchor)
    for component in path.parts[1:]:
        current = current / component
        if current.is_symlink():
            raise FixtureError("unsafe_output_root", f"Output root contains symlink component: {current}", invalid_value=str(path))


def validate_output_root(raw: str | os.PathLike[str]) -> Path:
    """Require an explicit, marked, existing directory below the OS temp root."""
    if not str(raw) or not str(raw).strip():
        raise FixtureError("invalid_output_root", "--output-root must be a non-empty absolute path", invalid_value=str(raw))
    path = Path(raw)
    if not path.is_absolute():
        raise FixtureError("invalid_output_root", "--output-root must be absolute", invalid_value=str(raw))
    _reject_symlink_components(path)
    try:
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise FixtureError("invalid_output_root", f"Output root does not exist: {path}", invalid_value=str(path)) from exc
    if not resolved.is_dir():
        raise FixtureError("invalid_output_root", f"Output root is not a directory: {resolved}", invalid_value=str(resolved))
    temp_root = Path(tempfile.gettempdir()).resolve(strict=True)
    try:
        relative = resolved.relative_to(temp_root)
    except ValueError as exc:
        raise FixtureError("unsafe_output_root", f"Output root must be below temporary root {temp_root}", invalid_value=str(resolved)) from exc
    if not relative.parts or resolved in {Path("/"), Path.home().resolve(), temp_root}:
        raise FixtureError("unsafe_output_root", "Output root must be a dedicated child of the temporary root", invalid_value=str(resolved))
    marker = resolved / ROOT_MARKER
    if not marker.is_file() or marker.is_symlink():
        raise FixtureError("unmarked_output_root", f"Output root lacks regular marker {ROOT_MARKER}", invalid_value=str(resolved))
    if marker.read_text(encoding="utf-8") != ROOT_MARKER_CONTENT:
        raise FixtureError("invalid_output_root_marker", f"Output root marker has unexpected content: {marker}", invalid_value=str(resolved))
    return resolved


def contained_path(root: Path, *parts: str) -> Path:
    if not parts or any(not part or Path(part).is_absolute() or part in {".", ".."} for part in parts):
        raise FixtureError("invalid_relative_path", "Contained path parts must be non-empty relative names", invalid_value=list(parts))
    candidate = root.joinpath(*parts)
    resolved_parent = candidate.parent.resolve(strict=True)
    try:
        resolved_parent.relative_to(root)
    except ValueError as exc:
        raise FixtureError("path_escape", f"Path escapes output root: {candidate}", invalid_value=str(candidate)) from exc
    if candidate.exists() and candidate.is_symlink():
        raise FixtureError("path_escape", f"Symlink target is forbidden: {candidate}", invalid_value=str(candidate))
    return candidate


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemFixtureError("fixture_read_failed", f"Could not read fixture JSON {path}: {exc}") from exc


def validate_descriptors(base: Path) -> list[dict[str, str]]:
    checks: list[dict[str, str]] = []
    required = {
        "fixture.json": "fixture_id",
        "scenarios.json": "scenarios",
        "adapter-contract.json": "contract_id",
        "evidence-schema.json": "$schema",
        "candidate-result-schema.json": "$schema",
        "version-manifest.json": "fixture_version",
        "sample-evidence.json": "integrity",
    }
    loaded: dict[str, Any] = {}
    for filename, key in required.items():
        value = load_json(base / filename)
        if not isinstance(value, dict) or value.get("schema_version") != SCHEMA_VERSION or key not in value:
            raise FixtureError("invalid_descriptor", f"{filename} must contain schema_version=1 and {key}", invalid_value=filename)
        loaded[filename] = value
        checks.append({"id": f"descriptor.{filename}", "status": "ok", "message": "valid JSON envelope"})
    fixture = loaded["fixture.json"]
    if fixture.get("fixture_id") != FIXTURE_ID:
        raise FixtureError("invalid_fixture_id", "fixture.json has an unexpected fixture_id", invalid_value=fixture.get("fixture_id"), expected=FIXTURE_ID)
    scenarios = loaded["scenarios.json"].get("scenarios")
    ids = [item.get("id") for item in scenarios] if isinstance(scenarios, list) else []
    if ids != [f"B{i}" for i in range(1, 9)]:
        raise FixtureError("invalid_scenarios", "Scenario descriptors must contain B1 through B8 in order", invalid_value=ids)
    if len(set(ids)) != 8:
        raise FixtureError("invalid_scenarios", "Scenario IDs must be unique", invalid_value=ids)
    actors = {(x["principal_id"], tuple(x["clients"])) for x in fixture.get("actors", [])}
    if actors != {("alice", ("client-a", "client-b")), ("bob", ("client-bob",))}:
        raise FixtureError("invalid_identity_fixture", "Actor fixture must preserve separate Alice and Bob clients", invalid_value=sorted(actors))
    tenants = fixture.get("tenants", [])
    tenant_ids = [x.get("tenant_id") for x in tenants]
    if tenant_ids != ["school-a", "school-b"]:
        raise FixtureError("invalid_tenant_fixture", "Tenant fixture must preserve school-a and school-b", invalid_value=tenant_ids)
    if [x.get("session_name") for x in tenants] != ["identical-session-name", "identical-session-name"]:
        raise FixtureError("invalid_tenant_fixture", "Both tenant fixtures must carry the same synthetic session name to expose scope bugs")
    if fixture.get("network") != {"mode": "none", "allowed_hosts": []}:
        raise FixtureError("unsafe_network_fixture", "Fixture network policy must deny all network access")
    required_scenario_fields = {"id", "title", "actors", "tenant", "operations", "expected_observables", "stop_conditions"}
    for item in scenarios:
        missing = sorted(required_scenario_fields - set(item))
        if missing or not all(isinstance(item.get(field), list) and item[field] for field in ("actors", "operations", "expected_observables", "stop_conditions")):
            raise FixtureError("invalid_scenario_descriptor", f"{item.get('id')} lacks required non-empty scenario fields", invalid_value=missing)
    adapter = loaded["adapter-contract.json"]
    constraints = adapter.get("constraints", {})
    if constraints.get("may_own_runtime_lifecycle") is not False or constraints.get("may_create_workspace") is not False or constraints.get("must_preserve_native_event") is not True:
        raise FixtureError("unsafe_adapter_contract", "Adapter contract must deny lifecycle/workspace authority and preserve native events")
    result_schema = loaded["candidate-result-schema.json"]
    result_states = result_schema.get("properties", {}).get("result_state", {}).get("enum")
    if result_states != list(RESULT_STATES):
        raise FixtureError("invalid_result_states", "Candidate result schema has unexpected result-state vocabulary", invalid_value=result_states, expected=list(RESULT_STATES))
    manifest = loaded["version-manifest.json"]
    if manifest.get("candidate_execution") is not False or manifest.get("candidate_protocols") != [] or manifest.get("network_mode") != "none":
        raise FixtureError("unsafe_version_manifest", "Version manifest must declare no candidate execution, protocols, or network")
    verify_bundle(loaded["sample-evidence.json"])
    checks.extend([
        {"id": "scenarios.complete", "status": "ok", "message": "B1-B8 are present with required fields in canonical order"},
        {"id": "identity.separate", "status": "ok", "message": "Alice and Bob have distinct authenticated fixture identities"},
        {"id": "tenancy.separate", "status": "ok", "message": "school-a and school-b are distinct fixture scopes"},
        {"id": "network.disabled", "status": "ok", "message": "all external network access is denied"},
        {"id": "adapter.authority", "status": "ok", "message": "adapter cannot own runtime/workspace lifecycle"},
        {"id": "result.states", "status": "ok", "message": "delegated, not-applicable, and not-exercised states remain distinct"},
        {"id": "sample.integrity", "status": "ok", "message": "bounded synthetic sample digest and event chain verified"},
    ])
    return checks


def sanitize(value: Any) -> Any:
    """Return a deterministic, bounded evidence-safe projection."""
    if isinstance(value, dict):
        result = {}
        for key in sorted(value):
            text_key = str(key)
            result[text_key] = "<redacted>" if SECRET_KEY.search(text_key) else sanitize(value[key])
        return result
    if isinstance(value, list):
        return [sanitize(item) for item in value[:1000]]
    if isinstance(value, str):
        text = ABSOLUTE_PATH.sub(" <absolute-path>", value)
        return text if len(text) <= 4096 else text[:4093] + "..."
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return str(value)


class PolicyFixture:
    def decide(self, *, principal_id: str, tenant_id: str, capability: str, approved_by: str | None = None) -> dict[str, Any]:
        if principal_id not in {"alice", "bob"}:
            raise FixtureError("unknown_principal", f"Unknown principal: {principal_id}", invalid_value=principal_id)
        if tenant_id not in {"school-a", "school-b"}:
            raise FixtureError("unknown_tenant", f"Unknown tenant: {tenant_id}", invalid_value=tenant_id)
        decision = "deny"
        reason = "principal_or_tenant_not_authorized"
        if principal_id == "alice" and tenant_id == "school-a" and capability == "read_value":
            decision, reason = "allow", "low_risk_fixture_capability"
        elif principal_id == "alice" and tenant_id == "school-a" and capability == "write_value":
            if approved_by == "alice":
                decision, reason = "allow", "verified_principal_approval"
            else:
                decision, reason = "require_approval", "verified_principal_approval_required"
        elif capability in {"exfiltrate", "cross_tenant_read"}:
            reason = "fixture_policy_explicit_deny"
        return {"principal_id": principal_id, "tenant_id": tenant_id, "capability": capability, "decision": decision, "reason": reason, "approved_by": approved_by}


class FakeOrchestrator:
    """The fixture's sole runtime/workspace lifecycle owner."""

    def __init__(self, output_root: str | os.PathLike[str]):
        self.root = validate_output_root(output_root)
        self.runtime_dir = self.root / "runtimes"
        self.workspace_dir = self.root / "workspaces"
        for directory in (self.runtime_dir, self.workspace_dir):
            if directory.is_symlink() or (directory.exists() and not directory.is_dir()):
                raise FixtureError("path_escape", f"Managed lifecycle path must be a regular directory: {directory}")
            directory.mkdir(mode=0o700, exist_ok=True)
            try:
                directory.resolve(strict=True).relative_to(self.root)
            except ValueError as exc:
                raise FixtureError("path_escape", f"Managed lifecycle path escapes output root: {directory}") from exc
        self._states: dict[str, dict[str, Any]] = {}

    def _create_repository(self, workspace: Path) -> str:
        if workspace.exists():
            raise FixtureError("workspace_exists", f"Workspace already exists: {workspace.name}", invalid_value=workspace.name)
        workspace.mkdir(mode=0o700)
        (workspace / "src").mkdir()
        (workspace / "README.md").write_text("# Synthetic benchmark repository\n", encoding="utf-8")
        (workspace / "src" / "value.txt").write_text("1\n", encoding="utf-8")
        env = {
            "PATH": os.environ.get("PATH", ""), "HOME": str(self.root),
            "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_AUTHOR_NAME": "Fixture Author", "GIT_AUTHOR_EMAIL": "fixture@example.invalid",
            "GIT_COMMITTER_NAME": "Fixture Author", "GIT_COMMITTER_EMAIL": "fixture@example.invalid",
            "GIT_AUTHOR_DATE": "2000-01-01T00:00:00Z", "GIT_COMMITTER_DATE": "2000-01-01T00:00:00Z",
            "TZ": "UTC", "LC_ALL": "C",
        }
        commands = [
            ["git", "init", "--quiet", "--initial-branch=fixture"],
            ["git", "-c", "core.hooksPath=/dev/null", "add", "README.md", "src/value.txt"],
            ["git", "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture: baseline"],
            ["git", "rev-parse", "HEAD"],
        ]
        output = ""
        try:
            for command in commands:
                output = subprocess.run(command, cwd=workspace, env=env, check=True, text=True, capture_output=True).stdout.strip()
        except (OSError, subprocess.CalledProcessError) as exc:
            shutil.rmtree(workspace, ignore_errors=True)
            raise SystemFixtureError("git_fixture_failed", f"Could not create synthetic Git repository: {exc}") from exc
        return output

    def start(self, *, session_id: str, attempt_id: str, failure_mode: str = "success") -> dict[str, Any]:
        if failure_mode not in FAILURE_MODES:
            raise FixtureError("invalid_failure_mode", f"Invalid failure mode: {failure_mode}", invalid_value=failure_mode, expected=list(FAILURE_MODES))
        runtime_id = stable_id("runtime", session_id)
        workspace_id = stable_id("workspace", session_id)
        if runtime_id in self._states:
            raise FixtureError("runtime_exists", f"Runtime already exists for session: {session_id}", invalid_value=session_id)
        if failure_mode in {"success", "timeout_after_side_effect"} and len(self._states) >= 2:
            raise FixtureError("workspace_limit_reached", "Fixture permits at most two active runtimes/workspaces", invalid_value=len(self._states), expected=2)
        base = {"session_id": session_id, "attempt_id": attempt_id, "runtime_id": runtime_id, "workspace_id": workspace_id, "failure_mode": failure_mode, "requested_state": "running"}
        if failure_mode == "failure":
            return {**base, "observed_state": "absent", "terminal_state": "failed", "side_effect": False}
        if failure_mode == "timeout_before_side_effect":
            return {**base, "observed_state": "unknown", "terminal_state": "unknown", "side_effect": False}
        workspace = self.workspace_dir / workspace_id
        commit = self._create_repository(workspace)
        runtime_record = self.runtime_dir / f"{runtime_id}.json"
        state = {**base, "observed_state": "running", "baseline_commit": commit, "workspace": workspace.name}
        try:
            descriptor = os.open(runtime_record, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
                stream.write(canonical_json(state) + "\n")
        except OSError as exc:
            shutil.rmtree(workspace, ignore_errors=True)
            raise SystemFixtureError("runtime_record_failed", f"Could not create exclusive runtime record: {exc}") from exc
        self._states[runtime_id] = state
        if failure_mode == "timeout_after_side_effect":
            return {**state, "terminal_state": "unknown", "side_effect": True}
        return {**state, "terminal_state": "succeeded", "side_effect": True}

    def observe(self, runtime_id: str) -> dict[str, Any]:
        state = self._states.get(runtime_id)
        return {"runtime_id": runtime_id, "observed_state": "running" if state else "absent", "workspace_id": state.get("workspace_id") if state else None}

    def stop(self, *, runtime_id: str, remove_workspace: bool = True) -> dict[str, Any]:
        state = self._states.pop(runtime_id, None)
        if state is None:
            raise FixtureError("runtime_not_found", f"Runtime not found: {runtime_id}", invalid_value=runtime_id)
        record = self.runtime_dir / f"{runtime_id}.json"
        record.unlink(missing_ok=False)
        removed = False
        if remove_workspace:
            workspace = self.workspace_dir / state["workspace_id"]
            workspace.resolve(strict=True).relative_to(self.root)
            if workspace.is_symlink():
                raise FixtureError("path_escape", f"Refusing to remove symlink workspace: {workspace}")
            shutil.rmtree(workspace)
            removed = True
        return {"runtime_id": runtime_id, "observed_state": "stopped", "workspace_removed": removed}


DATABASE_SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS attempts (
  attempt_id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL, principal_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL, requested_state TEXT NOT NULL, accepted_state TEXT NOT NULL,
  observed_state TEXT NOT NULL, terminal_state TEXT NOT NULL, correlation_id TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id), seq INTEGER NOT NULL,
  occurred_at TEXT NOT NULL, native_json TEXT NOT NULL, normalized_json TEXT NOT NULL,
  previous_sha256 TEXT NOT NULL, sha256 TEXT NOT NULL, UNIQUE(attempt_id, seq)
);
CREATE TABLE IF NOT EXISTS policy_decisions (
  decision_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
  principal_id TEXT NOT NULL, tenant_id TEXT NOT NULL, capability TEXT NOT NULL,
  decision TEXT NOT NULL, reason TEXT NOT NULL, approved_by TEXT, operation_sha256 TEXT NOT NULL,
  decided_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
  media_type TEXT NOT NULL, content_sha256 TEXT NOT NULL, byte_count INTEGER NOT NULL,
  retained_preview TEXT NOT NULL, captured_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS native_bindings (
  binding_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
  binding_type TEXT NOT NULL, native_id TEXT NOT NULL, available INTEGER NOT NULL CHECK (available IN (0,1)),
  recorded_at TEXT NOT NULL
);
"""


class EvidenceStore:
    def __init__(self, output_root: str | os.PathLike[str], filename: str = "evidence.sqlite3"):
        self.root = validate_output_root(output_root)
        if "/" in filename or filename in {"", ".", ".."}:
            raise FixtureError("invalid_evidence_filename", "Evidence filename must be a plain relative name", invalid_value=filename)
        self.path = self.root / filename
        if self.path.is_symlink():
            raise FixtureError("path_escape", f"Evidence database may not be a symlink: {self.path}")
        self.connection = sqlite3.connect(self.path)
        self.connection.executescript(DATABASE_SCHEMA)
        self.connection.commit()

    def close(self) -> None:
        self.connection.close()

    @staticmethod
    def _timestamp(value: str, field: str) -> str:
        if not RFC3339_UTC_SECONDS.fullmatch(value):
            raise FixtureError("invalid_timestamp", f"{field} must be RFC3339 UTC seconds", invalid_value=value)
        return value

    def add_attempt(self, record: dict[str, str]) -> None:
        fields = ("attempt_id", "scenario_id", "principal_id", "tenant_id", "requested_state", "accepted_state", "observed_state", "terminal_state", "correlation_id", "recorded_at")
        if record.get("scenario_id") not in {f"B{i}" for i in range(1, 9)}:
            raise FixtureError("invalid_scenario_id", "Attempt scenario_id must be B1 through B8", invalid_value=record.get("scenario_id"))
        if record.get("principal_id") not in {"alice", "bob"} or record.get("tenant_id") not in {"school-a", "school-b"}:
            raise FixtureError("invalid_attempt_scope", "Attempt must use a frozen principal and tenant", invalid_value=[record.get("principal_id"), record.get("tenant_id")])
        self._timestamp(record.get("recorded_at", ""), "recorded_at")
        self.connection.execute(f"INSERT INTO attempts ({','.join(fields)}) VALUES ({','.join('?' for _ in fields)})", tuple(record[field] for field in fields))
        self.connection.commit()

    def add_event(self, *, event_id: str, attempt_id: str, seq: int, occurred_at: str, native: dict[str, Any], normalized: dict[str, Any]) -> str:
        if seq < 1:
            raise FixtureError("invalid_event_sequence", "Event seq must be at least 1", invalid_value=seq)
        self._timestamp(occurred_at, "occurred_at")
        row = self.connection.execute("SELECT sha256, seq FROM events WHERE attempt_id=? ORDER BY seq DESC LIMIT 1", (attempt_id,)).fetchone()
        previous = row[0] if row else "0" * 64
        expected_seq = row[1] + 1 if row else 1
        if seq != expected_seq:
            raise FixtureError("event_sequence_gap", f"Expected event seq {expected_seq}, received {seq}", invalid_value=seq, expected=expected_seq)
        native_safe, normalized_safe = sanitize(native), sanitize(normalized)
        digest = sha256_json({"event_id": event_id, "attempt_id": attempt_id, "seq": seq, "occurred_at": occurred_at, "native": native_safe, "normalized": normalized_safe, "previous_sha256": previous})
        self.connection.execute("INSERT INTO events VALUES (?,?,?,?,?,?,?,?)", (event_id, attempt_id, seq, occurred_at, canonical_json(native_safe), canonical_json(normalized_safe), previous, digest))
        self.connection.commit()
        return digest

    def add_policy_decision(self, *, decision_id: str, attempt_id: str, decision: dict[str, Any], operation: dict[str, Any], decided_at: str) -> None:
        self._timestamp(decided_at, "decided_at")
        self.connection.execute("INSERT INTO policy_decisions VALUES (?,?,?,?,?,?,?,?,?,?)", (
            decision_id, attempt_id, decision["principal_id"], decision["tenant_id"], decision["capability"],
            decision["decision"], decision["reason"], decision.get("approved_by"), sha256_json(sanitize(operation)), decided_at))
        self.connection.commit()

    def add_artifact(self, *, artifact_id: str, attempt_id: str, media_type: str, content: bytes, captured_at: str) -> None:
        if len(content) > 65536:
            raise FixtureError("artifact_too_large", "Fixture artifact exceeds 65536-byte capture limit", invalid_value=len(content), expected=65536)
        self._timestamp(captured_at, "captured_at")
        preview = sanitize(content[:256].decode("utf-8", errors="replace"))
        self.connection.execute("INSERT INTO artifacts VALUES (?,?,?,?,?,?,?)", (artifact_id, attempt_id, media_type, hashlib.sha256(content).hexdigest(), len(content), preview, captured_at))
        self.connection.commit()

    def add_native_binding(self, *, binding_id: str, attempt_id: str, binding_type: str, native_id: str, available: bool, recorded_at: str) -> None:
        self._timestamp(recorded_at, "recorded_at")
        self.connection.execute("INSERT INTO native_bindings VALUES (?,?,?,?,?,?)", (binding_id, attempt_id, binding_type, native_id, int(available), recorded_at))
        self.connection.commit()

    def _rows(self, table: str, json_fields: Iterable[str] = (), order_by: str = "1") -> list[dict[str, Any]]:
        cursor = self.connection.execute(f"SELECT * FROM {table} ORDER BY {order_by}")
        names = [item[0] for item in cursor.description]
        result = []
        for values in cursor.fetchall():
            row = dict(zip(names, values))
            for field in json_fields:
                row[field] = json.loads(row[field])
            if "available" in row:
                row["available"] = bool(row["available"])
            result.append(row)
        return result

    def write_bundle(self, *, scenario_id: str, subject: str, generated_at: str, filename: str = "evidence-bundle.json") -> dict[str, Any]:
        if scenario_id not in {f"B{i}" for i in range(1, 9)}:
            raise FixtureError("invalid_scenario_id", "Bundle scenario_id must be B1 through B8", invalid_value=scenario_id)
        if not SAFE_LABEL.fullmatch(subject):
            raise FixtureError("invalid_subject", "Bundle subject must match [a-z0-9][a-z0-9._-]{0,127}", invalid_value=subject)
        self._timestamp(generated_at, "generated_at")
        if "/" in filename or filename in {"", ".", ".."}:
            raise FixtureError("invalid_evidence_filename", "Bundle filename must be a plain relative name", invalid_value=filename)
        events = self._rows("events", ("native_json", "normalized_json"), "attempt_id, seq")
        for row in events:
            row["native"] = row.pop("native_json")
            row["normalized"] = row.pop("normalized_json")
        body = sanitize({
            "schema_version": SCHEMA_VERSION, "fixture_id": FIXTURE_ID,
            "scenario_id": scenario_id, "subject": subject, "generated_at": generated_at,
            "attempts": self._rows("attempts"), "events": events,
            "policy_decisions": self._rows("policy_decisions"), "artifacts": self._rows("artifacts"),
            "native_bindings": self._rows("native_bindings"),
        })
        chain_heads: dict[str, str] = {}
        for event in events:
            chain_heads[event["attempt_id"]] = event["sha256"]
        body["integrity"] = {"algorithm": "sha256", "event_chain_heads": chain_heads, "payload_sha256": sha256_json(body)}
        encoded = (json.dumps(body, indent=2, sort_keys=True) + "\n").encode("utf-8")
        if len(encoded) > MAX_BUNDLE_BYTES:
            raise FixtureError("evidence_bundle_too_large", "Evidence bundle exceeds 1 MiB fixture limit", invalid_value=len(encoded), expected=MAX_BUNDLE_BYTES)
        destination = self.root / filename
        if destination.exists() and destination.is_symlink():
            raise FixtureError("path_escape", f"Bundle destination may not be a symlink: {destination}")
        temporary = destination.with_suffix(destination.suffix + ".tmp")
        if temporary.exists() or temporary.is_symlink():
            raise FixtureError("evidence_temp_exists", f"Refusing existing bundle temporary path: {temporary}", invalid_value=str(temporary))
        try:
            descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(encoded)
            os.replace(temporary, destination)
        except OSError as exc:
            temporary.unlink(missing_ok=True)
            raise SystemFixtureError("evidence_write_failed", f"Could not atomically write evidence bundle: {exc}") from exc
        return {"path": str(destination), "byte_count": len(encoded), "payload_sha256": body["integrity"]["payload_sha256"], "bundle": body}


def verify_bundle(bundle: dict[str, Any]) -> None:
    integrity = bundle.get("integrity", {})
    body = dict(bundle)
    body.pop("integrity", None)
    expected_payload = sha256_json(body)
    if integrity.get("payload_sha256") != expected_payload:
        raise FixtureError("evidence_integrity_failed", "Evidence payload digest does not match", invalid_value=integrity.get("payload_sha256"), expected=expected_payload)
    previous_by_attempt: dict[str, str] = {}
    for event in bundle.get("events", []):
        attempt_id = event["attempt_id"]
        previous = previous_by_attempt.get(attempt_id, "0" * 64)
        event_body = {key: event[key] for key in ("event_id", "attempt_id", "seq", "occurred_at", "native", "normalized", "previous_sha256")}
        if event.get("previous_sha256") != previous or event.get("sha256") != sha256_json(event_body):
            raise FixtureError("event_integrity_failed", f"Event hash chain failed at {event.get('event_id')}", invalid_value=event.get("event_id"))
        previous_by_attempt[attempt_id] = event["sha256"]
    if integrity.get("event_chain_heads") != previous_by_attempt:
        raise FixtureError("event_integrity_failed", "Event chain heads do not match", invalid_value=integrity.get("event_chain_heads"), expected=previous_by_attempt)


def run_self_test(output_root: str | os.PathLike[str]) -> dict[str, Any]:
    root = validate_output_root(output_root)
    checks = validate_descriptors(Path(__file__).parent)
    session_id = stable_id("session", "school-a", "alice", "self-test")
    attempt_id = stable_id("attempt", session_id, "start-1")
    orchestrator = FakeOrchestrator(root)
    start = orchestrator.start(session_id=session_id, attempt_id=attempt_id)
    checks.append({"id": "orchestrator.start", "status": "ok", "message": "one synthetic runtime and Git workspace created"})
    store = EvidenceStore(root)
    try:
        fixed_time = "2000-01-01T00:00:00Z"
        store.add_attempt({"attempt_id": attempt_id, "scenario_id": "B1", "principal_id": "alice", "tenant_id": "school-a", "requested_state": "running", "accepted_state": "accepted", "observed_state": start["observed_state"], "terminal_state": start["terminal_state"], "correlation_id": stable_id("correlation", attempt_id), "recorded_at": fixed_time})
        store.add_event(event_id=stable_id("event", attempt_id, "1"), attempt_id=attempt_id, seq=1, occurred_at=fixed_time, native={"kind": "text", "text": "synthetic"}, normalized={"type": "message.delta", "text": "synthetic"})
        policy = PolicyFixture().decide(principal_id="alice", tenant_id="school-a", capability="read_value")
        store.add_policy_decision(decision_id=stable_id("decision", attempt_id, "1"), attempt_id=attempt_id, decision=policy, operation={"capability": "read_value", "path": str(root / "workspaces")}, decided_at=fixed_time)
        store.add_artifact(artifact_id=stable_id("artifact", attempt_id, "1"), attempt_id=attempt_id, media_type="text/plain", content=b"synthetic artifact\n", captured_at=fixed_time)
        store.add_native_binding(binding_id=stable_id("binding", attempt_id, "1"), attempt_id=attempt_id, binding_type="runtime", native_id=start["runtime_id"], available=True, recorded_at=fixed_time)
        result = store.write_bundle(scenario_id="B1", subject="fixture-self-test", generated_at="2000-01-01T00:00:00Z")
        verify_bundle(result["bundle"])
        checks.append({"id": "evidence.integrity", "status": "ok", "message": "SQLite evidence and sanitized hash-chained bundle verified"})
    finally:
        store.close()
    stopped = orchestrator.stop(runtime_id=start["runtime_id"])
    if not stopped["workspace_removed"]:
        raise SystemFixtureError("cleanup_failed", "Self-test workspace was not removed")
    checks.append({"id": "orchestrator.cleanup", "status": "ok", "message": "target runtime and workspace removed by lifecycle owner"})
    return {"schema_version": SCHEMA_VERSION, "fixture_id": FIXTURE_ID, "checks": checks, "summary": {"ok": len(checks), "warn": 0, "fail": 0}, "artifacts": {"database": str(store.path), "bundle": result["path"]}}
