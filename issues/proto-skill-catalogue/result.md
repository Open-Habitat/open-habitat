# Skill discovery prototype — round 2

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

Round 1's `native-check.mjs` creates an isolated synthetic HOME and loads the
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

## Round 2: adoption, not maintenance

Round 1's native facts above remain the boundary. Jari rejected its maintenance
axis on 21 October: `/` already serves a person who knows the command. Round 2
asks **where a person discovers what the agent can do for them**, including the
first visit and returning to find new repository skills. It supersedes round
1's review choice, not its loader investigation. The old comparison and evidence
remain in `design-system/prototypes/rounds/2026-10-21-taidot/` and `evidence/`.

### Three directions

1. **Galleria — recommendation.** One visible **Mitä agentti osaa?** button in
   the real conversation title-row context, with an “8 uutta” signal. Opens a
   dedicated use-case gallery, not the `/` popup. Works for both new and existing
   conversations; keeps discovery out of Settings and independent of whether a
   person knows a skill name. The long label is intentional: discovery needs words
   a new user recognizes; an unexplained icon would hide the feature.
2. **Työtilan taidot.** A workspace landing section, topics and a “Tiimi lisäsi
   repoon” shelf. Better for growing collections and understanding what the team
   has contributed, but a person staying in conversations could miss it. The
   phone has an explicit “Työtila › Taidot” route even when the desktop rail is
   absent. It is not a cross-workspace command browser.
3. **Aloita tästä.** A new conversation's first-run empty state: three concrete
   starting goals, plus **Tutustu taitoihin**. Returning users see a contextual
   suggestion in the synthetic slow-tests conversation. This is deliberately
   a different entry strategy, not another gallery layout. Its weakness is
   invisibility once the first conversation is underway. Context matching is a
   static fixture here, not a promised automatic recommendation service.

All directions use the same **25 synthetic skills in five topics**, 19 in this
repository and six in the person's own global directory. Eight repo skills were
added after the fixture person's last visit. Nine cards have **AI-ehdotus**;
the rest carry the skill's own presentation metadata. No packages, shared server
catalogue, other person's home, popularity, installs or usage counters. The real
production shell is represented by the same round-local title/rail/composer
presentation used in round 1, grounded again in `Navigation.tsx::AgentHeader`,
`Composer.tsx::commandGroups` and design tokens. No product components changed;
this is authored HTML, not a production lab capture.

Try the first/returning-user scenario control (labelled as a prototype control),
open discovery, search by intended task or adding author's name, filter topics,
compare “Uutta sinulle” and “Repon yhteiset”, open a card, inspect both kinds of
metadata, and **Kokeile luonnoksessa**. That inserts `/skill:<native-name>` and
an editable example; it retains existing draft text and never sends. The
context is always the current `aurinkokello` conversation. Closed/first-run
states and the ordinary command-oriented `/` concept remain distinct. The `/`
control itself is not reimplemented by this prototype.

### Native and security meaning — Jari's clarified source rule

“Colleagues' skills” means skills colleagues committed into **this checked-out
repository's `.pi/skills` or `.agents/skills`**. Not a package marketplace or an
operator's shared directory. User-global skills remain available, but are not
attributed to colleagues. Discovery must use Pi's effective/trusted skill set;
a filesystem file alone is not evidence that the current session can invoke it.
No browser authority to approve project trust is proposed.

Provenance is **the author and time of the Git commit that added the skill
file**, not an invented author field or an assertion of original authorship.
The details explicitly say “lisäävän commitin tekijä” because adding someone
else's work is possible. Proposed derivation: inspect the current repo's local
history for the addition of each effective skill path (e.g. `git log --follow
--diff-filter=A --format=... -- <path>` with argv, not shell interpolation),
return author, author timestamp and commit ID. Timestamp should be timezone-aware
and compared as an instant; the prototype uses fixed UTC fixtures. No background
remote fetch or traversal into another person's repository/home is needed.
Missing, shallow or ambiguous history means **unknown**, not a guessed author,
mtime fallback or new badge. Renames/copies, historical imports and rebased times
need that honest interpretation; this is “added in Git”, not “published today”.
The Git author string is not a verified identity.

**Uusi sinulle** means the adding commit's timestamp is after this person's own
last viewed cutoff for this repository's discovery page. First visit has no
cutoff and is labelled “Ensimmäinen katselu”; it does not call every old skill
new. On later visits unseen additions carry the badge. “Merkitse katsotuksi”
explicitly advances the cutoff; no automatic acknowledgement merely for opening
a page or a card. This avoids badges vanishing before the person scans a long
collection. A real implementation should record the latest explicitly
acknowledged opening time in identity- and repository-scoped browser state (or
that person's home), never a host-wide registry. Browser-local state will not
synchronize devices; that is preferable to quietly adding account tracking.
The prototype is in-memory only: scenario switch/replay resets the simulated
cutoff, and no personal browser storage or Git history is read.

### Presentation metadata — own vs generated

Jari's second clarification explicitly permits generated or added discovery
metadata on top of existing skill content; generated and source-owned text must
be distinguishable.

Recommendation: keep accepted discovery text **in the skill's own frontmatter**,
next to `name` and `description`, committed as an ordinary repository change.
Colleagues can review the proposed wording and see the same result. It remains
part of the one native skill file, travels with its instructions and can be
corrected in the same diff. Do not build a separate editable catalogue store.
Generation must not silently rewrite a shared skill or imply team approval.
A generated, unsaved proposal is visibly **AI-ehdotus** on the gallery card and
**AI:n ehdottama esittely · ei vielä tallennettu taitoon** on the detail card.
The expandable “Esittelytietojen alkuperä” compares it with the original
`description`. Accepted frontmatter is presented as the skill's own metadata,
not as a permanent AI warning; Git keeps the review/change history. A new
metadata-only commit must not reset the skill's *adding* timestamp.

Proposed **new, optional** frontmatter, not current normalized Pi RPC fields:

```yaml
name: slow-tests
description: Investigate slow tests with measurements before suggesting changes.
metadata:
  open-habitat-title: Selvitä testien hitaus
  open-habitat-topic: Koodi ja testit
  open-habitat-when: Kun testiajo hidastaa työtä eikä syy ole selvillä.
  open-habitat-example: Selvitä tämän repon testien hitaus. Ehdota ensin mittausta.
```

The prefix and the four string-valued keys are proposals, not an adopted skill standard.
`description` remains the native fallback and is not translated/overwritten
behind the author's back. Missing presentation fields fall back to native
name/description, **Muut** topic and command-only draft insertion; absence must
not hide an otherwise valid skill. Do not pretend every current skill already
has Finnish use-case copy. “Mitä hyötyä” can be included in title/when; no extra
mandatory field is necessary. Topic labels are author-owned; a later UI may
normalize spelling for display without rewriting source text automatically.

Alternative for read-only files or personal wording: a **disposable per-person
cache keyed by full skill content hash plus generator/prompt version and
locale**. It is derived, never editable canonical data; invalidated on changed
content and always regenerable. Generated cache text remains an AI proposal
until saved into the skill file. No cache service, shared usage store or
cross-user scan is justified. Repo frontmatter is preferred over this cache
because it makes useful descriptions a reviewable team contribution rather
than 20 people maintaining 20 different descriptions of the same skill.
Prototype includes the distinction, not generation, persistence, save/commit
controls or a new command/contract. Exposing the raw optional metadata and Git
addition provenance needs a later read surface in the per-user daemon; current
RPC-reduced name/description/scope is insufficient. Gateway authority stays
unchanged.

## Decisions for later review

- Choose **Galleria**, **Työtilan taidot** or **Aloita tästä** as the primary
  discovery route. Recommendation: Galleria; optional onboarding can point to
  the same gallery later, but no combination is selected for Jari.
- Explicit “Merkitse katsotuksi” and identity/repo-scoped local cutoff, rather
  than marking everything seen automatically. First visit is not called new.
- Prefer reviewed, optional namespaced frontmatter to a personal hash cache.
  Mark unsaved generated text, not accepted text forever. Keys above need
  agreement at implementation time; this round does not adopt a schema.
- One click inserts a skill and editable example in the current draft, never
  auto-sends or creates a session as a side effect. Keeps user control and
  matches the existing command insertion model.

No choice is recorded. **Issue stays open for Jari**; implementation is later.

## Reproduction and scope

```sh
node design-system/prototypes/rounds/2026-10-21-taidot-2/publish-build.mjs
# On a disposable browser-capable host with existing Playwright:
node check.mjs index.html evidence
node check.mjs <published-url> hosted-evidence
```

Round-local files only, issue result/evidence, and one replacement review entry
in `KOKEILTAVAA.md`. Native round 1 facts retained above; native fixture was not
rerun because no loader behavior changed. No full product gate, deployment,
real-user capture or host-backed evidence is claimed. Publication contains only
the generated self-contained synthetic HTML. Hosted build removes data font
faces for Glasspad's CSP, retaining token fallback stacks; offline build keeps
bundled fonts. Final verification and publication receipt follow below.

## Publication and verification — round 2

Review: https://glasspad.example.test/p/vddh6awkzhufa5iu4zgcv6ixji/

The existing `open-habitat-proto-skill-catalogue` hosted space was replaced in
place. One generated synthetic HTML page only; neither reports nor screenshots,
real skill files, personal HOME paths or credentials were published. Preflight
checked for private HOME strings, external resource attributes and network
calls; none found. Published page SHA-256:
`74807bc5f35ab1daa605af875959394eaa0d725b855d1b670613c557654a199e`.

- **216 hosted checkpoints passed**: 3 directions × 1440/1366/390 px × light/dark.
  The same 216 also passed on the offline hosted payload; a separate offline
  bundled-font build also passed all **216 checkpoints** for retained evidence. Final results in
  `/var/tmp/proto-skill-adoption/verified.log` and `offline-bundled.log` on Alder.
- Checks exercise initial direction entry, 25-card catalogue, task search,
  empty search, five-item topic, 19 repo-only items, eight new additions vs
  first visit without a cutoff, own/generated metadata, Git provenance,
  Escape/button closing, last-card reachability, retained draft, safe insertion,
  explicit acknowledgement, returning/first-run scenario switching, horizontal
  control/document bounds and zero console/page errors.
- `evidence-round2/` holds paired static HTML and AVIF captures: all three
  entries and galleries at 1440/light and 390/dark; plus phone detail and draft
  states. They are authored-prototype evidence, **not host-backed lab evidence**.
  Script elements are removed from snapshots; font data remains offline.
- Browser runner: existing disposable Playwright dependencies on Cedar,
  `/var/tmp/oh-proto-adoption-01m5ez176`, no personal profile or local Alder
  specialist runtime. AVIF encoding uses `avifenc -j 2 -s 10 -q 75`.
- Round/check syntax, both build modes, project-view validation, issue doctor
  and `git diff --check` passed. Doctor retains unrelated existing attachment
  advisories. Issue remains open with preparation `pending` for Jari's choice;
  no scheduling or other issues were changed.
- **Self-review:** inspected desktop gallery entry and workspace landing, phone
  first-run state and expanded phone detail. The primary entry has words, not
  an unexplained icon; topics and descriptions stay readable in one column.
  Confirmed AI text is visibly a proposal, source says adding commit rather
  than claiming original authorship, personal/no-history entries have no new
  badge, and trying a skill never sends or discards a draft. Fixed the workspace
  mobile close-focus target to use its visible navigation rather than the
  hidden rail. Kept the first-visit state after draft insertion until explicit
  acknowledgement; the recent repo shelf remains present even when none is
  new to this person. No independent model review requested or claimed.

## Failure / incomplete-work inventory — round 2

No required publication, self-review or browser matrix remains incomplete.
No implementation was attempted; choosing the direction is deliberately pending.
Logs below are under `/var/tmp/proto-skill-adoption/` on Alder.

- Discovery probes: the Linux-style Chromium cache path was absent on the Mac
  browser host; used its existing `Library/Caches/ms-playwright` installation.
  `issuectl skill print issue` rejected the positional name; used documented
  `issuectl skill print --agent pi` to read current 0.21.0 instructions without
  modifying installed tools. A premature screenshot copy asked for a phone
  capture before that matrix reached it; final evidence copy succeeded. These
  optional probes did not change data or block any required input; `discovery-probes.log`
  summarizes these errors, and the refreshed skill is in `issue-skill-current.md`.
- Early matrices timed out trying to open discovery directly from direction B's
  conversation: its entry is on the workspace home, not an extra conversation
  button. Fixed the checker to follow that route; the next run hit the hidden
  desktop-rail Home button on phone and was scoped to the visible workspace
  navigation. Final matrices pass. Logs: `offline.log`, `offline-corrected.log`,
  `offline-final.log`, `hosted.log`; successful `verified.log`. The first test
  pipeline reported shell success despite the failed child because `tee` hid
  its exit; all later runs use `pipefail`, and no result is based on that exit.
- Round 1's previous investigations/recovered tool failures are in the previous
  version of this file in Git; none was repeated or silently claimed here.
