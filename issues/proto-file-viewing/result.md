# Result: file viewing and file links prototype round

Round directory `design-system/prototypes/rounds/2026-10-19-tiedostot/`. Build it in
`design-system/prototypes/` with `node build.mjs rounds/2026-10-19-tiedostot` and open
`dist/2026-10-19-tiedostot.html`. Picker keys 1–3, `R` replays the turn. Screenshots of each
direction's key states, in light, dark and phone, are in [shots/](shots/).

The fixture is a conversation in the `open-habitat` workspace. Pi rewrites the quota texts in
`web/src/components/QuotaMeter.tsx` and `internal/daemon/quota_linux.go`, then runs
`go test` and vitest, and fixes the test that expected the old text. The prototype has its own
18-file tree with committed and working-tree versions, so it can show diffs and "M" marks. The
live turn's `sed` step really changes the test file during the turn.

Research facts come from `issues/research-shell-editor/report.md`, which landed on main while
this round was being built. Those facts are cited as such, and the rest are marked as
assumptions.

## Common to all directions: recognition

Every direction recognises the same file references. Only a path that exists in the
workspace becomes a link. Everything else stays plain text.

- These become links: workspace-relative paths in prose, code and tool output
  (`web/src/components/QuotaMeter.tsx:35-40`, `…quota_linux.go:37`), `@path` in the user's
  message, absolute paths inside the workspace (the `slog` `source=/home/maintainer/Sources/open-habitat/internal/daemon/snapshot.go:18`
  line the user pasted), `rg` output, `git diff --stat` lines and `a/` and `b/` diff paths.
- A path is resolved against the directory its tool call ran in. `go test ./internal/daemon`
  prints `quota_linux_test.go:15`, which resolves to `internal/daemon/`. Vitest under
  `npm --prefix web` prints `src/components/…`, which resolves to `web/`.
- These stay text: `web/src/strings/quota.ts`, which Pi only proposed and which does not
  exist; `~/.local/state/open-habitat/daemon.log`, which is outside the workspace; module
  paths such as `github.com/…/internal/daemon`; and bare words.
- A line or range highlights those lines. A `--stat` or diff path opens the diff. A file
  tool card (read/write/edit) gets "Avaa tiedosto" or "Näytä muutos" in its box's side rail,
  because the card header is itself a button and cannot contain a link.
- The link looks the same everywhere: the text colour plus a dotted underline that turns solid
  on hover. It is a real `<a>`, so it is reached with Tab and opened with Enter.

## Axis: where the file opens relative to the conversation

| # | Direction | Where the file opens | When it wins | Its cost |
|---|---|---|---|---|
| 1 | **Rinnalla** | In a panel beside the conversation (half the width). On a phone the panel covers the conversation and has a "‹ Keskustelu" back button. The panel has a tree, search, Tiedosto/Muutokset, editing and copy path. The top bar's files button opens the same panel on the tree, with the workspace's changes listed. | The conversation and the file are needed together: you read Pi's reply while looking at the lines it names. Esc closes the panel and returns focus to the link. | It halves the conversation column on a laptop. Editing and the tree are cramped in a 500-px panel, so the tree replaces the file there instead of sitting beside it. |
| 2 | **Editori** | In the workspace's VS Code (code-server), which is the conversation's alternative view behind a Keskustelu/Editori switch in the top bar. A link opens a tab at the line. Source Control lists the changes, and a diff opens side by side (inline on a phone). Editing works, and Ctrl+S saves. | Real editing of the whole repository with a native tool: search, terminal, extensions and multi-file edits. VS Code is the tool Jari already knows. | It is a different product inside ours: English UI, its own look and keys. Esc and shortcuts belong to VS Code, so the way back is the top-bar switch. It is poor on a phone (Monaco does not support mobile; research). Each person costs 0.4–0.8 GB of memory while it runs (research). It needs its own origin (research), and opening `path:line` in a running window has not been verified (research). |
| 3 | **Kurkistus** | Inside the conversation, a few-line window under the link: the lines around the target, more lines on demand, and Tiedosto/Muutokset. "Avaa" or the top bar's files button opens a full **Tiedostot** page in place of the conversation: tree, search, file, diff and editing, with "‹ Keskusteluun" to go back. | A glance without losing your place, especially on a phone. Most links are "show me where" and need no editor. The page gives the whole repository when it is wanted. | Two places to look at a file, not one. A long peek pushes the conversation down. Editing happens only on the page, which hides the conversation. |

## Recommendation

**Kurkistus for links, with its Tiedostot page as the built-in browser, and code-server
later as an optional "Avaa VS Codessa" from that page.** The axis is a real choice for links,
but the research has already settled the layering: a small built-in, read-mostly view for links
and phones, and code-server only for "open the whole repo" on its own origin. Kurkistus fits
that layering best:

- A file link in a conversation is almost always "where?", and the peek answers that in place,
  on a phone too, without any view or panel switch. Rinnalla gives the same answer but costs
  half the conversation on a laptop and the whole conversation on a phone.
- The Tiedostot page is the same component as Rinnalla's panel, at a size where the tree and
  file sit side by side. It covers browsing the whole repository without VS Code, and it is
  the right place for an "Avaa VS Codessa" button once code-server exists.
- Editori as the primary target makes every link depend on the heaviest component (memory,
  own origin, unverified `path:line` opening) and fails on a phone. It is worth having, but as
  a destination you choose, not where links land.

If Jari mostly works on a laptop with the conversation and the code side by side, Rinnalla is
the alternative. The peek and the panel share the same viewer and recognition, so the choice
changes only the container.

## What Jari decides

1. **The direction for links and for browsing** (above). If he chooses Rinnalla or Kurkistus,
   should the built-in view allow editing, or should it be read-only, as the research's first
   slice is? The prototype edits in both, with conflict detection (see below).
2. **Architecture (his decision): a daemon file API.** Every direction needs the per-user
   daemon to read files, read their `HEAD` version (`git show HEAD:path`) and list the tree,
   as the person. Directions 1 and 3 with editing also need a write. Proposed authority, all as
   the person in the daemon and nothing new in the gateway or broker:
   - Reads and writes are limited to the workspace root after resolving symlinks. Anything
     outside the root, including through a symlink, is refused even though the person could
     read it over a shell. That keeps the link view honest about "in this workspace" and does
     not make the browser a general file reader.
   - A write is compare-and-swap on the content hash or mtime the view read, so a write never
     overwrites Pi's change unseen.
   - Existence checks for links are batched per message: the browser sends the candidate
     paths, and the daemon answers with the ones that exist. No index or cache of the tree is
     kept, in line with the no-parallel-store rule.
3. **Architecture (his decision): code-server**, if Editori or "Avaa VS Codessa" is wanted:
   per-person on demand on a Unix socket, its own origin, `frame-ancestors` for embedding.
   This was the research's recommendation and is not decided here.

## Host facts the view assumes

- Workspace root and its path (snapshot already has it).
- A tree listing, the file content, the `HEAD` content, and which files differ from `HEAD`
  (`git status --porcelain`). The prototype shows "M" only. Added, deleted and renamed files
  are not drawn.
- For resolving tool output: the tool call's command (already in Pi history). The cwd
  heuristics (`go test ./pkg`, `npm --prefix`, `cd x &&`) run in the browser.
- For the conflict check: a content hash or mtime with every read, and a write that refuses
  a stale hash.

## Decisions for later review

- **Bare file names do not link** (`quota_linux.go` without a directory). The alternatives
  were to link a name that is unique in the workspace, or to search for it. A bare name is
  ambiguous across packages, and guessing would break the rule that a link is never wrong.
  The exception is a name that the tool call's cwd resolves (`go test` and `npm --prefix`
  output).
- **Only paths inside the workspace link.** The alternative was anything under the home
  directory. The workspace is what the view and tree show. A home-wide reader would be a new
  browser capability with no need behind it yet.
- **`path:12:5` is treated as line 12** (the column is ignored), and `path:12-20` is a range.
- **A diff opens for `--stat`, `a/` and `b/` paths and from edit cards.** Other links open
  the file. Tiedosto/Muutokset is offered whenever the file differs from `HEAD`.
- **Diff base is `HEAD`** (uncommitted changes), not the turn's own edits. The alternative,
  "what Pi changed in this turn", needs history replay. `HEAD` is what `git diff` shows.
- **The built-in viewer uses the product's tokens and syntax colours. The Editori stand-in
  uses VS Code's Light/Dark Modern colours and English UI**, to show the seam honestly. The
  real code-server has no Finnish language pack in its default build.
- **Esc in Editori does nothing**: VS Code owns its keys, and the top-bar switch is the way
  back. In the other directions, Esc closes the innermost layer and returns focus to the link
  or button that opened it.
- **Saving while Pi works is allowed, with a stale-content check.** The alternative was to
  block editing during a turn. The check is enough and does not stop someone fixing a typo
  mid-turn. In the prototype, open `internal/daemon/quota_linux_test.go` for editing early in
  the turn (Rinnalla, R to replay) and save after the `sed` step to see the refusal.

## Checks run

- `node build.mjs rounds/2026-10-19-tiedostot` builds (435 kB, 3 directions).
- `check.mjs`: desktop light and dark and phone for all three directions, with a clean
  console.
- A round-specific Playwright pass (scratch script, not committed) took the 32 screenshots in
  `shots/` and asserted the following: Enter on a focused link opens the file with focus in
  the code, and Esc returns focus to the link (Rinnalla); Esc closes the page and then the
  peek, with focus back on the link (Kurkistus); the Editori switch returns to the
  conversation; `go test` and vitest names resolve against their cwd; `--stat` lines open the
  diff; missing and outside paths stay text; the absolute workspace path links. The console
  was clean.
- Reduced motion: entrance animations are off under `prefers-reduced-motion`. This was not
  separately screenshotted.
- No production code changed.
