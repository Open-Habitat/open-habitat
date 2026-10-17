#!/usr/bin/env python3
"""Boundary checks for the trace inspector; no browsers or third-party modules."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).with_name("inspect-trace.sh")


class InspectTraceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="oh-trace-test-", dir="/var/tmp")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def run_script(self, *args, **env):
        return subprocess.run([str(SCRIPT), *map(str, args)], text=True,
                              capture_output=True,
                              env={**os.environ, "TMPDIR": str(self.root), **env})

    def archive(self, entries):
        path = self.root / "case with spaces" / "trace.zip"
        path.parent.mkdir(exist_ok=True)
        with zipfile.ZipFile(path, "w") as archive:
            for name, content in entries.items():
                archive.writestr(name, content)
        return path

    def test_summary_and_unique_extraction(self):
        records = [
            {"type": "before", "callId": "call@1", "apiName": "expect.toBeVisible"},
            {"type": "after", "callId": "call@1", "error": {"message": "Timed out"}},
            {"type": "console", "messageType": "error", "text": "console probe"},
            {"type": "error", "message": "page probe"},
        ]
        network = [{"type": "resource-snapshot", "snapshot": {
            "request": {"url": f"https://example.test/{i}"},
            "response": {"status": 503}}} for i in range(7)]
        network.append({"type": "resource-snapshot", "snapshot": {
            "request": {"url": "https://example.test/offline"},
            "response": {"status": 0}, "_failureText": "net::ERR_FAILED"}})
        trace = self.archive({"0.trace": "\n".join(map(json.dumps, records)),
                              "0.network": "\n".join(map(json.dumps, network))})
        result = self.run_script("--json", trace.parent)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")
        data = json.loads(result.stdout)
        self.assertEqual(data["failed_actions"][0]["action"], "expect.toBeVisible")
        self.assertEqual(len(data["console_errors"]), 2)
        self.assertEqual(len(data["network_errors"]), 5)
        self.assertEqual(data["network_errors"][-1]["error"], "net::ERR_FAILED")
        self.assertTrue(Path(data["extracted_path"], "0.trace").exists())
        second = self.run_script("--json", trace)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertNotEqual(data["extracted_path"], json.loads(second.stdout)["extracted_path"])
        self.assertTrue(trace.exists())

    def test_reject_unsafe_zip_without_writing_outside(self):
        sentinel = self.root / "sentinel"
        sentinel.write_text("precious")
        trace = self.archive({"../sentinel": "overwritten", "0.trace": ""})
        result = self.run_script(trace)
        self.assertEqual(result.returncode, 1)
        self.assertIn("Unsafe", result.stderr)
        self.assertEqual(sentinel.read_text(), "precious")
        self.assertEqual(list(self.root.glob("oh-trace.*")), [])
        with zipfile.ZipFile(trace, "w") as archive:
            link = zipfile.ZipInfo("link")
            link.create_system = 3
            link.external_attr = 0o120777 << 16
            archive.writestr(link, str(self.root))
            archive.writestr("0.trace", "")
        self.assertEqual(self.run_script(trace).returncode, 1)

    def test_input_errors(self):
        for args in [(), ("--wat",), (" ",), (self.root / "missing.zip",), (self.root,)]:
            with self.subTest(args=args):
                self.assertEqual(self.run_script(*args).returncode, 1)
        trace = self.archive({"0.trace": "{}\n"})
        (self.root / "trace.zip").write_bytes(trace.read_bytes())
        self.assertEqual(self.run_script(self.root).returncode, 1)
        self.assertEqual(self.run_script(trace, TMPDIR="").returncode, 1)
        trace.write_text("not zip")
        self.assertEqual(self.run_script(trace).returncode, 1)
        self.assertEqual(self.run_script("--help").returncode, 0)

    def test_malformed_trace_and_system_error(self):
        trace = self.archive({"0.trace": "not json\n"})
        self.assertEqual(self.run_script(trace).returncode, 1)
        self.assertEqual(self.run_script(trace, PATH="/nonexistent").returncode, 2)


if __name__ == "__main__":
    unittest.main()
