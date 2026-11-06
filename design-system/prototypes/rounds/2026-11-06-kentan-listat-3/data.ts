// Synthetic workspace for the round: the files and commands the composer's
// lists read. The order is the daemon's: changed files first, then Git's
// path order (workspace_composer_files_linux.go).
import type {GitMark} from '../../../../web/src/app/composerReads';

export type ProtoFile = {path: string; git?: GitMark};
export type ProtoCommand = {name: string; description: string; source: 'skill' | 'prompt' | 'extension'; scope: 'user' | 'project' | 'builtin'; terminal_only: boolean};

export const WORKSPACE = 'aurinkokello';

export const FILES: ProtoFile[] = [
  {path: 'src/shadow.py', git: 'modified'},
  {path: 'tests/test_shadow.py', git: 'modified'},
  {path: 'src/astro/refraction.py', git: 'modified'},
  {path: 'notes/2026-11-02-ajo.md', git: 'untracked'},
  {path: '.github/workflows/test.yml'},
  {path: 'LICENSE'},
  {path: 'README.md'},
  {path: 'docs/asennus.md'},
  {path: 'docs/kesaaika.md'},
  {path: 'docs/kuvat/varjo.png'},
  {path: 'notes/2026-10-30-ideat.md'},
  {path: 'pyproject.toml'},
  {path: 'src/__init__.py'},
  {path: 'src/astro/__init__.py'},
  {path: 'src/astro/declination.py'},
  {path: 'src/astro/equation_of_time.py'},
  {path: 'src/cli.py'},
  {path: 'src/sun.py'},
  {path: 'src/timezones.py'},
  {path: 'tests/fixtures/helsinki.json'},
  {path: 'tests/fixtures/sydney.json'},
  {path: 'tests/test_sun.py'},
  {path: 'tests/test_timezones.py'},
];

export const COMMANDS: ProtoCommand[] = [
  {name: 'skill:git-commit', description: 'Stage and commit working-tree changes as well-formed commits.', source: 'skill', scope: 'user', terminal_only: false},
  {name: 'skill:llm-review', description: 'Evidence-gated review of code, a diff, a plan or a document.', source: 'skill', scope: 'user', terminal_only: false},
  {name: 'skill:test-guide', description: 'Which tests to run and what each result proves.', source: 'skill', scope: 'project', terminal_only: false},
  {name: 'review', description: 'Review the working-tree diff before committing', source: 'prompt', scope: 'user', terminal_only: false},
  {name: 'changelog', description: 'Draft a changelog entry from recent commits', source: 'prompt', scope: 'project', terminal_only: false},
  {name: 'compact', description: 'Tiivistä keskustelu ja jatka', source: 'extension', scope: 'builtin', terminal_only: false},
  {name: 'mcp', description: 'Manage MCP servers', source: 'extension', scope: 'builtin', terminal_only: true},
];

/** Every folder that holds a listed file, with a trailing slash. */
export const DIRS: string[] = [...new Set(FILES.flatMap((f) => {
  const parts = f.path.split('/').slice(0, -1);
  return parts.map((_, i) => `${parts.slice(0, i + 1).join('/')}/`);
}))].sort();

const DIFFS: Record<string, string> = {
  'src/shadow.py': `@@ -41,7 +41,9 @@ def shadow_angle(when, place):
-    hour = when.hour + when.minute / 60
+    local = when.astimezone(place.tz)
+    hour = local.hour + local.minute / 60
+    hour += local.dst().total_seconds() / 3600
     declination = sun.declination(when)
     return angle(hour, place.lat, declination)`,
  'tests/test_shadow.py': `@@ -12,3 +12,9 @@ def test_noon():
     assert shadow_angle(NOON, HELSINKI) == approx(41.2)
+
+def test_dst_march():
+    when = datetime(2026, 3, 30, 12, tzinfo=HELSINKI.tz)
+    assert shadow_angle(when, HELSINKI) == approx(41.2, abs=0.1)`,
  'src/astro/refraction.py': `@@ -8,4 +8,4 @@
-REFRACTION = 0.5667
+REFRACTION = 0.5667  # degrees at the horizon`,
};

const TEXTS: Record<string, string> = {
  'README.md': '# Aurinkokello\n\nLaskee varjon kulman ja pituuden\nmissä tahansa ja milloin tahansa.\n\n## Asennus\n\n    pip install -e .',
  'notes/2026-11-02-ajo.md': '# Ajo 2.11.\n\n41 läpi, 2 epäonnistui.\n\n- test_dst_march\n- test_readme_example',
  'pyproject.toml': '[project]\nname = "aurinkokello"\nversion = "0.4.0"\nrequires-python = ">=3.11"',
  'src/sun.py': 'from math import sin, cos, radians\n\ndef declination(when):\n    day = when.timetuple().tm_yday\n    return -23.44 * cos(radians(360 / 365 * (day + 10)))',
};

/** The picker's bounded preview: Git's diff for a changed file, otherwise
 * its first lines; a folder shows what it holds. */
export function previewOf(path: string): {kind: 'diff' | 'text' | 'binary' | 'dir'; text: string} {
  if (path.endsWith('/')) {
    const inside = FILES.filter((f) => f.path.startsWith(path)).map((f) => f.path.slice(path.length));
    return {kind: 'dir', text: inside.join('\n')};
  }
  if (path.endsWith('.png')) return {kind: 'binary', text: ''};
  if (DIFFS[path]) return {kind: 'diff', text: DIFFS[path]};
  return {kind: 'text', text: TEXTS[path] ?? `# ${path}\n\n…`};
}
