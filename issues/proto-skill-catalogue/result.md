# Skill catalogue prototype

## Native facts established before choosing the UI

The host pins **`@earendil-works/pi-coding-agent` 1.3.0** in
`internal/daemon/pi-device-test/package.json`. Its worktree `node_modules` is
absent, so this investigation used the installed package at the **same 1.3.0
version**, reading `docs/skills.md`, `docs/settings.md`, `docs/packages.md`,
`docs/configuration.md` and the implementation below. This is Pi-only; the host
runs Pi RPC (including provider bridges), not separate Claude Code/Codex skill
loaders. No other harness's discovery rules are assumed.

### Where skills come from

- User: `<agent-dir>/skills`, normally `~/.pi/agent/skills`, and
  `~/.agents/skills`. The agent directory can be overridden.
- Trusted project: `.pi/skills` under Pi's working directory, plus
  `.agents/skills` from that directory upwards through the repository root
  (upwards to filesystem root when there is no repository). `.pi/skills` does
  **not** use the same ancestor walk.
- Explicit skill paths in user/project settings, CLI `--skill` and Pi packages
  add sources; settings filters and `--no-skills` can change what loads. Package
  provenance can identify a package, but a local skill has no universal version.
- Directory discovery finds `SKILL.md` recursively; a directory with `SKILL.md`
  is a skill root, not an invitation to recurse further. Pi locations also allow
  standalone Markdown skills. Ignore files, missing descriptions, malformed
  frontmatter and trust affect discovery. It is not a generic filesystem census.
- Project trust matters: untrusted project skill sources are not loaded. Pi RPC
  cannot ask a native interactive trust question; remembered trust or native
  configuration is needed. The host launches Pi with its own HOME and workspace
  cwd; this prototype does not add browser trust authority.

### Which name wins — verified, not inferred from “local overrides global”

`dist/core/skills.js::loadSkills` keeps the **first discovered name**, resolves
real paths to deduplicate the same file and emits collision diagnostics with
`winnerPath` and `loserPath`. Importantly, its standalone `includeDefaults:true`
branch loads user before project, but this is **not** the runtime loader's path.

`dist/core/resource-loader.js` resolves resources first, then calls `loadSkills`
with `includeDefaults:false`. `dist/core/package-manager.js::resolve` orders
packages before explicit settings resources before autodiscovery; project and
user package declarations are resolved with project first. For autodiscovered
skills, `addAutoDiscoveredResources` orders project `.pi`, project ancestor
`.agents` (nearest first), user `.pi/agent`, user `.agents`. CLI skill resources
are prepended by the resource loader. Therefore **for the prototype's trusted,
default-source fixture, the repository `review` wins over global `review`**.
It would be wrong to hard-code that as the universal precedence for every
package/settings/CLI configuration.

`native-check.mjs` in this round creates an isolated synthetic HOME and loads the
actual 1.3.0 `DefaultResourceLoader`, without extensions, providers or a session.
It verifies project `review` wins, both `.agents` locations load, a collision
contains both paths, and switching project trust off removes project skills and
restores global `review`. The run passed; raw output is retained on Alder at
`/var/tmp/proto-skill-catalogue/native-proof.json`.

### What a skill actually tells us

`name` and `description` come from frontmatter (name falls back to the parent
directory); Pi carries `filePath`, `baseDir`, `sourceInfo` and
`disableModelInvocation`. Name/description validation often warns, but a missing
or empty description is not loaded. `disable-model-invocation:true` hides it
from automatic model selection, not from explicit `/skill:name` invocation.
Other specification fields such as license/compatibility/metadata can be in the
file, but are not a normalized version/author/usage record in Pi's loaded Skill
object. The prototype shows only name, description, scope, source file and
collision status. It does not invent versions, last-used dates, popularity,
installation state, tags, or proof that the model read the skill.

### What the host already exposes

Pi RPC `get_commands` (`dist/modes/rpc/rpc-mode.js`) returns effective skills as
`skill:<name>`, description, source=`skill`, and native `sourceInfo`. In this
version RPC enumerates those skills directly; the TUI's `enableSkillCommands`
setting should not be mistaken for a filter on this RPC response.

`internal/daemon/pi_bash_linux.go::parsePiCommands` deliberately reduces the
native response to name/description/source/scope, **no paths**. The composer
already offers these under `/`, tagged by source and scope
(`web/src/components/composer/Composer.tsx::commandGroups`). It completes a
command into the draft, not immediate skill execution. This is already a small
effective-skill catalogue, but does not include losing name collisions, the
source file or an all-repository inventory. A catalogue needs a later native
read/diagnostic surface for those facts, not a registry or another persistent
store. Available in a session is not evidence of use in that session.

## Choice for Jari

Axis: **where a person discovers and inspects skills**. Same six invented skill
files throughout: two global, two in `aurinkokello`, two in `kuukartta`; one name
collision (`review`). A workspace has three effective skills and one visible
shadowed file. Descriptions stay in their native English; UI labels are Finnish.
Paths use `~` for the person's own home. No real user's skill inventory is
published.

1. **Asetukset.** A shared list with repository context selector and an additional
   “Kaikki työtilat” view. Best for “what do I have anywhere?”; less direct when
   deciding which skill Pi will choose now. All-workspaces view deliberately
   does not assign one global collision winner.
2. **Työtilan taidot — recommendation.** A workspace Taidot view, two columns on
   desktop and one on phone. It makes scope and the winning source concrete;
   global skills remain visible, including the shadowed file. A global inventory
   can later be a secondary route, rather than making Settings the primary
   place for a workspace-dependent answer.
3. **Kentän /-katalogi.** A larger inspection panel directly above the composer.
   Same source and collision information, plus “Lisää /skill:name” only for
   effective skills. Insertion fills the draft and closes the panel; it never
   sends. Fast at point of use, but competes with writing space, especially on
   phone. The ordinary `/` completion can remain lightweight regardless of the
   chosen catalogue placement.

The “Esimerkkityötila” selector in B/C is a **prototype scenario control** for
comparing the two invented contexts, not a cross-repository command mechanism.
A real composer catalogue would be bound to the current native Pi session.
Settings' repository selector only filters inspection, never changes the active
conversation. The full conversation top row and rail provide production context;
unrelated actions are explicitly inert. The editor button opens a labelled
synthetic file preview. It does not access files or bypass the editor's current
workspace boundary; opening global/outside-workspace files requires a later
implementation decision respecting per-user file authority. No broad editor
permission or new authority is proposed here.

Try: switch direction; search by name/description/path; compare both workspaces;
inspect both `review` files; close/reopen; in C insert the effective skill into a
retained draft. Compare desktop and phone, light and dark.

**Question:** should skill inspection live primarily with the workspace (B), in
Settings (A), or next to writing (C)? No selection is recorded; the issue stays
open. Implementation is later work.

## Scope and reproduction

Only round-local synthetic HTML/CSS/JS and this issue's result/evidence are
changed, plus a Finnish review link in KOKEILTAVAA. No product, contract,
persistent store, deployment or installed tool change. Source grounding includes
`Navigation.tsx::AgentHeader`, composer command grouping, daemon Pi launch/command
parsing, design instructions/tokens and the editor-buttons/folder-access rounds
from 21 October. This uses their header geometry and production SVG paths, not
a generic extra toolbar. Alder has no local browser dependencies and its policy
forbids a local specialist browser/lab run; authored HTML checks run remotely on
Cedar with existing disposable Playwright/Chromium. No production lab, live
host or real profile is claimed.

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-21-taidot
node design-system/prototypes/rounds/2026-10-21-taidot/publish-build.mjs
# On a browser-capable host with Playwright:
node check.mjs 2026-10-21-taidot.html evidence
# Native fixture (disposable HOME only):
HOME=/var/tmp/oh-skill-fixture node native-check.mjs /absolute/path/to/pi-coding-agent
```

Hosted publication strips embedded font faces to avoid Glasspad CSP errors;
token fallback font stacks are used there. Offline evidence retains bundled
Instrument Sans / JetBrains Mono. This is a hosting limitation, not a product
font change.

## Published comparison and verification

Review: https://glasspad.example.test/p/vddh6awkzhufa5iu4zgcv6ixji/

Stable space key: `open-habitat-proto-skill-catalogue`. Only the generated
synthetic `index.html` was uploaded, not the issue, captures, local native output,
credentials or actual skill files. Content inspection found no personal HOME,
auth file or API key; two URL strings are highlight.js diagnostic help links,
not external resources or requests. Hosted HTML SHA-256:
`2d15a1f3bf4dd3825a39566c665a8c775ee2cc05a5e500a32ef3a67a92df2e53`.

Publication:

```sh
glasspad publish design-system/prototypes/dist/skill-catalogue-space \
  --space-key open-habitat-proto-skill-catalogue --no-open --json
# Same check, against the real hosted sandbox:
node check.mjs https://glasspad.example.test/p/vddh6awkzhufa5iu4zgcv6ixji/ hosted-evidence
```

- **114 offline checkpoints passed** and **114 hosted checkpoints passed**:
  3 directions × 1440/1366/390 px × light/dark; default collision, effective
  source file, editor preview opening/Escape/closing, name search, empty search,
  second repository without collision, Settings' all-repository list, retained
  draft, composer insertion without send, last-row scrolling and horizontal
  control/document bounds. Zero console/page errors in both final runs.
- Six AVIF screenshot/offline-HTML pairs in `evidence/`: each direction at
  1440/light and 390/dark. Captures are authored-prototype evidence, **not**
  host-backed integration/lab evidence. Scripts were removed from snapshots;
  bundled fonts remain embedded. PNG capture output was encoded using
  `avifenc -j 2 -s 10 -q 75`.
- Remote checks used disposable `/var/tmp/oh-proto-skills-01m5ev1nk` on Cedar,
  reusing its already available prototype Playwright dependency and cached
  Chromium, not a personal browser profile or global installation.
- Native loader fixture passed for trusted and untrusted sources. Prototype
  build, round/check/native-check syntax, project-view validation, issue doctor
  and `git diff --check` passed. Doctor retains unrelated existing attachment
  advisories. No full product gate or deployment is claimed for synthetic HTML.
- **Self-review:** inspected desktop B and phone A/C captures; checked the full
  production-context title row, path wrapping, hidden-file collision clarity,
  scope changes, modal preview, retained draft and hosted restrictions. Kept
  native descriptions untranslated and distinguished “available” from “used”.
  Corrected the all-workspace status to avoid inventing one winner without a
  workspace, qualified precedence to these fixture sources, and labelled B/C's
  workspace switching as prototype scenarios rather than cross-repo execution.
  No independent model review was requested or claimed.

Logs on Alder: `/var/tmp/proto-skill-catalogue/` contains `native-proof.json`,
`browser-scoped.log` (final offline), `hosted.log`, `publish.json`, `doctor.json`
and diagnostic logs below.

## Failure / incomplete-work inventory

No required source check, review, build, browser matrix or publication remains
incomplete. The issue remains open deliberately, not because implementation
was attempted and failed.

- First offline matrix asserted a row count during the shared picker's
  requestAnimationFrame remount (zero rows). Added an explicit row-ready wait.
  The next two runs exposed overly broad test locators: the builder has a second
  hidden `dialog` and `textarea`. Scoped them to `.s-editor` and `.s-demo`.
  These were check-harness errors; all final offline and hosted cases passed.
  Logs: `browser.log`, `browser-final.log`, `browser-corrected.log`, then
  `browser-scoped.log` under the log directory above.
- Initial publication preflight rejected highlight.js's embedded diagnostic URL
  strings because its broad grep treated any URL as an external request. No
  upload happened in that attempt. Inspected the two matches and resource
  attributes, confirmed synthetic-only/self-contained content, then published
  successfully and ran the full hosted matrix with zero console errors. Log:
  `publish-scan.log`; successful receipt `publish.json`, check `hosted.log`.
- Optional discovery probes found absent worktree dependencies, guessed component
  and config paths and an initially mistaken refreshed-skill target subpath.
  Used the actual component path, same-version installed Pi, effective Glasspad
  config and remote disposable browser dependencies. No required input is
  missing; no tool installation or shared service change was needed. Details:
  `discovery-misses.log` and the task transcript (large initial command output
  at `/tmp/pi-bash-215b4d7e91e6e83a.log`).
- Existing Glasspad font sandbox limitation is handled explicitly by the hosted
  build and disclosed in the prototype. Offline fonts are unchanged.
