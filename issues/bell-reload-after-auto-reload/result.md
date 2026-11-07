# Result — implemented decision A

Run: `01m6ty2hxwr520zs630sz68vd7`.
Base: `fbf72d747b8351e083a104a3b3db53f920f85d99`.

The investigation established that reconnect did not reload the document: the
old bundle kept running, so the bell's reload item was correct. One actual
reload already cleared it and preserved the draft. A real manual reload leaving
an outdated bell was not reproduced. Jari's 2026-11-07 decision A supersedes the
investigation's recommendation to retain manual-only recovery.

After a failed event connection opens again, the tab now checks the served
bundle and reloads automatically if different and safe. Recent focused input,
unanswered sends/queued messages, uploads, pending mutations, editable dialogs,
and dirty/saving browser documents keep it in place with the reload banner.
Deferred recovery stays manual rather than reloading later after a typing pause.
The existing draft persistence and bundle comparison remain unchanged.
Finnish and English banner copy now describes an update, not a failed connection.

## Checks and review

Final runnable tree: the production/test changes in this issue's Fixes-Issue
commit. On Birch, locked web and Pi fixture dependencies installed; Go/browser
commands used umask 077, a private /var/tmp directory, OH_PORT_BASE=17300 and
OH_BROWSER_WORKERS=2.

- `./scripts/test-focused.sh --area web`: static checks and 186 test files /
  1,394 tests passed after the final production changes.
- `./scripts/test-focused.sh --area browser --spec server-version-reload.spec.ts`:
  seven passed. Idle recovery navigates exactly once to release 1; typing and
  a held upload preserve the old document until explicit reload. Bar, bell and
  browser reload preserve the draft, serve no-store HTML and leave no bell;
  in-app settings confirm the bundle is current without a second navigation.
  Incompatible-contract manual recovery remains covered.
- `./scripts/test-focused.sh --area browser --spec reconnect-recovery.spec.ts`:
  ten passed. `--spec reconnect-paths.spec.ts`: two passed.
- Unit regressions cover focused input versus idle draft, ten-second expiry,
  editable dialogs without focus, and live editor blocker cleanup.
- Focused self-review traced the actual request owners: uploads do not enter
  MutationLayer, and conversation sends use ownWrites. Both are explicitly
  guarded instead of assuming the layer sees all writes. Reviewed identity
  generation fencing, late input during the bundle read, editor buffer safety,
  and sticky manual deferral. No daemon, contract, persisted session state or
  authority changes; no independent model review required.
- One invocation repeated `--spec`; the runner only selected the last value.
  The two omitted specs were then run separately and passed. Exploratory rg
  calls included nonexistent guessed paths; scoped searches corrected them.
- `issuectl doctor --json`, project-view validation and `git diff --check`
  passed (doctor lists existing unreferenced image attachments, no schema errors).
- No full gate, deployment or live-server verification. Browser evidence is
  host-backed synthetic: both release references use the same compiled code.
  No claim about two historical bundles, edge caches or UID isolation.

## Decisions for later review

- Recent typing means focused input within ten seconds. Alternative: any draft
  or focus blocks indefinitely. Ten seconds protects an active pause without
  treating a restored, idle draft as ongoing typing. Other focused form fields
  get the same protection as the composer.
- Any editable dialog blocks, even if pristine; alternative: bespoke dirty
  tracking in every dialog. Conservative deferral avoids losing selections and
  passwords without adding duplicate form state. Dirty/saving browser editor
  buffers also block because unlike conversation drafts they are not persisted.
- Pending/uncertain MutationLayer commands also block, not just sends/uploads;
  alternative: classify each command individually. Keeping visible unconfirmed
  work is safer than interrupting it for a convenience reload.
- A deferred update stays an explicit reload action until the next document
  load, rather than surprising the person on blur or a subsequent reconnect.
- Retain bundle-content comparison: a server-only release with identical web
  assets does not require a document reload. Alternative: reload on every
  server version change. The current comparison is exactly the bell's notion
  of outdated UI and avoids reloads that cannot change the page.
