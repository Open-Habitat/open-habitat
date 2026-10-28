#!/usr/bin/env python3
"""Offline regression tests for screenshots-to-avif.py.

The conversion cases need avifenc/avifdec or ImageMagick with AVIF support and
are skipped without one; the refusal and dry-run cases need neither.
"""
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import unittest
import zlib

SCRIPT = Path(__file__).with_name('screenshots-to-avif.py')


def write_png(path, width, height):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    rows = b''.join(b'\x00' + b''.join(bytes((x * 7 % 256, y * 5 % 256, 128)) for x in range(width))
                    for y in range(height))
    path.write_bytes(b'\x89PNG\r\n\x1a\n'
                     + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
                     + chunk(b'IDAT', zlib.compress(rows))
                     + chunk(b'IEND', b''))


def has_converter():
    if shutil.which('avifenc') and shutil.which('avifdec'):
        return True
    for name in ('magick', 'convert'):
        exe = shutil.which(name)
        if exe:
            out = subprocess.run([exe, '-list', 'format'], capture_output=True, text=True).stdout
            if any(line.split()[:1] in (['AVIF'], ['AVIF*']) and 'w' in line.split()[1]
                   for line in out.splitlines() if len(line.split()) > 1):
                return True
    return False


class ScreenshotsToAvifTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir='/var/tmp')
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name).resolve()
        (self.repo / 'scripts').mkdir()
        shutil.copy2(SCRIPT, self.repo / 'scripts' / SCRIPT.name)
        self.evidence = self.repo / 'issues' / 'some-issue' / 'evidence'
        self.evidence.mkdir(parents=True)
        (self.repo / 'docs').mkdir()

    def run_script(self, *args):
        done = subprocess.run(['python3', str(self.repo / 'scripts' / SCRIPT.name), '--json', *args],
                              capture_output=True, text=True, cwd=self.repo)
        return done.returncode, json.loads(done.stdout)

    def test_refuses_path_outside_allowed_trees_before_converting(self):
        inside = self.evidence / 'a.png'
        outside = self.repo / 'docs' / 'b.png'
        write_png(inside, 4, 3)
        write_png(outside, 4, 3)
        code, report = self.run_script(str(inside), str(outside))
        self.assertEqual(code, 2)
        self.assertIn('outside', report['error'])
        self.assertTrue(inside.exists())
        self.assertTrue(outside.exists())
        self.assertEqual(list(self.evidence.glob('*.avif')), [])

    def test_refuses_traversal_and_symlink(self):
        write_png(self.repo / 'docs' / 'b.png', 4, 3)
        code, _ = self.run_script(str(self.evidence / '..' / '..' / '..' / 'docs' / 'b.png'))
        self.assertEqual(code, 2)
        link = self.evidence / 'link.png'
        os.symlink(self.repo / 'docs' / 'b.png', link)
        code, report = self.run_script(str(link))
        self.assertEqual(code, 2)
        self.assertIn('symlink', report['error'])

    def test_dry_run_changes_nothing_and_skips_symlinks_in_directories(self):
        write_png(self.evidence / 'a.png', 4, 3)
        write_png(self.repo / 'docs' / 'b.png', 4, 3)
        os.symlink(self.repo / 'docs' / 'b.png', self.evidence / 'link.png')
        code, report = self.run_script('--dry-run', str(self.evidence))
        if code == 3:
            self.skipTest('no AVIF converter')
        self.assertEqual(code, 0)
        self.assertEqual([f['source'] for f in report['files']], ['issues/some-issue/evidence/a.png'])
        self.assertEqual(report['files'][0]['status'], 'would_convert')
        self.assertTrue((self.evidence / 'a.png').exists())
        self.assertFalse((self.evidence / 'a.avif').exists())

    @unittest.skipUnless(has_converter(), 'no AVIF converter')
    def test_converts_verifies_and_removes_only_the_converted_png(self):
        nested = self.evidence / 'phone'
        nested.mkdir()
        write_png(self.evidence / 'a.png', 31, 17)
        write_png(nested / 'b.png', 8, 40)
        (self.evidence / 'notes.txt').write_text('keep')
        code, report = self.run_script(str(self.evidence))
        self.assertEqual(code, 0, report)
        self.assertEqual({(f['width'], f['height']) for f in report['files']}, {(31, 17), (8, 40)})
        self.assertFalse((self.evidence / 'a.png').exists())
        self.assertFalse((nested / 'b.png').exists())
        self.assertTrue((self.evidence / 'a.avif').read_bytes()[4:12] in (b'ftypavif', b'ftypavis'))
        self.assertTrue((nested / 'b.avif').exists())
        self.assertTrue((self.evidence / 'notes.txt').exists())

    @unittest.skipUnless(has_converter(), 'no AVIF converter')
    def test_existing_avif_is_kept_and_png_not_removed(self):
        write_png(self.evidence / 'a.png', 4, 3)
        (self.evidence / 'a.avif').write_bytes(b'previous')
        code, report = self.run_script(str(self.evidence / 'a.png'))
        self.assertEqual(code, 1)
        self.assertIn('already exists', report['files'][0]['error'])
        self.assertTrue((self.evidence / 'a.png').exists())
        self.assertEqual((self.evidence / 'a.avif').read_bytes(), b'previous')

    def test_corrupt_png_fails_and_is_kept(self):
        (self.evidence / 'bad.png').write_bytes(b'not a png at all, but long enough')
        code, report = self.run_script(str(self.evidence / 'bad.png'))
        if code == 3:
            self.skipTest('no AVIF converter')
        self.assertEqual(code, 1)
        self.assertTrue((self.evidence / 'bad.png').exists())


if __name__ == '__main__':
    unittest.main()
