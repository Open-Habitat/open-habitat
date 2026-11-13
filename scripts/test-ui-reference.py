#!/usr/bin/env python3
import contextlib
import importlib.util
import io
import os
import re
import shutil
import subprocess
from pathlib import Path
import tempfile
import tarfile
import unittest

spec = importlib.util.spec_from_file_location("generator", Path(__file__).with_name("generate-ui-reference.py"))
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


# `source "$repo/scripts/x.sh"` or `source "$(dirname "$0")/x.sh"`.
SOURCED = re.compile(r'^\s*(?:source|\.)\s+"?(?:\$repo/scripts/|\$\(dirname "\$0"\)/)([\w.-]+\.sh)"?', re.M)


def copy_with_sourced(names, scripts):
    """Copy entry scripts and, transitively, the helpers they source, so a new
    helper does not need a hand-kept list here."""
    pending = list(names)
    while pending:
        name = pending.pop()
        if (scripts / name).exists():
            continue
        source = Path(__file__).with_name(name)
        shutil.copy2(source, scripts / name)
        if name.endswith(".sh"):
            pending += SOURCED.findall(source.read_text())


class ReferenceTest(unittest.TestCase):
    def test_fast_entrypoints_allow_reference_drift(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts = root / "scripts"
            scripts.mkdir()
            copy_with_sourced(("test-focused.sh", "test-web-fast.sh", "generate-ui-reference.py"), scripts)
            self.assertTrue((scripts / "scratch.sh").exists())
            src = root / "web/src/app"
            src.mkdir(parents=True)
            for name in ("settingsIndex.ts", "settingsRoute.ts"):
                (src / name).write_text("export {};")
            generator.sync(root)
            bins = root / "web/node_modules/.bin"
            bins.mkdir(parents=True)
            for name in ("vitest", "npm"):
                tool = bins / name
                tool.write_text("#!/bin/sh\necho npm-reached\n")
                tool.chmod(0o755)
            env = dict(os.environ, PATH=f"{bins}:{os.environ['PATH']}")
            for command in (["bash", str(scripts / "test-web-fast.sh")],
                            ["bash", str(scripts / "test-focused.sh"), "--area", "web"]):
                with self.subTest(command=command):
                    result = subprocess.run(command, env=env, capture_output=True, text=True)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertIn("npm-reached", result.stdout)
                    (src / "settingsIndex.ts").write_text("export const changed = true;")
                    result = subprocess.run(command, env=env, capture_output=True, text=True)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertIn("npm-reached", result.stdout)
                    self.assertNotIn("changed", (root / generator.OUTPUT / "app--settingsIndex.ts.md").read_text())
                    generator.sync(root)
                    (src / "settingsIndex.ts").write_text("export {};")
                    generator.sync(root)

    def test_package_regenerates_without_changing_checkout(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            repo = Path(__file__).resolve().parents[1]
            for folder in ("scripts", "cmd", "internal/daemon/ui-skill/references", "web/src/app", "web/dist", "bin"):
                (root / folder).mkdir(parents=True)
            for name in ("package-release.sh", "generate-ui-reference.py"):
                shutil.copy2(repo / "scripts" / name, root / "scripts" / name)
            for folder in ("systemd", "sysusers.d", "tmpfiles.d", "apparmor.d", "licenses", "site"):
                shutil.copytree(repo / folder, root / folder)
            for name in ("go.mod", "go.sum", "policy.go"):
                (root / name).write_text("")
            (root / "web/dist/index.html").write_text("production fixture")
            for name in ("settingsIndex.ts", "settingsRoute.ts"):
                (root / "web/src/app" / name).write_text("fresh-source-marker")
            stale = root / generator.OUTPUT / "app--settingsIndex.ts.md"
            stale.write_text("stale-marker")
            obsolete = root / generator.OUTPUT / "removed.ts.md"
            obsolete.write_text("obsolete-marker")
            # Observe all three actual package build invocations at the compiler
            # boundary; the real compiler/archive verification is tested separately.
            go = root / "bin/go"
            go.write_text('''#!/usr/bin/env python3
from pathlib import Path
import sys
refs = Path("internal/daemon/ui-skill/references")
assert "fresh-source-marker" in (refs / "app--settingsIndex.ts.md").read_text()
assert not (refs / "removed.ts.md").exists()
out = Path(sys.argv[sys.argv.index("-o") + 1])
out.write_text("#!/bin/sh\\necho operator-fixture\\n")
out.chmod(0o755)
''')
            go.chmod(0o755)
            git = root / "bin/git"
            git.write_text("#!/bin/sh\necho 0123456789012345678901234567890123456789\n")
            git.chmod(0o755)
            env = dict(os.environ, PATH=f"{root / 'bin'}:{os.environ['PATH']}", TMPDIR=directory)
            archives = []
            for output in ("one", "two"):
                result = subprocess.run(["bash", str(root / "scripts/package-release.sh"),
                    "--version", "0.0.0-test", "--target", "linux-arm64", "--web-dir", str(root / "web/dist"),
                    "--output", str(root / output)], env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                archive = root / output / "open-habitat-0.0.0-test-linux-arm64.tar.gz"
                archives.append(archive.read_bytes())
                with tarfile.open(archive) as package:
                    self.assertFalse(any("/source/" in name for name in package.getnames()))
            self.assertEqual(archives[0], archives[1])
            self.assertEqual(stale.read_text(), "stale-marker")
            self.assertEqual(obsolete.read_text(), "obsolete-marker")

    def test_drift_add_change_remove_and_keyboard_discovery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative, text in {
                "text/demo.tsx": 'const fi = {name: "Nimi"}; catalog(fi, {name: "Name"});',
                "app/settingsIndex.ts": 'const rows = [{id: "account", admin: true}];',
                "app/settingsRoute.ts": 'const alias = "tili";',
                "components/NewControl.tsx": 'onKeyDown={(e) => e.code === "Escape"}',
                "components/NewControl.test.tsx": 'onKeyDown="test-only"',
            }.items():
                path = root / "web/src" / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text)
            self.assertTrue(generator.sync(root))
            self.assertTrue(generator.sync(root, check=True))
            out = root / generator.OUTPUT
            self.assertIn('e.code === "Escape"', (out / "components--NewControl.tsx.md").read_text())
            self.assertFalse((out / "components--NewControl.test.tsx.md").exists())
            for change in ("text/demo.tsx", "text/added.ts", "app/settingsIndex.ts", "components/NewControl.tsx"):
                (root / "web/src" / change).write_text('onKeyDown="changed"')
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertFalse(generator.sync(root, check=True))
                generator.sync(root)
            (root / "web/src/text/added.ts").unlink()
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertFalse(generator.sync(root, check=True))
            generator.sync(root)
            self.assertFalse((out / "text--added.ts.md").exists())
            self.assertTrue(generator.sync(root, check=True))


if __name__ == "__main__":
    unittest.main()
