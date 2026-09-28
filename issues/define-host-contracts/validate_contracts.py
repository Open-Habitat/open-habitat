#!/usr/bin/env python3
"""Offline JSON Schema and cross-fixture validation for host contract v1."""
from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime
from uuid import UUID
from referencing import Registry, Resource
from jsonschema import Draft202012Validator, FormatChecker, ValidationError

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "contracts" / "v1"
SCHEMA_FILES = sorted(BASE.glob("*.schema.json"))

format_checker = FormatChecker()

@format_checker.checks("date-time")
def valid_datetime(value: object) -> bool:
    if not isinstance(value, str):
        return True
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.tzinfo is not None
    except ValueError:
        return False

@format_checker.checks("uuid")
def valid_uuid(value: object) -> bool:
    if not isinstance(value, str):
        return True
    try:
        UUID(value)
        return True
    except ValueError:
        return False

schemas = {}
registry = Registry()
for path in SCHEMA_FILES:
    data = json.loads(path.read_text())
    Draft202012Validator.check_schema(data)
    schemas[path.name] = data
    registry = registry.with_resource(data["$id"], Resource.from_contents(data))

checks = {
    "snapshot.json": "snapshot.schema.json",
    "command-request.json": "command.schema.json",
    "command-result.json": "command.schema.json",
    "github-disconnect-request.json": "command.schema.json",
    "error.json": "error.schema.json",
    "origin-error.json": "error.schema.json",
    "operation-partial.json": "operation.schema.json",
    "annotations.json": "annotations.schema.json",
    "history-page.json": "history.schema.json",
    "title-failure.json": "command.schema.json",
    "pi-status.json": "pi-status.schema.json",
    "pi-attempt.json": "pi-attempt.schema.json",
}
for fixture, schema in checks.items():
    instance = json.loads((BASE / "examples" / fixture).read_text())
    Draft202012Validator(schemas[schema], registry=registry, format_checker=format_checker).validate(instance)

exchanges = json.loads((BASE / "examples" / "exchanges.json").read_text())
Draft202012Validator(schemas["exchange.schema.json"], registry=registry, format_checker=format_checker).validate(exchanges)
for exchange in exchanges:
    request_file = exchange["request"].get("body_file")
    if request_file:
        assert (BASE / "examples" / request_file).is_file(), f"missing exchange request body {request_file}"
    response_file = exchange["response"]["body_file"]
    assert (BASE / "examples" / response_file).is_file(), f"missing exchange response body {response_file}"


events = json.loads((BASE / "examples" / "events.json").read_text())
event_validator = Draft202012Validator(schemas["event.schema.json"], registry=registry, format_checker=format_checker)
for event in events:
    event_validator.validate(event)
for previous, current in zip(events, events[1:]):
    assert current["server_instance_id"] == previous["server_instance_id"]
    assert current["sequence"] == previous["sequence"] + 1
    assert current["cursor"].endswith(f":{current['sequence']}")

scenarios = json.loads((BASE / "scenarios.json").read_text())
Draft202012Validator(schemas["scenario.schema.json"], registry=registry, format_checker=format_checker).validate(scenarios)
ids = [scenario["id"] for scenario in scenarios]
assert len(ids) == len(set(ids)), "scenario IDs must be unique"
for scenario in scenarios:
    for fixture in scenario.get("fixtures", []):
        assert (BASE / fixture).is_file(), f"missing fixture {fixture}"

required_coverage = {
    "two users", "cross-user denial", "snapshot/SSE race", "replay expiry", "gap", "resnapshot",
    "duplicate command", "uncertain command", "browser loss", "daemon loss", "TUI read-only", "transfer",
    "malformed/untrusted content", "long output", "title failure", "regeneration", "path escape",
    "partial host operation", "annotation corruption", "CSRF", "origin denial",
    "confirmation mismatch", "question resolution", "session expiry during SSE",
    "schema version rejection", "Last-Event-ID reconnect", "empty account create",
    "user observation token", "native GitHub disconnect"
}
covered = {label for scenario in scenarios for label in scenario["covers"]}
missing = required_coverage - covered
assert not missing, f"missing required scenario coverage: {sorted(missing)}"

# Negative checks prove important rejection boundaries, not only happy fixtures.
def must_reject(schema: str, instance: object) -> None:
    try:
        Draft202012Validator(schemas[schema], registry=registry, format_checker=format_checker).validate(instance)
    except ValidationError:
        return
    raise AssertionError(f"{schema} unexpectedly accepted negative fixture: {instance!r}")

bad_snapshot = json.loads((BASE / "examples" / "snapshot.json").read_text())
del bad_snapshot["workspaces"][0]["observation_token"]
must_reject("snapshot.schema.json", bad_snapshot)

bad_event = dict(events[0])
bad_event["emitted_at"] = "not-a-date"
must_reject("event.schema.json", bad_event)

bad_create = json.loads((BASE / "examples" / "command-request.json").read_text())
bad_create.update({"kind": "workspace.create", "target": {"workspace_id": "ws_example123"}, "arguments": {"name": "-unsafe", "git": False}})
must_reject("command.schema.json", bad_create)

bad_content = {"media_type": "text/plain", "text": "partial", "complete": False}
try:
    Draft202012Validator(
        {"$ref": "https://native-agent-host.invalid/contracts/v1/common.schema.json#/$defs/content"},
        registry=registry,
        format_checker=format_checker,
    ).validate(bad_content)
except ValidationError:
    pass
else:
    raise AssertionError("content schema accepted an incomplete, non-truncated value without continuation")

print(f"Host contracts valid: {len(SCHEMA_FILES)} schemas, {len(checks) + 2} fixture files, {len(scenarios)} scenarios, 4 negative checks.")
