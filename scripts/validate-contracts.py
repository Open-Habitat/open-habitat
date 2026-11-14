#!/usr/bin/env python3
"""Offline JSON Schema and cross-fixture validation for host contract v1."""
from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime
from uuid import UUID
from referencing import Registry, Resource
from jsonschema import Draft202012Validator, FormatChecker, ValidationError

ROOT = Path(__file__).resolve().parents[1]
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
    "account-preferences.json": "account-preferences.schema.json",
    "site-language.json": "site-language.schema.json",
    "account-keys.json": "account-keys.schema.json",
    "account-keys-none.json": "account-keys.schema.json",
    "own-machines.json": "own-machines.schema.json",
    "own-machines-off.json": "own-machines.schema.json",
    "first-route.json": "first-route.schema.json",
    "editor-file-read.json": "workspace-editor-files.schema.json",
    "editor-file-save.json": "workspace-editor-files.schema.json",
    "editor-file-list.json": "workspace-editor-files.schema.json",
    "editor-file-stat.json": "workspace-editor-files.schema.json",

    "agent-history-list.json": "agent-history-list.schema.json",

    "notice.json": "notice.schema.json",
    "notice-full-quota.json": "notice.schema.json",
    "agent-environment.json": "agent-environment.schema.json",
    "agent-environment-not-in-use.json": "agent-environment.schema.json",
    "agent-workspaces.json": "agent-workspaces.schema.json",
    "agent-conversation.json": "agent-conversation.schema.json",

    "workspace-git.json": "workspace-git.schema.json",
    "workspace-icon-suggestions.json": "workspace-icon-suggestions.schema.json",
    "workspace-icon-suggestions-failed.json": "workspace-icon-suggestions.schema.json",
    "terminal-list.json": "terminal.schema.json",
    "workspace-deletion-check.json": "workspace-deletion.schema.json",
    "workspace-trash.json": "workspace-deletion.schema.json",
    "directory-restored.json": "workspace-deletion.schema.json",
    "workspace-trash-emptied.json": "workspace-deletion.schema.json",
    "workspace-worktrees.json": "workspace-worktrees.schema.json",
    "workspace-worktrees-cleaned.json": "workspace-worktrees.schema.json",
    "attachments.json": "attachments.schema.json",
    "pi-message.json": "pi-message.schema.json",
    "pi-held.json": "pi-held.schema.json",
    "turn-mark.json": "turn-mark.schema.json",
    "turn-mark-not-now.json": "turn-mark.schema.json",
    "process-inventory.json": "process.schema.json",
    "process-output.json": "process.schema.json",
    "process-stop.json": "process-control.schema.json",
    "process-event.json": "process-event.schema.json",
    "spinoffs.json": "spinoffs.schema.json",
    "spinoff-work.json": "spinoff-work.schema.json",
    "rest.json": "rest.schema.json",
    "snapshot.json": "snapshot.schema.json",
    "account-storage.json": "account-storage.schema.json",
    "account-storage-not-in-use.json": "account-storage.schema.json",
    "account-sessions.json": "device-link.schema.json",
    "device-link-status.json": "device-link.schema.json",
    "server-storage.json": "server-storage.schema.json",
    "server-storage-not-in-use.json": "server-storage.schema.json",
    "server-conversations.json": "server-conversations.schema.json",
    "conversation-capacity.json": "conversation-capacity.schema.json",
    "server-access.json": "server-access.schema.json",
    "server-access-change.json": "server-access.schema.json",
    "server-access-changed.json": "server-access.schema.json",
    "server-access-lookup.json": "server-access.schema.json",
    "server-access-role.json": "server-access.schema.json",
    "server-integrations.json": "server-integrations.schema.json",
    "server-integrations-set.json": "server-integrations.schema.json",
    "server-integrations-clear.json": "server-integrations.schema.json",
    "server-onboarding.json": "server-onboarding.schema.json",
    "server-onboarding-change.json": "server-onboarding.schema.json",
    "server-onboarding-site-key.json": "server-onboarding.schema.json",
    "server-onboarding-site-key-delete.json": "server-onboarding.schema.json",
    "server-onboarding-site-key-copies.json": "server-onboarding.schema.json",
    "server-onboarding-site-key-check.json": "server-onboarding.schema.json",
    "server-onboarding-site-key-seed.json": "server-onboarding.schema.json",
    "server-onboarding-site-key-rotation.json": "server-onboarding.schema.json",
    "site-onboarding.json": "site-onboarding.schema.json",
    "server-storage-change.json": "server-storage-change.schema.json",
    "server-conversations-change.json": "server-conversations-change.schema.json",
    "command-request.json": "command.schema.json",
    "command-result.json": "command.schema.json",
    "github-disconnect-request.json": "command.schema.json",
    "error.json": "error.schema.json",
    "origin-error.json": "error.schema.json",
    "operation-partial.json": "operation.schema.json",
    "annotations.json": "annotations.schema.json",
    "history-page.json": "history.schema.json",
    "recap.json": "recap.schema.json",
    "rewind-preview.json": "rewind.schema.json",
    "rewind-request.json": "rewind.schema.json",
    "rewind-result.json": "rewind.schema.json",
    "context-detail.json": "context-detail.schema.json",
    "compaction-request.json": "compaction.schema.json",
    "compaction-result.json": "compaction.schema.json",
    "title-failure.json": "command.schema.json",
    "claude-login.json": "claude-login.schema.json",
    "pi-status.json": "pi-status.schema.json",
    "pi-attempt.json": "pi-attempt.schema.json",
    "agent-pi-attempt.json": "pi-attempt.schema.json",
    "pi-models.json": "pi-models.schema.json",
    "recap-settings.json": "recap-settings.schema.json",
    "recap-settings-update.json": "recap-settings.schema.json",
    "pi-conversation-create.json": "pi-conversation-create.schema.json",
    "workspace-change.json": "workspace-change.schema.json",
    "github-repos.json": "github-repos.schema.json",
    "github-repository.json": "github-repository.schema.json",
    "github-clones.json": "github-clone.schema.json",
    "integrations.json": "integrations.schema.json",
    "gitea-connect.json": "gitea-connection.schema.json",
    "gitea-connected.json": "gitea-connection-change.schema.json",
    "gitea-disconnected.json": "gitea-connection-change.schema.json",
    "gitea-repos.json": "gitea-repos.schema.json",
    "gitlab-connect.json": "gitlab-connection.schema.json",
    "gitlab-connected.json": "gitlab-connection-change.schema.json",
    "gitlab-checked-expired.json": "gitlab-connection-change.schema.json",
    "gitlab-disconnected.json": "gitlab-connection-change.schema.json",
    "gitlab-tokens.json": "gitlab-tokens.schema.json",
    "integration-files-roots.json": "integration-files.schema.json",
    "integration-files-folder.json": "integration-files.schema.json",
    "gitlab-repos.json": "gitlab-repos.schema.json",
    "integration-connect.json": "integration-account.schema.json",
    "integration-connected.json": "integration-change.schema.json",
    "integration-removed.json": "integration-change.schema.json",
    "integration-apple-add.json": "integration-account.schema.json",
    "integration-apple-added.json": "integration-change.schema.json",
    "integration-login-device.json": "integration-login.schema.json",
    "integration-login-paste.json": "integration-login.schema.json",
    "integration-login-folders.json": "integration-login.schema.json",
    "editor-status.json": "editor.schema.json",
    "browser-status.json": "browser.schema.json",
    "browser-stopped.json": "browser.schema.json",
    "browser-control.json": "browser.schema.json",
    "browser-agent-status.json": "browser.schema.json",
    "browser-agent-request.json": "browser.schema.json",
    "editor-handoff.json": "editor.schema.json",
    "editor-open.json": "editor.schema.json",
    "views.json": "view.schema.json",
    "view-handoff.json": "view.schema.json",
    "view-addresses.json": "view-address.schema.json",
    "view-address.json": "view-address.schema.json",
    "view-address-ensure.json": "view-address.schema.json",
    "view-address-ensure-offer.json": "view-address.schema.json",
    "view-address-publish.json": "view-address.schema.json",
    "view-address-delete.json": "view-address.schema.json",
    "view-address-open.json": "view-address.schema.json",
    "server-view-publications.json": "view-address.schema.json",
    "notice-view.json": "notice.schema.json",
    "file-offers.json": "file-offer.schema.json",
    "file-offer.json": "file-offer.schema.json",
    "notice-file-offer.json": "notice.schema.json",
    "composer-start-page.json": "composer.schema.json",
    "composer-commands.json": "composer.schema.json",
    "composer-start-page-unavailable.json": "composer.schema.json",
    "composer-files.json": "composer.schema.json",
    "composer-file-preview.json": "composer.schema.json",
    "composer-file-tree.json": "composer.schema.json",
    "composer-bash.json": "composer.schema.json",
    "speech-key.json": "speech.schema.json",
    "speech-key-update.json": "speech.schema.json",
    "speech-project-key-update.json": "speech.schema.json",
    "speech-session.json": "speech.schema.json",
    "speech-error.json": "error.schema.json",
    "server-speech-key.json": "server-speech-key.schema.json",
    "server-speech-key-set.json": "server-speech-key.schema.json",
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


clone_progress = json.loads((BASE / "examples" / "github-clone-progress.json").read_text())
for seq, frame in enumerate(clone_progress, start=1):
    Draft202012Validator(schemas["github-clone-progress.schema.json"], registry=registry, format_checker=format_checker).validate(frame)
    assert frame["sequence"] == seq
assert clone_progress[-1]["kind"] == "terminal"

events = json.loads((BASE / "examples" / "events.json").read_text())
event_validator = Draft202012Validator(schemas["event.schema.json"], registry=registry, format_checker=format_checker)
for event in events:
    event_validator.validate(event)
# The server's first replay slice emits this closed invalidation shape rather
# than structured native deltas; keep it exercised by the offline gate.
assert any(event["kind"] == "snapshot.invalidated" and event["resource"] == {"scope": "user"} and event["payload"] == {"reason": "source_changed"} for event in events)
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
    "duplicate command", "uncertain command", "browser loss", "daemon loss", "TUI read-only",
    "malformed/untrusted content", "long output", "title failure", "regeneration", "path escape",
    "partial host operation", "annotation corruption", "CSRF", "origin denial",
    "confirmation mismatch", "session expiry during SSE",
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

# Change exactly one field of a valid reply, so a newly required field
# cannot make every negative check pass for the wrong reason.
preferences_reply = json.loads((BASE / "examples/account-preferences.json").read_text())
for change in ({"engine": "monaco"}, {"uid": 123}, {"experimental": {"worker-row-sentence": False}}, {"experimental": {"../x": True}}, {"language": "sv"}, {"quiet_sort": "oldest"}, {"quiet_workspace": "../x"}, {"quiet_workspace": ""}, {"recent_count": 5}, {"github_workflow": "yes"}, {"github_workflow": None}):
    must_reject("account-preferences.schema.json", {**preferences_reply, **change})
for missing in ("language", "quiet_sort", "quiet_workspace", "github_workflow"):
    must_reject("account-preferences.schema.json", {k: v for k, v in preferences_reply.items() if k != missing})
# The pre-sign-in language names only the server's default.
must_reject("site-language.schema.json", {"schema_version": 1, "default_language": "sv"})
must_reject("site-language.schema.json", {"schema_version": 1, "default_language": "fi", "name": "Example"})

# Account keys carry public halves only: no field a private key could fill,
# no age identity in a recipient's place, and a creation names one kind.
keys = json.loads((BASE / "examples" / "account-keys.json").read_text())
must_reject("account-keys.schema.json", {**keys, "keys": [{**keys["keys"][0], "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----"}]})
must_reject("account-keys.schema.json", {**keys, "keys": [{**keys["keys"][1], "public_key": "AGE-SECRET-KEY-1QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ"}]})
must_reject("account-keys.schema.json", {**keys, "keys": [{**keys["keys"][0], "public_key": "-----BEGIN OPENSSH PRIVATE KEY-----"}]})
must_reject("account-keys.schema.json", {**keys, "keys": [{**keys["keys"][0], "fingerprint": "MD5:00"}]})
must_reject("account-keys.schema.json", {**keys, "keys": [{**keys["keys"][0], "file": "/home/someone/.ssh/id_ed25519"}]})
must_reject("account-keys.schema.json", {**keys, "missing": [{"kind": "ssh", "file": "~/.ssh/id_rsa", "can_create": True}]})
keys_create = Draft202012Validator({"$ref": schemas["account-keys.schema.json"]["$id"] + "#/$defs/create"}, registry=registry)
keys_create.validate({"kind": "age"})
for bad in ({}, {"kind": "rsa"}, {"kind": "ssh", "file": "~/.ssh/other"}):
    assert not keys_create.is_valid(bad), f"key creation accepted {bad!r}"

# Own machines: the login link is Tailscale's own, an address is a tailnet
# address, and a request names a new machine only by its tailnet name.
browser = json.loads((BASE / "examples" / "browser-status.json").read_text())
must_reject("browser.schema.json", {**browser, "windows": [{**browser["windows"][0], "origin": "https://login.example.invalid/path?token=x"}]})
must_reject("browser.schema.json", {**browser, "windows": [{**browser["windows"][0], "url": "https://login.example.invalid/"}]})
must_reject("browser.schema.json", {**browser, "pointer": {**browser["pointer"], "x": 1.5}})
must_reject("browser.schema.json", {"schema_version": 1, "state": "running", "agent_connected": False, "windows": [], "cdp_endpoint": "ws://127.0.0.1:9222/devtools/browser"})
machines = json.loads((BASE / "examples" / "own-machines.json").read_text())
must_reject("own-machines.schema.json", {**machines, "tailscale": {"state": "login", "auth_url": "https://evil.example/a/x"}})
must_reject("own-machines.schema.json", {**machines, "tailscale": {"state": "login", "auth_url": "https://login.tailscale.com/a/x?next=https://evil.example"}})
must_reject("own-machines.schema.json", {**machines, "machines": [{**machines["machines"][0], "address": "192.168.1.10"}]})
must_reject("own-machines.schema.json", {**machines, "account_key": {"file": "~/.ssh/id_ed25519", "fingerprint": machines["account_key"]["fingerprint"], "private_key": "x"}})
must_reject("own-machines.schema.json", {**machines, "grant": {**machines["grant"], "line": machines["grant"]["line"].replace("restrict,", "")}})
# A line without an end is the default; a dated one names its day.
dated = machines["grant"]["line"].replace('" ssh-ed25519', '",expiry-time="20261128" ssh-ed25519', 1)
Draft202012Validator(schemas["own-machines.schema.json"], registry=registry, format_checker=format_checker).validate({**machines, "grant": {**machines["grant"], "expires": "2026-11-28", "line": dated}})
must_reject("own-machines.schema.json", {**machines, "grant": {**machines["grant"], "line": dated.replace('expiry-time="20261128"', 'expiry-time="2026"')}})
must_reject("own-machines.schema.json", {**machines, "machines": [{**machines["machines"][0], "expires": "never"}]})
machines_request = Draft202012Validator({"$ref": schemas["own-machines.schema.json"]["$id"] + "#/$defs/request"}, registry=registry)
for good in ({"action": "connect"}, {"action": "grant", "peer": "alice-macbook", "user": "alice", "days": 30}, {"action": "grant", "peer": "alice-macbook", "user": "alice", "days": 0}, {"action": "extend", "machine": "alice-macbook", "expires": ""}, {"action": "save", "peer": "alice-macbook", "user": "alice", "expires": "2026-11-28", "host_key": machines["account_key"]["fingerprint"]}, {"action": "remove", "machine": "alice-macbook"}):
    machines_request.validate(good)
for bad in ({"action": "grant", "peer": "alice-macbook", "user": "alice", "days": 365}, {"action": "check", "peer": "alice-macbook", "user": "alice", "address": "100.88.14.53"}, {"action": "check", "peer": "100.88.14.53", "user": "alice"}, {"action": "remove", "machine": "../x"}, {"action": "connect", "peer": "x"}):
    assert not machines_request.is_valid(bad), f"own-machines request accepted {bad!r}"

# A turn mark is raised or Ei nyt; only Ei nyt names the reply it was said to.
turn = json.loads((BASE / "examples" / "turn-mark.json").read_text())
for mark in ({"state": "raised", "at": "2026-11-06T09:20:00Z", "reply_id": "a1"}, {"state": "seen", "at": "2026-11-06T09:20:00Z"}, {"state": "raised"}, {"state": "not_now", "at": "2026-11-06T09:20:00Z", "reply_id": ""}):
    must_reject("turn-mark.schema.json", {**turn, "turn_mark": mark})
must_reject("turn-mark.schema.json", {**turn, "agent_id": "ws_example123"})
turn_request = Draft202012Validator({"$ref": schemas["turn-mark.schema.json"]["$id"] + "#/$defs/request"}, registry=registry)
for good in ({"mark": "raised"}, {"mark": "not_now"}, {"mark": "not_now", "reply_id": "a1b2c3d4"}):
    turn_request.validate(good)
for bad in ({"mark": "raised", "reply_id": "a1"}, {"mark": "none"}, {}, {"mark": "not_now", "at": "2026-11-06T09:20:00Z"}):
    assert not turn_request.is_valid(bad), f"turn-mark request accepted {bad!r}"

# A view names its entry inside the export, never a path outside it or a
# hidden file, and its open URL is the fixed handoff on an HTTPS view host.
view = json.loads((BASE / "examples" / "views.json").read_text())["views"][1]
for entry in ["../index.html", "/index.html", ".hidden/index.html", "site/.x.html", "a//b.html", "report.js", "a\\b.html"]:
    must_reject("view.schema.json", {"schema_version": 1, "views": [{**view, "entry": entry}]})
must_reject("view.schema.json", {"schema_version": 1, "views": [{**view, "path": "/home/x/report.html"}]})
# A recorded source is an absolute path; a page names its next cursor only.
for source in ["reports/sales", "", "/home/x/a\nb"]:
    must_reject("view.schema.json", {"schema_version": 1, "views": [{**view, "source": source}]})
must_reject("view.schema.json", {"schema_version": 1, "views": [view] * 101})
must_reject("view.schema.json", {"schema_version": 1, "views": [], "next_cursor": "vbcdefghijklmnopqrstuvwxyza"})
must_reject("view.schema.json", {"schema_version": 1, "url": "http://oh-view-a.example.invalid/_open-habitat/handoff?token=" + "A" * 43})
must_reject("view.schema.json", {"schema_version": 1, "url": "https://oh-view-a.example.invalid/index.html"})
# An address is reserved for a view, changed by its ID alone, and never
# moved to another view or given a new secret. Its entry URL is the app's
# path under /n/, its content URL only a host and the token, and the
# administrator's list never carries either.
must_reject("view-address.schema.json", {"view_id": "vabcdefghijklmnopqrstuvwxyz", "days": 30})
must_reject("view-address.schema.json", {"view_id": "vabcdefghijklmnopqrstuvwxyz", "offer_id": "fabcdefghijklmnopqrstuvwxyz"})
must_reject("view-address.schema.json", {"offer_id": "vabcdefghijklmnopqrstuvwxyz"})
must_reject("view-address.schema.json", {"address_id": "aabcdefghijklmnopqrstuvwxyz", "view_id": "vabcdefghijklmnopqrstuvwxyz"})
must_reject("view-address.schema.json", {"address_id": "aabcdefghijklmnopqrstuvwxyz", "new_address": True})
must_reject("view-address.schema.json", {"address_id": "aabcdefghijklmnopqrstuvwxyz", "days": 366})
must_reject("view-address.schema.json", {"entry": "https://example.invalid/n/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"})
must_reject("view-address.schema.json", {"entry": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "view_id": "vabcdefghijklmnopqrstuvwxyz"})
must_reject("view-address.schema.json", {"link_id": "labcdefghijklmnopqrstuvwxyz", "days": 30})
address_reply = json.loads((BASE / "examples" / "view-address.json").read_text())
address = address_reply["address"]
must_reject("view-address.schema.json", {**address_reply, "address": {**address, "url": address["content_url"]}})
must_reject("view-address.schema.json", {**address_reply, "address": {**address, "url": address["url"] + "/index.html"}})
must_reject("view-address.schema.json", {**address_reply, "address": {**address, "content_url": "http://oh-view-a.example.invalid/" + "A" * 43 + "/"}})
must_reject("view-address.schema.json", {**address_reply, "address": {**address, "content_url": "https://oh-view-a.example.invalid/" + "A" * 43 + "/index.html"}})
must_reject("view-address.schema.json", {**address_reply, "address": {k: v for k, v in address.items() if k != "public_until"}})
must_reject("view-address.schema.json", {**address_reply, "address": {**address, "state": "private"}})
must_reject("view-address.schema.json", {**address_reply, "address": {**address, "state": "revoked"}})
must_reject("view-address.schema.json", {**address_reply, "address": {**address, "offer_id": "fabcdefghijklmnopqrstuvwxyz"}})
must_reject("view-address.schema.json", {**address_reply, "address": {k: v for k, v in address.items() if k != "view_id"}})
admin_publications = json.loads((BASE / "examples" / "server-view-publications.json").read_text())
for field in ["url", "content_url", "token"]:
    must_reject("view-address.schema.json", {**admin_publications, "publications": [{**admin_publications["publications"][0], field: address.get(field, "A" * 43)}]})

# An offered file is named inside its offer, never by a path outside it, a
# hidden name or a home path, and a notice carries at most one offer.
offer_manifest = json.loads((BASE / "examples" / "file-offer.json").read_text())
item = offer_manifest["items"][0]
for bad in ["../x.md", "/etc/passwd", ".ssh/id", "a/.git/config", "a//b", "a/", "a\\b", "a\nb"]:
    must_reject("file-offer.schema.json", {**offer_manifest, "items": [{**item, "path": bad}]})
must_reject("file-offer.schema.json", {**offer_manifest, "items": [{**item, "kind": "html"}]})
must_reject("file-offer.schema.json", {**offer_manifest, "offer": {**offer_manifest["offer"], "path": "/home/x/out"}})
must_reject("file-offer.schema.json", {**offer_manifest, "offer": {**offer_manifest["offer"], "folder": "a/b"}})
notice_offer = json.loads((BASE / "examples" / "notice-file-offer.json").read_text())
must_reject("notice.schema.json", {**notice_offer, "notice": {**notice_offer["notice"], "view": json.loads((BASE / "examples" / "views.json").read_text())["views"][0]}})

# A deletion request names an entry, never a path.
must_reject("workspace-deletion.schema.json", {"action": "trash_restore", "entry": "../x"})
must_reject("workspace-deletion.schema.json", {"action": "delete", "workspace_id": "ws_example123", "observation_token": "obs_example123", "disposal": "shred"})
must_reject("workspace-deletion.schema.json", {"action": "trash_empty"})
must_reject("editor.schema.json", {"workspace_id": "ws_example123", "path": "a.go", "folder": "/home/x"})
must_reject("editor.schema.json", {"schema_version": 1, "token": "short", "origin": "https://code.example.invalid"})
must_reject("workspace-deletion.schema.json", {"action": "trash_empty", "listing_token": "0" * 64, "entry": "x"})
# An unreadable authored page is distinct from absence, without native details.
must_reject("composer.schema.json", {"schema_version": 1, "answered_by": "helper", "commands": [], "start_page": {"state": "needs_update", "reason": "private native error"}})
# The composer names files relative to the workspace and lists commands
# without their native source paths.
must_reject("composer.schema.json", {"schema_version": 1, "workspace_id": "ws_example123", "path": "../secret", "kind": "text", "text": "", "truncated": False})
must_reject("composer.schema.json", {"schema_version": 1, "workspace_id": "ws_example123", "files": [{"path": "/etc/passwd"}], "truncated": False})
must_reject("composer.schema.json", {"schema_version": 1, "workspace_id": "ws_example123", "files": [{"path": "a/./b"}], "truncated": False})
must_reject("composer.schema.json", {"schema_version": 1, "answered_by": "helper", "commands": [{"name": "review", "description": "", "source": "prompt", "scope": "user", "terminal_only": False, "path": "/home/x/.pi/agent/prompts/review.md"}]})
must_reject("composer.schema.json", {"command": "ls", "command_id": "4f6c2a9e-1d3b-4c8a-9e7f-0a1b2c3d4e5f", "cwd": "/"})
# A worktree removal names a registry entry, never a path, and only a forced
# removal carries the typed name.
must_reject("workspace-worktrees.schema.json", {"action": "worktree_remove", "workspace_id": "ws_example123", "entry": "../x", "observation_token": "wt_" + "A" * 24, "disposal": "remove"})
must_reject("workspace-worktrees.schema.json", {"action": "worktree_remove", "workspace_id": "ws_example123", "entry": "x", "observation_token": "wt_" + "A" * 24, "disposal": "force"})
must_reject("workspace-worktrees.schema.json", {"action": "worktree_remove", "workspace_id": "ws_example123", "entry": "x", "observation_token": "wt_" + "A" * 24, "disposal": "remove", "confirmation": "x"})
must_reject("workspace-worktrees.schema.json", {"action": "worktree_remove", "workspace_id": "ws_example123", "entry": "x", "observation_token": "wt_" + "A" * 24, "disposal": "remove", "path": "/home/x"})

# The person-side onboarding read never carries the site's default
# repositories or their number; the administrator's read and change are
# bounded by GitHub's name grammar and at most 20 defaults.
site_onboarding = json.loads((BASE / "examples" / "site-onboarding.json").read_text())
must_reject("site-onboarding.schema.json", {**site_onboarding, "repositories": {"mode": "auto", "defaults": ["example-org/infra"]}})
must_reject("site-onboarding.schema.json", {**site_onboarding, "repositories": {"mode": "auto", "default_count": 2}})
must_reject("site-onboarding.schema.json", {**site_onboarding, "defaults": ["example-org/infra"]})
# The site AI key is read back only as provider, suffix and time, is set
# only as one literal key, and delete names the replacement offer.
site_key = json.loads((BASE / "examples" / "server-onboarding-site-key.json").read_text())
must_reject("server-onboarding.schema.json", {**site_key, "site_key": {**site_key["site_key"], "key": "sk-" + "a" * 30}})
must_reject("server-onboarding.schema.json", {**site_key, "site_key": {**site_key["site_key"], "suffix": "sk-ant-a"}})
must_reject("server-onboarding.schema.json", {"provider": "openai", "key": "!cat ~/.ssh/id_ed25519"})
must_reject("server-onboarding.schema.json", {"provider": "openai", "key": "$OPENAI_API_KEY"})
must_reject("server-onboarding.schema.json", {"offer": "site_key"})
must_reject("site-onboarding.schema.json", {**site_onboarding, "site_key": site_key["site_key"]})
# Giving the key to joined people: the administrator sees one word about a
# person's Pi, never the kind or a part of their own credential; the copies
# record and every reply name a given key only as provider and suffix; a
# write names the reviewed key, never carries one.
copies = json.loads((BASE / "examples" / "server-onboarding-site-key-copies.json").read_text())
given = copies["people"][1]
must_reject("server-onboarding.schema.json", {**copies, "people": [{**given, "copy": {**given["copy"], "fingerprint": "0" * 64}}]})
must_reject("server-onboarding.schema.json", {**copies, "people": [{**given, "credential": "subscription"}]})
must_reject("server-onboarding.schema.json", {"schema_version": 1, "subject": "1002", "state": "subscription"})
must_reject("server-onboarding.schema.json", {"schema_version": 1, "subject": "1002", "state": "own", "suffix": "k9Lw"})
must_reject("server-onboarding.schema.json", {"subject": "1002", "provider": "anthropic", "suffix": "Xa1b", "set_at": "2026-10-24T09:00:00Z", "key": "sk-ant-" + "a" * 30})
must_reject("server-onboarding.schema.json", {"subject": "1002", "provider": "anthropic", "key": "sk-ant-" + "a" * 30})
must_reject("server-onboarding.schema.json", {"subject": "example-person"})
must_reject("server-onboarding.schema.json", {"schema_version": 1, "subject": "1002", "outcome": "overwritten"})
must_reject("site-onboarding.schema.json", {**site_onboarding, "site_key_copy": {**given["copy"], "key": "sk-ant-" + "a" * 30}})
# The seed is a fact of the creating sign-in, never a negative or a value to choose.
must_reject("site-onboarding.schema.json", {**site_onboarding, "ai_key_seeded": False})
must_reject("site-onboarding.schema.json", {**site_onboarding, "ai_key_seeded": "seeded"})
# The first-route mark is only ever finished, and names no path or other person.
must_reject("first-route.schema.json", {"schema_version": 1, "web_identity_id": "wid_example-a", "finished": True, "path": "/home/x"})
must_reject("server-access.schema.json", {"id": "43", "login": "example-person"})
must_reject("server-access.schema.json", {"login": "-bad"})
must_reject("server-access.schema.json", {"subject": "43", "administrator": True})
must_reject("server-access.schema.json", {"id": "43", "administrator": "yes"})
# A folder read stays inside a synced folder under ~/cloud and names plain entries.
must_reject("integration-files.schema.json", {"schema_version": 1, "roots": [{"provider": "microsoft", "address": "person@work.example.test", "service": "onedrive", "directory": "~/.ssh"}]})
must_reject("integration-files.schema.json", {"schema_version": 1, "directory": "~/cloud/onedrive/person@work.example.test", "folder": "a/../../.ssh", "entries": [], "truncated": False})
must_reject("integration-files.schema.json", {"schema_version": 1, "directory": "~/cloud/onedrive/person@work.example.test", "entries": [{"name": "a/b", "kind": "file", "modified_at": "2026-11-06T08:42:00Z"}], "truncated": False})
must_reject("integration-files.schema.json", {"schema_version": 1, "directory": "~/cloud/onedrive/person@work.example.test", "entries": [{"name": "..", "kind": "folder", "modified_at": "2026-11-06T08:42:00Z"}], "truncated": False})
must_reject("integration-files.schema.json", {"schema_version": 1, "roots": [], "entries": [], "truncated": False})
# A secret never comes back in a list, and a set names only its provider's fields.
must_reject("server-integrations.schema.json", {"schema_version": 1, "browser_setup": True, "apps": [{"provider": "google", "client_id": "1-a.apps.googleusercontent.com", "client_secret": "x", "usable": True, "source": "operator"}]})
must_reject("server-integrations.schema.json", {"provider": "google", "fields": {"client_id": "a", "client_secret": "b", "tenant_id": "c"}})
must_reject("server-integrations.schema.json", {"provider": "imap"})
must_reject("server-administration-change.schema.json", {"subject": "43", "administrator": True})
must_reject("server-administration-change.schema.json", {"default_language": "sv"})
must_reject("server-administration-change.schema.json", {"default_language": "fi", "name": "Example"})
must_reject("site-onboarding.schema.json", {**site_onboarding, "repositories": {"mode": "auto", "imports": [f"example-org/r{i}" for i in range(21)]}})
onboarding_change = json.loads((BASE / "examples" / "server-onboarding-change.json").read_text())
must_reject("server-onboarding.schema.json", {**onboarding_change, "repositories": {"mode": "skip", "defaults": [f"example-org/r{i}" for i in range(21)]}})
must_reject("server-onboarding.schema.json", {**onboarding_change, "repositories": {"mode": "skip", "defaults": ["example-org/.."]}})
must_reject("server-onboarding.schema.json", {**onboarding_change, "repositories": {"mode": "skip", "defaults": ["https://github.com/example-org/x"]}})
must_reject("server-onboarding.schema.json", {**onboarding_change, "integrations": [{"provider": "slack", "required": False}]})
must_reject("server-onboarding.schema.json", {**onboarding_change, "ai_account": {"offer": "gemini"}})
must_reject("server-onboarding.schema.json", {k: v for k, v in onboarding_change.items() if k != "expected_version"})

# Speech input: the person's key is read back as presence, region, source
# and suffix only, saved as one literal key, and the only token that
# crosses is one dictation's temporary key with the fixed ceiling.
speech_key = json.loads((BASE / "examples" / "speech-key.json").read_text())
must_reject("speech.schema.json", {**speech_key, "key": "example0000000000000000000000Ab12"})
must_reject("speech.schema.json", {**speech_key, "suffix": "example0000000000000000000000Ab12"})
must_reject("speech.schema.json", {"key": "$SONIOX_API_KEY"})
# The region is found from Soniox, never chosen by the browser.
must_reject("speech.schema.json", {"key": "example0000000000000000000000Ab12", "region": "eu"})
# A project key is dot-joined runs; no empty run, no run shorter than the
# shown suffix at the end, at most four runs, at most 256 characters.
for bad in ["snx_proj_0000000000000000.", ".snx_proj_0000000000000000", "snx_proj_00000000..0000000000",
            "snx_proj_0000000000000000000.ab", "a.b.c.d.e0000000000000", "snx_proj_" + "A" * 248]:
    must_reject("speech.schema.json", {"key": bad})
    must_reject("server-speech-key.schema.json", {"key": bad})
must_reject("speech.schema.json", {"key": "example0000000000000000000000Ab12", "source": "site"})
speech_session = json.loads((BASE / "examples" / "speech-session.json").read_text())
must_reject("speech.schema.json", {**speech_session, "max_session_seconds": 1800})
must_reject("speech.schema.json", {**speech_session, "websocket_url": "https://stt-rt.soniox.com/transcribe-websocket"})
must_reject("speech.schema.json", {**speech_session, "websocket_url": "wss://user:key@stt-rt.soniox.com/x"})
must_reject("speech.schema.json", {**speech_session, "region_key": "example0000000000000000000000Ab12"})
# The site Soniox key reads back as region and suffix; a set reply counts
# answers and names nobody.
server_speech = json.loads((BASE / "examples" / "server-speech-key.json").read_text())
must_reject("server-speech-key.schema.json", {**server_speech, "site_key": {**server_speech["site_key"], "key": "example0000000000000000000000Kq7Z"}})
must_reject("server-speech-key.schema.json", {**server_speech, "given": {"seeded": 1, "people": ["43"]}})
must_reject("server-speech-key.schema.json", {**server_speech, "given": {"own": 1}})
must_reject("server-speech-key.schema.json", {"region": "eu", "key": "example0000000000000000000000Kq7Z"})

terminal_validator = Draft202012Validator(schemas["terminal.schema.json"], registry=registry, format_checker=format_checker)
for message in json.loads((BASE / "examples" / "terminal-messages.json").read_text()):
    terminal_validator.validate(message)
# A shell is named by its number and a Taskfleet window by its token, never
# by a path, socket or session; a listed shell carries no directory.
must_reject("terminal.schema.json", {"workspace_id": "ws_example123", "shell": "../x"})
must_reject("terminal.schema.json", {"workspace_id": "ws_example123", "shell": "0"})
must_reject("terminal.schema.json", {"type": "ready", "taskfleet": "/run/user/1000/taskfleet/tmux-0.sock", "read_only": True, "survives_restart": False})
bad_terminals = json.loads((BASE / "examples" / "terminal-list.json").read_text())
bad_terminals["shells"][0]["cwd"] = "/home/x/src/monorepo"
must_reject("terminal.schema.json", bad_terminals)

bad_snapshot = json.loads((BASE / "examples" / "snapshot.json").read_text())
del bad_snapshot["workspaces"][0]["observation_token"]
must_reject("snapshot.schema.json", bad_snapshot)

# A base comparison names its source; an unknown rule is not a base.
bad_git = json.loads((BASE / "examples" / "workspace-git.json").read_text())
bad_git["base"]["source"] = "guessed"
must_reject("workspace-git.schema.json", bad_git)

# A failed suggestion carries no suggestions, and done carries no reason.
bad_icons = json.loads((BASE / "examples" / "workspace-icon-suggestions.json").read_text())
bad_icons["state"] = "failed"
bad_icons["reason"] = "model_timeout"
must_reject("workspace-icon-suggestions.schema.json", bad_icons)

bad_event = dict(events[0])
bad_event["emitted_at"] = "not-a-date"
must_reject("event.schema.json", bad_event)

bad_create = json.loads((BASE / "examples" / "command-request.json").read_text())
bad_create.update({"kind": "workspace.create", "target": {"workspace_id": "ws_example123"}, "arguments": {"name": "-unsafe", "git": False}})
must_reject("command.schema.json", bad_create)

bad_clone_progress = dict(clone_progress[2])
bad_clone_progress["message"] = "untrusted native stderr"
must_reject("github-clone-progress.schema.json", bad_clone_progress)
bad_clone_progress = dict(clone_progress[-1])
bad_clone_progress["schema_version"] = 2
must_reject("github-clone-progress.schema.json", bad_clone_progress)

# A clone action names a repository or job, never a path; a failed job says
# what happened to its directory.
must_reject("github-clone.schema.json", {"action": "remove", "full_name": "example-org/../x"})
must_reject("github-clone.schema.json", {"action": "remove", "full_name": "example-org/monorepo", "path": "/home/x/src/monorepo"})
must_reject("github-clone.schema.json", {"action": "start", "full_name": "example-org/monorepo", "mode": "shallow"})
bad_clones = json.loads((BASE / "examples" / "github-clones.json").read_text())
del bad_clones["jobs"][1]["leftover"]
must_reject("github-clone.schema.json", bad_clones)
# A planned default says why its start was refused, and only then.
bad_clones = json.loads((BASE / "examples" / "github-clones.json").read_text())
del bad_clones["planned"][1]["reason"]
must_reject("github-clone.schema.json", bad_clones)
bad_clones = json.loads((BASE / "examples" / "github-clones.json").read_text())
bad_clones["planned"][0]["reason"] = "quota_full"
must_reject("github-clone.schema.json", bad_clones)
bad_repos = json.loads((BASE / "examples" / "github-repos.json").read_text())
bad_repos["repositories"][0]["default"] = "forced"
must_reject("github-repos.schema.json", bad_repos)
bad_clone_progress = dict(clone_progress[-1])
bad_clone_progress.update({"outcome": "failed", "reason": "native_failure"})
must_reject("github-clone-progress.schema.json", bad_clone_progress)
must_reject("github-checkout.schema.json", {"schema_version": 1, "full_name": "example-org/monorepo", "state": "interrupted"})
must_reject("github-repository.schema.json", {"schema_version": 1, "full_name": "example-org/monorepo", "state": "found"})

bad_content = {"media_type": "text/plain", "text": "partial", "complete": False}
try:
    Draft202012Validator(
        {"$ref": "https://open-habitat.invalid/contracts/v1/common.schema.json#/$defs/content"},
        registry=registry,
        format_checker=format_checker,
    ).validate(bad_content)
except ValidationError:
    pass
else:
    raise AssertionError("content schema accepted an incomplete, non-truncated value without continuation")


rewind_request = json.loads((BASE / "examples" / "rewind-request.json").read_text())
must_reject("rewind.schema.json", {**rewind_request, "conversation": False, "files": False})
must_reject("rewind.schema.json", {**rewind_request, "entry_key": "../x"})
must_reject("compaction.schema.json", {"instructions": "x" * 2001})
must_reject("compaction.schema.json", {"instructions": "x", "keep_recent_tokens": 1})
recap_settings = json.loads((BASE / "examples" / "recap-settings.json").read_text())
must_reject("recap-settings.schema.json", {**recap_settings, "settings": {**recap_settings["settings"], "delay_seconds": 30}})
must_reject("recap-settings.schema.json", {**recap_settings, "settings": {**recap_settings["settings"], "mode": "manual"}})
must_reject("recap-settings.schema.json", {**recap_settings["settings"], "model": "fixture/fake"})
must_reject("recap-settings.schema.json", {**recap_settings["settings"], "words": 200})
must_reject("pi-models.schema.json", {"schema_version":1,"default_provider":None,"default_model":None,"models":[{"id":"example","name":"Example","outcome":"entitled"}]})
must_reject("pi-conversation-create.schema.json", {"workspace_id":"ws_example123","thinking":"high"})
must_reject("pi-conversation-create.schema.json", {"workspace_id":"ws_example123","new_worktree":{"name":"../escape"}})
bad_place = json.loads((BASE / "examples" / "snapshot.json").read_text())
bad_place["workspaces"][0]["worktrees"][0]["path"] = "relative/place"
must_reject("snapshot.schema.json", bad_place)
must_reject("pi-model-update.schema.json", {"model":"example","thinking":"unlimited"})

must_reject("pi-startup-choice.schema.json", {"model":"example","thinking":"unlimited"})



must_reject("claude-login.schema.json", {"schema_version":1,"state":"code","attempt_id":"20261016T120000.000000001","verification_uri":"https://evil.invalid/"})
must_reject("claude-login-code.schema.json", {"attempt_id":"20261016T120000.000000001","code":"line1\nline2"})

# Integrations: a synced directory is home-relative under ~/cloud, a pasted
# redirect is only a loopback address, and a password cannot carry a newline
# into the tool's configuration.
bad_integrations = json.loads((BASE / "examples" / "integrations.json").read_text())
bad_integrations["accounts"][1]["services"][1]["directory"] = "/home/person/cloud/x"
must_reject("integrations.schema.json", bad_integrations)
bad_integrations["accounts"][1]["services"][1]["directory"] = "~/cloud/google-drive/../../.ssh"
must_reject("integrations.schema.json", bad_integrations)
# A grant's scope is the provider's name, never markup or free text.
bad_grant = json.loads((BASE / "examples" / "integrations.json").read_text())
bad_grant["accounts"][2]["grant"]["granted"].append("<img src=x>")
must_reject("integrations.schema.json", bad_grant)
# A native MCP connection is one of the host's own server names, never a
# free-form Pi entry the person or another tool configured.
for name in ("open_habitat_trello_1", "open_habitat_trello_10", "open_habitat_trello_02", "open_habitat_jira", "mcp__open_habitat_trello"):
    bad_mcp = json.loads((BASE / "examples" / "integrations.json").read_text())
    bad_mcp["accounts"][-1]["address"] = name
    must_reject("integrations.schema.json", bad_mcp)
must_reject("integration-login-control.schema.json", {"action":"redirect","attempt_id":"20261019T094000.000000002","redirect_url":"https://gateway.example.test/callback?code=x"})
# A level is one of the provider's named levels, and only a start chooses it.
must_reject("integration-login-control.schema.json", {"action":"start","provider":"microsoft","level":"admin"})
must_reject("integration-login-control.schema.json", {"action":"cancel","attempt_id":"20261019T094000.000000002","level":"read"})
must_reject("integration-login-control.schema.json", {"action":"skip_folders","attempt_id":"20261019T094000.000000002","folders":["all"]})
bad_connect = json.loads((BASE / "examples" / "integration-connect.json").read_text())
bad_connect["password"] = "secret\n[accounts.x]"
must_reject("integration-account.schema.json", bad_connect)
# The browser never sends a password to reuse, and an Apple write carries no server.
must_reject("integration-account.schema.json", {"action": "add", "provider": "apple", "address": "person@example.test", "services": ["calendar"], "password": "x"})
must_reject("integration-account.schema.json", {"action": "connect", "provider": "apple", "address": "person@example.test", "services": ["contacts"], "password": "x", "url": "https://elsewhere.example.test/"})
must_reject("integration-account.schema.json", {"action": "connect", "provider": "apple", "address": "person@example.test", "services": [], "password": "x"})
must_reject("integration-login.schema.json", {"schema_version":1,"state":"failed","attempt_id":"20261019T094000.000000001","provider":"microsoft","failure":"tool_failed","consent_url":"https://login.example.test/adminconsent"})


# Microsoft subphases cannot contradict the grant/presentation state.
for state, phase, provider in [("completed", "files", "microsoft"), ("completing", "outlook", "microsoft"), ("completing", "files_discovery", "google")]:
    must_reject("integration-login.schema.json", {"schema_version": 1, "state": state, "attempt_id": "20261023T120000.000000001", "provider": provider, "login_phase": phase})
must_reject("integration-login.schema.json", {"schema_version": 1, "state": "device_code", "attempt_id": "20261023T120000.000000001", "provider": "microsoft", "login_phase": "files_discovery", "verification_uri": "https://login.microsoft.com/device", "user_code": "FIRST1234", "expires_at": "2026-10-23T12:15:00Z"})

# Gitea: the token travels only in connect and replace and never in a reply;
# a connection is named by the daemon's derived id, never by URL or user; a
# failed source is never an empty success; a GitHub start keeps GitHub's names.
must_reject("gitea-connection.schema.json", {"action": "check", "connection_id": "gitea_0123456789abcdef01234567", "token": "x"})
must_reject("gitea-connection.schema.json", {"action": "disconnect", "base_url": "https://git.example.test", "user": "example-person"})
must_reject("gitea-connection.schema.json", {"action": "connect", "base_url": "https://git.example.test", "token": "has space"})
must_reject("gitea-connection.schema.json", {"action": "replace", "connection_id": "gitea_0123456789abcdef01234567", "token": "x", "base_url": "https://elsewhere.example.test"})
bad_gitea = json.loads((BASE / "examples" / "gitea-connected.json").read_text())
bad_gitea["connection"]["token"] = "x"
must_reject("gitea-connection-change.schema.json", bad_gitea)
bad_gitea = json.loads((BASE / "examples" / "gitea-connected.json").read_text())
bad_gitea["connection"]["base_url"] = "https://person:secret@git.example.test"
must_reject("gitea-connection-change.schema.json", bad_gitea)
must_reject("gitea-connection-change.schema.json", {"schema_version": 1, "outcome": "written", "removed": {"id": "gitea_0123456789abcdef01234567"}, "api": "ok"})
bad_gitea = json.loads((BASE / "examples" / "gitea-connected.json").read_text())
bad_gitea["api"] = "token_rejected"
must_reject("gitea-connection-change.schema.json", bad_gitea)
bad_gitea = json.loads((BASE / "examples" / "gitea-repos.json").read_text())
bad_gitea["sources"][2]["repositories"] = bad_gitea["sources"][0]["repositories"]
must_reject("gitea-repos.schema.json", bad_gitea)
bad_gitea = json.loads((BASE / "examples" / "gitea-repos.json").read_text())
del bad_gitea["sources"][2]["failure"]
must_reject("gitea-repos.schema.json", bad_gitea)
# An incomplete list says why; a complete or failed one carries no reason.
bad_gitea = json.loads((BASE / "examples" / "gitea-repos.json").read_text())
del bad_gitea["sources"][1]["incomplete"]
must_reject("gitea-repos.schema.json", bad_gitea)
bad_gitea = json.loads((BASE / "examples" / "gitea-repos.json").read_text())
bad_gitea["sources"][0]["incomplete"] = "limit"
must_reject("gitea-repos.schema.json", bad_gitea)
bad_gitea = json.loads((BASE / "examples" / "gitea-repos.json").read_text())
bad_gitea["sources"][2]["incomplete"] = "interrupted"
must_reject("gitea-repos.schema.json", bad_gitea)
# A workspace's Gitea origin is a base and owner/name, never the address.
for origin in ({"base_url": "https://person:secret@git.example.test", "full_name": "example-person/notes"}, {"base_url": "https://git.example.test", "full_name": "example-person/notes", "url": "https://git.example.test/example-person/notes.git"}):
    bad_snapshot = json.loads((BASE / "examples" / "snapshot.json").read_text())
    bad_snapshot["workspaces"][0]["gitea_origin"] = origin
    must_reject("snapshot.schema.json", bad_snapshot)
must_reject("github-clone.schema.json", {"action": "start", "source": "gitea", "connection_id": "gitea_0123456789abcdef01234567", "repository_id": 42, "mode": "blobless"})
# A Gitea restart is the same full start of one repository id; a Gitea
# remove names only the owner/name the directory records, never a
# connection, id or path, and a GitHub interrupted clone keeps GitHub's names.
must_reject("github-clone.schema.json", {"action": "restart", "source": "gitea", "connection_id": "gitea_0123456789abcdef01234567", "repository_id": 42, "mode": "blobless"})
must_reject("github-clone.schema.json", {"action": "remove", "source": "gitea", "full_name": "example_person/notes", "connection_id": "gitea_0123456789abcdef01234567"})
must_reject("github-clone.schema.json", {"action": "remove", "source": "gitea", "full_name": "example_person/.."})
must_reject("github-clone.schema.json", {"action": "remove", "source": "gitea", "full_name": "../notes"})
must_reject("github-clone.schema.json", {"action": "dismiss", "source": "gitea", "job_id": "0123456789abcdef0123456789abcdef"})
bad_clones = json.loads((BASE / "examples" / "github-clones.json").read_text())
bad_clones["interrupted"][0]["full_name"] = "example_org/monorepo"
must_reject("github-clone.schema.json", bad_clones)
bad_clones = json.loads((BASE / "examples" / "github-clones.json").read_text())
bad_clones["interrupted"][1]["source"]["repository_id"] = 42
must_reject("github-clone.schema.json", bad_clones)
must_reject("github-clone.schema.json", {"action": "start", "source": "gitea", "connection_id": "gitea_0123456789abcdef01234567", "full_name": "example-person/notes", "mode": "full"})
must_reject("github-clone.schema.json", {"action": "start", "full_name": "example_person/notes", "mode": "full"})

def must_accept(schema: str, instance: object) -> None:
    Draft202012Validator(schemas[schema], registry=registry, format_checker=format_checker).validate(instance)

# A worker's pull request travels exactly when GitHub named one, and its
# link can only be a github.com pull request page.
work_run = {"run_id": "01m521vczarx5bkx086n64t1t2", "git": "available", "pull_request_state": "found", "pull_request": {"number": 4, "state": "open", "url": "https://github.com/o/r/pull/4", "checks": {"passed": 0, "failed": 0, "pending": 0}}}
must_accept("spinoff-work.schema.json", {"schema_version": 1, "parent_id": "pi:11111111-1111-4111-8111-111111111111", "availability": "available", "runs": [work_run]})
must_reject("spinoff-work.schema.json", {"schema_version": 1, "parent_id": "pi:11111111-1111-4111-8111-111111111111", "availability": "available", "runs": [{**work_run, "pull_request_state": "unknown"}]})
must_reject("spinoff-work.schema.json", {"schema_version": 1, "parent_id": "pi:11111111-1111-4111-8111-111111111111", "availability": "available", "runs": [{k: v for k, v in work_run.items() if k != "pull_request"}]})
must_reject("spinoff-work.schema.json", {"schema_version": 1, "parent_id": "pi:11111111-1111-4111-8111-111111111111", "availability": "available", "runs": [{**work_run, "pull_request": {**work_run["pull_request"], "url": "https://evil.example/o/r/pull/4"}}]})

# A provider whose own files cannot be read says so on its tile; the rest of
# the list still travels.
unread_integrations = json.loads((BASE / "examples" / "integrations.json").read_text())
unread_integrations["providers"][3]["accounts_unreadable"] = True
unread_integrations["accounts"] = [a for a in unread_integrations["accounts"] if a["provider"] != "dropbox"]
unread_integrations["skill"] = "failed"
must_accept("integrations.schema.json", unread_integrations)
unread_integrations["providers"][3]["accounts_unreadable"] = False
must_reject("integrations.schema.json", unread_integrations)

# A preferences write names exactly one change.
preferences_write = Draft202012Validator({"$ref": schemas["account-preferences.schema.json"]["$id"] + "#/$defs/write"}, registry=registry)
for ok in ({"quiet_sort": "newest"}, {"quiet_sort": "workspace"}, {"quiet_sort": "name"}, {"quiet_workspace": "ws_example123"}, {"quiet_workspace": None}, {"engine": "vscode"}, {"language": "en"}, {"language": "system"}, {"experimental": {"worker-row-sentence": True}}, {"experimental": {"next-waiting-row": False}}, {"github_workflow": True}, {"github_workflow": False}):
    preferences_write.validate(ok)
for bad in ({"recent_count": 5}, {"quiet_sort": "oldest"}, {"quiet_sort": None}, {"quiet_workspace": "../x"}, {"quiet_workspace": "ws_short"}, {"quiet_workspace": 5}, {"quiet_sort": "name", "quiet_workspace": None}, {"quiet_sort": "name", "engine": "vscode"}, {}, {"engine": "vscode", "experimental": {"worker-row-sentence": True}}, {"language": "sv"}, {"language": "en", "engine": "vscode"}, {"experimental": {}}, {"experimental": {"a": True, "b": True}}, {"experimental": {"Terminal": True}}, {"github_workflow": None}, {"github_workflow": True, "engine": "vscode"}):
    assert not preferences_write.is_valid(bad), f"preferences write accepted {bad!r}"

# GitLab: the token travels only in connect and replace and never in a
# reply; a token description is GitLab's answer of an ok read only; project
# paths are nested group paths shown whole, never one that could mean
# another path; clone requests name a connection and GitLab's id.
must_reject("gitlab-connection.schema.json", {"action": "check", "connection_id": "gitlab_0123456789abcdef01234567", "token": "x"})
must_reject("gitlab-connection.schema.json", {"action": "connect", "base_url": "https://gitlab.example.test", "token": "has space"})
must_reject("gitlab-connection.schema.json", {"action": "replace", "connection_id": "gitea_0123456789abcdef01234567", "token": "x"})
bad_gitlab = json.loads((BASE / "examples" / "gitlab-connected.json").read_text())
bad_gitlab["connection"]["token"] = "x"
must_reject("gitlab-connection-change.schema.json", bad_gitlab)
bad_gitlab = json.loads((BASE / "examples" / "gitlab-connected.json").read_text())
bad_gitlab["api"] = "token_expired"
must_reject("gitlab-connection-change.schema.json", bad_gitlab)
bad_gitlab = json.loads((BASE / "examples" / "gitlab-connected.json").read_text())
del bad_gitlab["token"]["expires_at"]
must_reject("gitlab-connection-change.schema.json", bad_gitlab)
bad_gitlab = json.loads((BASE / "examples" / "gitlab-tokens.json").read_text())
bad_gitlab["connections"][2]["token"] = {"push": "unknown"}
must_reject("gitlab-tokens.schema.json", bad_gitlab)
for path in ["notes", "a/../b", "a/-/b", "a/b.git", "a/./b", "a//b", "/a/b", "a/b.atom", "/".join(["g"] * 22), "a/" + "x" * 256]:
    bad_gitlab = json.loads((BASE / "examples" / "gitlab-repos.json").read_text())
    bad_gitlab["sources"][0]["repositories"][0]["full_name"] = path
    must_reject("gitlab-repos.schema.json", bad_gitlab)
deep = json.loads((BASE / "examples" / "gitlab-repos.json").read_text())
deep["sources"][0]["repositories"][0]["full_name"] = "/".join(["g"] * 20) + "/project"
must_accept("gitlab-repos.schema.json", deep)
bad_gitlab = json.loads((BASE / "examples" / "gitlab-repos.json").read_text())
bad_gitlab["sources"][2]["elsewhere"] = {"count": 1}
must_reject("gitlab-repos.schema.json", bad_gitlab)
bad_gitlab = json.loads((BASE / "examples" / "gitlab-repos.json").read_text())
bad_gitlab["sources"][1]["elsewhere"]["origin"] = "http://person:secret@gitlab.internal"
must_reject("gitlab-repos.schema.json", bad_gitlab)
# The host's own GitHub classification: an outage with its retry, and an
# organisation that keeps the person's token out.
good = json.loads((BASE / "examples" / "snapshot.json").read_text())
good["auth"]["native_github"] = {"state": "unreachable", "retry": {"attempt": 2, "attempts": 4, "since": "2026-10-28T10:00:00Z", "next_at": "2026-10-28T10:01:00Z"}, "restricted_orgs": [{"owner": "example-org", "restriction": "oauth_app"}]}
must_accept("snapshot.schema.json", good)
good["auth"]["native_github"]["restricted_orgs"][0]["owner"] = "example-org/monorepo"
must_reject("snapshot.schema.json", good)
good["auth"]["native_github"]["restricted_orgs"] = []
del good["auth"]["native_github"]["retry"]["next_at"]
must_reject("snapshot.schema.json", good)
# The token's scopes: a sorted list of scope names, or null when unread.
good = json.loads((BASE / "examples" / "snapshot.json").read_text())
good["auth"]["native_github"]["scopes"] = None
must_accept("snapshot.schema.json", good)
for scopes in (["repo", "repo"], ["Repo"], ["repo, workflow"], "repo"):
    good["auth"]["native_github"]["scopes"] = scopes
    must_reject("snapshot.schema.json", good)
must_accept("github-repository.schema.json", {"schema_version": 1, "full_name": "example-org/monorepo", "state": "restricted", "restriction": "saml"})
must_reject("github-repository.schema.json", {"schema_version": 1, "full_name": "example-org/monorepo", "state": "restricted"})
for origin in ({"base_url": "https://gitlab.example.test", "full_name": "example-group/infra/terraform"},):
    good = json.loads((BASE / "examples" / "snapshot.json").read_text())
    del good["workspaces"][0]["gitea_origin"]
    good["workspaces"][0]["gitlab_origin"] = origin
    must_accept("snapshot.schema.json", good)
    good["workspaces"][0]["gitlab_origin"] = {**origin, "full_name": "single"}
    must_reject("snapshot.schema.json", good)
must_accept("github-clone.schema.json", {"action": "start", "source": "gitlab", "connection_id": "gitlab_0123456789abcdef01234567", "repository_id": 42, "mode": "full"})
must_accept("github-clone.schema.json", {"action": "remove", "source": "gitlab", "full_name": "example-group/infra/terraform"})
must_reject("github-clone.schema.json", {"action": "start", "source": "gitlab", "connection_id": "gitea_0123456789abcdef01234567", "repository_id": 42, "mode": "full"})
must_reject("github-clone.schema.json", {"action": "start", "source": "gitlab", "connection_id": "gitlab_0123456789abcdef01234567", "repository_id": 42, "mode": "blobless"})
must_reject("github-clone.schema.json", {"action": "remove", "source": "gitlab", "full_name": "example-group/../terraform"})
clones = json.loads((BASE / "examples" / "github-clones.json").read_text())
clones["jobs"].append({"job_id": "aabbccddeeff00112233445566778899", "full_name": "example-group/infra/terraform", "source": {"provider": "gitlab", "connection_id": "gitlab_0123456789abcdef01234567", "repository_id": 43}, "mode": "full", "state": "failed", "reason": "auth_refused", "leftover": "removed", "started_at": "2026-10-17T11:55:00Z", "finished_at": "2026-10-17T11:56:00Z"})
clones["interrupted"].append({"full_name": "example-group/infra/terraform", "size_bytes": 4096, "source": {"provider": "gitlab", "connection_id": "gitlab_0123456789abcdef01234567"}})
must_accept("github-clone.schema.json", clones)
clones["interrupted"][-1]["source"] = {"provider": "gitea"}
must_reject("github-clone.schema.json", clones)
clones["interrupted"][-1]["source"] = {"provider": "gitlab", "connection_id": "gitea_0123456789abcdef01234567"}
must_reject("github-clone.schema.json", clones)

print(f"Host contracts valid: {len(SCHEMA_FILES)} schemas, {len(checks) + 2} fixture files, {len(scenarios)} scenarios, negative checks including Microsoft login phases.")
