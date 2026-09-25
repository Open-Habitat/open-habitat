#!/usr/bin/env python3
"""Offline serial backpressure, boundedness and full-stream leak regressions."""
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

DRAIN = pathlib.Path(__file__).resolve().parents[2] / "scripts/vm-serial-drain.py"
CAP = 2097152


class SerialDrainTest(unittest.TestCase):
    def capture(self, chunks):
        with tempfile.TemporaryDirectory() as directory:
            log = pathlib.Path(directory) / "serial"
            receipt = pathlib.Path(directory) / "receipt"
            proc = subprocess.Popen([sys.executable, str(DRAIN), str(log), str(receipt)],
                                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            for chunk in chunks:
                proc.stdin.write(chunk)
                proc.stdin.flush()
            proc.stdin.close()
            self.assertEqual(proc.wait(timeout=8), 0, proc.stderr.read())
            self.assertEqual(proc.stdout.read(), b"")
            proc.stderr.close()
            proc.stdout.close()
            record = json.loads(receipt.read_text())
            return record, log.read_bytes(), log.stat().st_mode & 0o777

    def test_late_proof_is_never_accepted_from_capped_prefix(self):
        data, log, mode = self.capture([b"X" * (CAP + 1), b"\nVM_REBOOT_DIAG=socket-guestone-status-start\n",
                                        b'VM_PROOF={"status":"passed"}\n'])
        self.assertTrue(data['capped'])
        self.assertGreater(data['bytes'], CAP)
        self.assertEqual(len(log), CAP)
        self.assertNotIn(b"VM_PROOF", log)
        self.assertEqual(data['markers'], ['VM_REBOOT_DIAG=socket-guestone-status-start'])
        self.assertEqual(mode, 0o600)

    def test_stream_token_after_cap_even_when_split_across_writes(self):
        token = b"PRODUCT_VM_TOKEN_guestone_FIXTURE_ONLY_92764"
        data, log, _ = self.capture([b"X" * CAP, token[:20], token[20:], b"\n"])
        self.assertTrue(data['capped'])
        self.assertTrue(data['token_leaked'])
        self.assertNotIn(token, log)

    def test_uncapped_proof_and_no_raw_token_to_stdout(self):
        data, log, _ = self.capture([b'VM_PROOF={"status":"passed"}\n'])
        self.assertFalse(data['capped'])
        self.assertFalse(data['token_leaked'])
        self.assertIn(b'VM_PROOF=', log)


if __name__ == '__main__':
    unittest.main()
