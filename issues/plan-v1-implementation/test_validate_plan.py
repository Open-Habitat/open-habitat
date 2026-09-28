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
        self.change("build-agent-control", "visual-acceptance.md", "missing-evidence.md")
        self.run_validator("missing visual evidence and explicit human decision policy: build-agent-control")

    def test_missing_human_decision_fails(self):
        self.change("build-history-view", "until Jari has seen its visual evidence and given an explicit accept/change decision", "until screenshots have been saved")
        self.change("build-history-view", "The conductor records Jari's decision here", "The conductor files the screenshots here")
        self.run_validator("missing visual evidence and explicit human decision policy: build-history-view")


if __name__ == "__main__":
    unittest.main()
