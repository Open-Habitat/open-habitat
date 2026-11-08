// Synthetic workspace for the round: the files and commands the composer's
// lists read. The order is the daemon's: changed files first, then Git's
// path order (workspace_composer_files_linux.go).
import type {FileList, FileTree, GitMark, TreeEntry, TreeFolder} from '../../../../web/src/app/composerReads';
import {fuzzyScore} from '../../../../web/src/components/composer/completion';

export type ProtoFile = {path: string; git?: GitMark};
export type ProtoCommand = {name: string; description: string; source: 'skill' | 'prompt' | 'extension'; scope: 'user' | 'project' | 'builtin'; terminal_only: boolean};

export const WORKSPACE = 'aurinkokello';

export const FILES: ProtoFile[] = [
  {path: 'src/shadow.py', git: 'modified'},
  {path: 'tests/test_shadow.py', git: 'modified'},
  {path: 'src/astro/refraction.py', git: 'modified'},
  {path: 'notes/2026-11-02-ajo.md', git: 'untracked'},
  {path: 'src/AGENTS.md', git: 'modified'},
  {path: '.github/workflows/test.yml'},
  {path: 'AGENTS.md'},
  {path: 'LICENSE'},
  {path: 'README.md'},
  {path: 'docs/AGENTS.md'},
  {path: 'docs/asennus.md'},
  {path: 'docs/kesaaika.md'},
  {path: 'docs/kuvat/varjo.png'},
  {path: 'notes/2026-10-30-ideat.md'},
  {path: 'pyproject.toml'},
  {path: 'src/__init__.py'},
  {path: 'src/astro/AGENTS.md'},
  {path: 'src/astro/__init__.py'},
  {path: 'src/astro/declination.py'},
  {path: 'src/astro/equation_of_time.py'},
  {path: 'src/cli.py'},
  {path: 'src/sun.py'},
  {path: 'src/timezones.py'},
  {path: 'tests/AGENTS.md'},
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
  'src/AGENTS.md': `@@ -3,4 +3,6 @@ Laskenta on tässä kansiossa.
 Kulmat ovat asteina, ajat aina aikavyöhykkeen kanssa.
-Kesäaikaa ei käsitellä.
+Kesäaika lasketaan paikallisesta ajasta:
+käytä aina when.astimezone(place.tz) ennen tunteja.
+Älä laske kesäaikaa käsin.`,
  'src/astro/refraction.py': `@@ -8,4 +8,4 @@
-REFRACTION = 0.5667
+REFRACTION = 0.5667  # degrees at the horizon`,
};

const TEXTS: Record<string, string> = {
  'AGENTS.md': '# aurinkokello\n\nPython-kirjasto, joka laskee varjon kulman.\nTestit: pytest -q. Älä muuta julkista APIa\nilman README-päivitystä.',
  'docs/AGENTS.md': '# docs\n\nOhjeet ovat suomeksi. Kuvat ovat kansiossa\nkuvat/, ja jokaisella on alt-teksti.',
  'src/astro/AGENTS.md': '# astro\n\nTähtitieteen kaavat. Lähde jokaiselle\nvakiolle kommenttiin (Meeus, luku ja kaava).',
  'tests/AGENTS.md': '# tests\n\nJokainen korjattu virhe saa testin.\nFixturet ovat kansiossa fixtures/.',
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

const changedUnder = (dir: string) => FILES.filter((f) => f.git && f.path.startsWith(dir)).length;

/** One folder's direct children as the daemon lists them: folders first
 * with their changed counts, then files with their Git marks. */
function listing(dir: string): TreeFolder {
  const depth = dir ? dir.split('/').length - 1 : 0;
  const folders = DIRS.filter((d) => d.startsWith(dir) && d.split('/').length - 1 === depth + 1);
  const files = FILES.filter((f) => f.path.startsWith(dir) && !f.path.slice(dir.length).includes('/'));
  const entries: TreeEntry[] = [
    ...folders.map((path): TreeEntry => ({kind: 'folder', path, ...(changedUnder(path) ? {changed: changedUnder(path)} : {})})),
    ...files.sort((a, b) => a.path.localeCompare(b.path)).map((f): TreeEntry => ({kind: 'file', path: f.path, ...(f.git ? {git: f.git} : {})})),
  ];
  return {path: dir, entries, truncated: false};
}

/** file_tree: without a folder the root and every folder holding changes,
 * with one the folder and the folders above it. */
export function treeOf(folder: string | null): FileTree {
  const dirs = folder === null
    ? ['', ...DIRS.filter((d) => changedUnder(d))]
    : [folder, ...folder.split('/').slice(0, -2).map((_, i, a) => `${a.slice(0, i + 1).join('/')}/`).reverse(), ''].filter((d, i, a) => a.indexOf(d) === i);
  return {folders: dirs.map(listing), changed: FILES.filter((f) => f.git).length, truncated: false};
}

/** files: without rank the fuzzy score over the whole path; rank=name the
 * in-field order: whole name, part of the name, the name's letters, the path
 * only, and within a level changed first, then the shallowest. */
export function filesOf(query: string, rank?: 'name'): FileList {
  const terms = query.split(/\s+/).filter(Boolean);
  if (!terms.length) return {files: FILES, matched: FILES.length, truncated: false};
  if (!rank) {
    const files = FILES.map((f) => ({f, s: terms.reduce((acc, t) => { const v = fuzzyScore(f.path, t); return acc < 0 || v <= 0 ? -1 : acc + v; }, 0)}))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.f);
    return {files, matched: files.length, truncated: false};
  }
  const q = terms.join(' ').toLowerCase();
  const level = (path: string) => {
    const name = path.split('/').pop()!.toLowerCase();
    const stem = name.replace(/\.[^.]+$/, '');
    if (name === q || stem === q) return 0;
    if (name.includes(q)) return 1;
    if (fuzzyScore(name, q) > 0) return 2;
    if (fuzzyScore(path, q) > 0) return 3;
    return -1;
  };
  const files = FILES.map((f) => ({f, l: level(f.path)})).filter((x) => x.l >= 0)
    .sort((a, b) => a.l - b.l || Number(!a.f.git) - Number(!b.f.git) || a.f.path.split('/').length - b.f.path.split('/').length || a.f.path.localeCompare(b.f.path))
    .map((x) => x.f);
  return {files, matched: files.length, truncated: false};
}
