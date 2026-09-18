#!/usr/bin/env python3
"""Deterministic self-tests for the candidate-neutral benchmark fixture."""

from __future__ import annotations

import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

# Core imports must not write bytecode beside tracked fixture source.
sys.dont_write_bytecode = True

import fixture_core as core

BASE = Path(__file__).resolve().parent
CLI = BASE / "fixture.py"
FIXED_TIME = "2000-01-01T00:00:00Z"


class MarkedRoot:
    def __enter__(self) -> Path:
        self.temp = tempfile.TemporaryDirectory(prefix="agent-host-fixture-")
        self.path = Path(self.temp.name)
        (self.path / core.ROOT_MARKER).write_text(core.ROOT_MARKER_CONTENT, encoding="utf-8")
        return self.path

    def __exit__(self, *args: object) -> None:
        self.temp.cleanup()


class DescriptorTests(unittest.TestCase):
    def test_descriptors_are_complete_and_separate_identities(self) -> None:
        checks = core.validate_descriptors(BASE)
        ids = {item["id"] for item in checks}
        self.assertIn("scenarios.complete", ids)
        self.assertIn("identity.separate", ids)
        self.assertIn("tenancy.separate", ids)

    def test_stable_ids_are_byte_deterministic(self) -> None:
        first = core.stable_id("attempt", "session-a", "start-1")
        self.assertEqual(first, core.stable_id("attempt", "session-a", "start-1"))
        self.assertNotEqual(first, core.stable_id("attempt", "session-b", "start-1"))

    def test_sample_evidence_integrity(self) -> None:
        core.verify_bundle(core.load_json(BASE / "sample-evidence.json"))


class RootSafetyTests(unittest.TestCase):
    def test_requires_absolute_marked_temp_child(self) -> None:
        with self.assertRaisesRegex(core.FixtureError, "absolute"):
            core.validate_output_root("relative")
        with tempfile.TemporaryDirectory(prefix="agent-host-unmarked-") as unmarked:
            with self.assertRaisesRegex(core.FixtureError, "lacks regular marker"):
                core.validate_output_root(unmarked)

    def test_rejects_non_temp_and_symlink_roots(self) -> None:
        with self.assertRaises(core.FixtureError):
            core.validate_output_root(str(BASE))
        with MarkedRoot() as root:
            link = root.parent / f"{root.name}-link"
            link.symlink_to(root, target_is_directory=True)
            try:
                with self.assertRaisesRegex(core.FixtureError, "symlink"):
                    core.validate_output_root(link)
            finally:
                link.unlink()


class PolicyTests(unittest.TestCase):
    def test_principal_tenant_and_approval_boundaries(self) -> None:
        policy = core.PolicyFixture()
        self.assertEqual("allow", policy.decide(principal_id="alice", tenant_id="school-a", capability="read_value")["decision"])
        self.assertEqual("require_approval", policy.decide(principal_id="alice", tenant_id="school-a", capability="write_value")["decision"])
        self.assertEqual("allow", policy.decide(principal_id="alice", tenant_id="school-a", capability="write_value", approved_by="alice")["decision"])
        self.assertEqual("deny", policy.decide(principal_id="bob", tenant_id="school-a", capability="read_value")["decision"])
        self.assertEqual("deny", policy.decide(principal_id="alice", tenant_id="school-b", capability="read_value")["decision"])
        self.assertEqual("deny", policy.decide(principal_id="alice", tenant_id="school-a", capability="exfiltrate")["decision"])


class OrchestratorTests(unittest.TestCase):
    def test_success_owns_git_workspace_and_cleanup(self) -> None:
        with MarkedRoot() as root:
            owner = core.FakeOrchestrator(root)
            result = owner.start(session_id="session-success", attempt_id="attempt-success")
            workspace = root / "workspaces" / result["workspace_id"]
            self.assertTrue((workspace / ".git").is_dir())
            self.assertEqual("1\n", (workspace / "src/value.txt").read_text())
            self.assertEqual(result["baseline_commit"], subprocess.run(["git", "rev-parse", "HEAD"], cwd=workspace, text=True, capture_output=True, check=True).stdout.strip())
            self.assertEqual("running", owner.observe(result["runtime_id"])["observed_state"])
            stopped = owner.stop(runtime_id=result["runtime_id"])
            self.assertTrue(stopped["workspace_removed"])
            self.assertFalse(workspace.exists())

    def test_failure_injection_distinguishes_side_effect_boundaries(self) -> None:
        with MarkedRoot() as root:
            owner = core.FakeOrchestrator(root)
            failure = owner.start(session_id="session-failure", attempt_id="attempt-failure", failure_mode="failure")
            before = owner.start(session_id="session-before", attempt_id="attempt-before", failure_mode="timeout_before_side_effect")
            after = owner.start(session_id="session-after", attempt_id="attempt-after", failure_mode="timeout_after_side_effect")
            self.assertEqual((False, "failed", "absent"), (failure["side_effect"], failure["terminal_state"], failure["observed_state"]))
            self.assertEqual((False, "unknown", "unknown"), (before["side_effect"], before["terminal_state"], before["observed_state"]))
            self.assertEqual((True, "unknown", "running"), (after["side_effect"], after["terminal_state"], after["observed_state"]))
            self.assertEqual("running", owner.observe(after["runtime_id"])["observed_state"])
            owner.stop(runtime_id=after["runtime_id"])

    def test_active_workspace_limit_is_enforced(self) -> None:
        with MarkedRoot() as root:
            owner = core.FakeOrchestrator(root)
            active = [owner.start(session_id=f"limited-{index}", attempt_id=f"limited-attempt-{index}") for index in range(2)]
            with self.assertRaisesRegex(core.FixtureError, "at most two"):
                owner.start(session_id="limited-2", attempt_id="limited-attempt-2")
            for result in active:
                owner.stop(runtime_id=result["runtime_id"])

    def test_integrated_self_test_uses_only_marked_root(self) -> None:
        with MarkedRoot() as root:
            result = core.run_self_test(root)
            self.assertEqual(0, result["summary"]["fail"])
            self.assertTrue((root / "evidence.sqlite3").is_file())
            self.assertTrue((root / "evidence-bundle.json").is_file())
            self.assertEqual([], list((root / "workspaces").iterdir()))
            self.assertEqual([], list((root / "runtimes").iterdir()))

    def test_git_baseline_is_deterministic(self) -> None:
        commits = []
        with MarkedRoot() as root:
            owner = core.FakeOrchestrator(root)
            for index in range(2):
                result = owner.start(session_id=f"session-{index}", attempt_id=f"attempt-{index}")
                commits.append(result["baseline_commit"])
                owner.stop(runtime_id=result["runtime_id"])
        self.assertEqual(commits[0], commits[1])


class EvidenceTests(unittest.TestCase):
    def test_durable_rows_sanitization_hash_chain_and_tamper_detection(self) -> None:
        with MarkedRoot() as root:
            store = core.EvidenceStore(root)
            attempt = "attempt-evidence"
            store.add_attempt({"attempt_id": attempt, "scenario_id": "B6", "principal_id": "alice", "tenant_id": "school-a", "requested_state": "running", "accepted_state": "accepted", "observed_state": "running", "terminal_state": "succeeded", "correlation_id": "correlation-evidence", "recorded_at": FIXED_TIME})
            first = store.add_event(event_id="event-1", attempt_id=attempt, seq=1, occurred_at=FIXED_TIME, native={"token_value": "must-not-leak", "path": "/home/example/private"}, normalized={"type": "started"})
            second = store.add_event(event_id="event-2", attempt_id=attempt, seq=2, occurred_at=FIXED_TIME, native={"kind": "complete"}, normalized={"type": "completed"})
            other_attempt = "attempt-school-b-denial"
            store.add_attempt({"attempt_id": other_attempt, "scenario_id": "B6", "principal_id": "alice", "tenant_id": "school-b", "requested_state": "read", "accepted_state": "denied", "observed_state": "absent", "terminal_state": "denied", "correlation_id": "correlation-school-b", "recorded_at": FIXED_TIME})
            store.add_event(event_id="event-school-b-1", attempt_id=other_attempt, seq=1, occurred_at=FIXED_TIME, native={"kind": "denial"}, normalized={"type": "policy.denied"})
            self.assertNotEqual(first, second)
            decision = core.PolicyFixture().decide(principal_id="alice", tenant_id="school-a", capability="read_value")
            store.add_policy_decision(decision_id="decision-1", attempt_id=attempt, decision=decision, operation={"capability": "read_value"}, decided_at=FIXED_TIME)
            store.add_artifact(artifact_id="artifact-1", attempt_id=attempt, media_type="text/plain", content=b"bounded\n", captured_at=FIXED_TIME)
            store.add_native_binding(binding_id="binding-1", attempt_id=attempt, binding_type="runtime", native_id="native-1", available=True, recorded_at=FIXED_TIME)
            result = store.write_bundle(scenario_id="B6", subject="synthetic-subject", generated_at="2000-01-01T00:00:00Z")
            store.close()
            bundle = result["bundle"]
            core.verify_bundle(bundle)
            rendered = json.dumps(bundle)
            self.assertNotIn("must-not-leak", rendered)
            self.assertNotIn("/home/example/private", rendered)
            self.assertIn("<redacted>", rendered)
            with sqlite3.connect(root / "evidence.sqlite3") as connection:
                self.assertEqual(3, connection.execute("SELECT count(*) FROM events").fetchone()[0])
            self.assertEqual({attempt, other_attempt}, set(bundle["integrity"]["event_chain_heads"]))
            bundle["events"][0]["normalized"]["type"] = "tampered"
            with self.assertRaisesRegex(core.FixtureError, "digest|hash chain"):
                core.verify_bundle(bundle)

    def test_event_sequence_gap_is_rejected(self) -> None:
        with MarkedRoot() as root:
            store = core.EvidenceStore(root)
            store.add_attempt({"attempt_id": "a", "scenario_id": "B1", "principal_id": "alice", "tenant_id": "school-a", "requested_state": "running", "accepted_state": "accepted", "observed_state": "running", "terminal_state": "succeeded", "correlation_id": "c", "recorded_at": FIXED_TIME})
            with self.assertRaisesRegex(core.FixtureError, "Expected event seq 1"):
                store.add_event(event_id="e", attempt_id="a", seq=2, occurred_at=FIXED_TIME, native={}, normalized={})
            store.close()


class CliTests(unittest.TestCase):
    def run_cli(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run([sys.executable, str(CLI), *args], cwd=BASE, text=True, capture_output=True)

    def test_json_version_alias_and_validation(self) -> None:
        version = self.run_cli("version", "--json")
        alias = self.run_cli("--json", "--version")
        self.assertEqual(0, version.returncode, version.stderr)
        self.assertEqual(version.stdout, alias.stdout)
        self.assertEqual(1, json.loads(version.stdout)["schema_version"])
        valid = self.run_cli("doctor", "--json")
        self.assertEqual(0, valid.returncode, valid.stderr)
        self.assertTrue(json.loads(valid.stdout)["valid"])

    def test_machine_readable_help(self) -> None:
        result = self.run_cli("preflight", "--help", "--json")
        self.assertEqual(0, result.returncode, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual("preflight", payload["command"])
        self.assertTrue(payload["examples"])

    def test_preflight_is_read_only_and_structured(self) -> None:
        with MarkedRoot() as root:
            before = sorted(path.name for path in root.iterdir())
            result = self.run_cli("preflight", "--output-root", str(root), "--json")
            after = sorted(path.name for path in root.iterdir())
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertTrue(json.loads(result.stdout)["ready"])
            self.assertEqual(before, after)

    def test_json_errors_use_stderr_and_actionable_exit(self) -> None:
        result = self.run_cli("preflight", "--output-root", "relative", "--json")
        self.assertEqual(1, result.returncode)
        self.assertEqual("", result.stdout)
        self.assertEqual("invalid_output_root", json.loads(result.stderr)["error"]["code"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
