#!/usr/bin/env python3
import contextlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("generator", Path(__file__).with_name("generate-ui-reference.py"))
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class ReferenceTest(unittest.TestCase):
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
