#!/usr/bin/env python3
"""Adversarial checks for the plan validator using disposable issuectl roots."""
import pathlib
import shutil
import subprocess
import tempfile
import unittest

SOURCE = pathlib.Path(__file__).resolve().parents[2]


class PlanValidatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="plan-validator-", dir="/var/tmp")
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        shutil.copytree(SOURCE / "issues", self.root / "issues")
        shutil.copytree(SOURCE / "contracts", self.root / "contracts")
        self.validator = self.root / "issues/plan-v1-implementation/validate_plan.py"

    def run_validator(self, *expected):
        result = subprocess.run(["python3", str(self.validator)], cwd=self.root,
                                capture_output=True, text=True)
        if expected:
            self.assertNotEqual(result.returncode, 0, result.stdout)
            for message in expected:
                self.assertIn(message, result.stderr)
        else:
            self.assertEqual(result.returncode, 0, result.stderr)

    def change(self, slug, old, new):
        path = self.root / "issues" / slug / "item.md"
        content = path.read_text()
        self.assertIn(old, content)
        path.write_text(content.replace(old, new, 1))

    def test_current_schedule_and_pending_visual_verdict_pass(self):
        self.run_validator()

    def test_real_prerequisite_missing_fails(self):
        self.change("build-history-view", "'@build-workspace-slice'", "'@not-the-prerequisite'")
        self.run_validator("walking-core dependency missing: build-history-view <- build-workspace-slice")

    def test_old_serial_edge_fails(self):
        self.change("build-agent-control", "lane_seq: 50", "lane_seq: 50\nblocked_by: ['@build-history-view']")
        self.run_validator("history visual review must not block agent control")

    def test_missing_visual_evidence_fails(self):
        path = self.root / "issues/build-agent-control/item.md"
        content = path.read_text()
        self.assertIn("visual-acceptance.md", content)
        # Remove every reference: the policy can mention the evidence file twice.
        path.write_text(content.replace("visual-acceptance.md", "missing-evidence.md"))
        self.run_validator("missing visual evidence and explicit human decision policy: build-agent-control")

    def test_missing_human_decision_fails(self):
        self.change("build-history-view", "Record Jari's visual verdict when given", "File the screenshots when ready")
        self.run_validator("missing visual evidence and explicit human decision policy: build-history-view")

    def change_map(self, old, new):
        path = self.root / "issues/plan-v1-implementation/implementation-briefs.md"
        content = path.read_text()
        self.assertIn(old, content)
        path.write_text(content.replace(old, new, 1))

    def test_missing_scenario_assignment_fails(self):
        self.change_map("| CT-035 |", "| CT-036 |")
        self.run_validator("CT-035 has 0 implementation-owner rows",
                           "unknown or retired scenario in ownership map: CT-036")

    def test_duplicate_scenario_assignment_fails(self):
        self.change_map("| CT-027 |", "| CT-027, CT-027 |")
        self.run_validator("CT-027 has 2 implementation-owner rows")

    def test_nonexistent_owner_fails(self):
        self.change_map("[gate-native-routes-on-pi](../gate-native-routes-on-pi/item.md)",
                        "[missing-owner](../missing-owner/item.md)")
        self.run_validator("invalid scenario owner")

    def test_retired_question_scenario_cannot_return_as_requirement(self):
        self.change_map("| CT-027 |", "| CT-027, CT-033 |")
        self.run_validator("unknown or retired scenario in ownership map: CT-033")


if __name__ == "__main__":
    unittest.main()
