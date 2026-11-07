# Result

Fixed: the first attachment can be lost without unmounting the composer.
No upload protocol, daemon, contract, appearance or timeout change.

## Cause and deterministic reproduction

App adopts creation storage when its reply arrives. BrowserConversation used
another adoption during render, then cleared its `creationOf` ref immediately.
A concurrent ID render can yield before Composer receives the new draft props.
The mounted composer still writes to the creation draft. If the first upload
answers there, the resumed render has already consumed its adoption marker,
and useConversation reads the earlier ID draft instead of the newly edited
creation draft. Later uploads append to that value: five chips, no error.

A controlled React Suspense harness holds the ID render before it traverses
Composer, and resolves each of six upload promises individually. With the old
extracted useConversation draft logic and BrowserConversation render-adoption
logic, the middle ordering fails deterministically with **5 instead of 6 chips**;
first-before and first-after pass. The field remains connected. This establishes
the reachable loss mechanism, not the exact scheduler trace of the original gate.
An initial sibling-only suspension did not hold Composer traversal and all three
old-code cases passed; wrapping Composer in the barrier produced the failure.

The production draft hook now carries the mounted creation draft across the
ID change, retains its originating identity/workspace (worktree creation changes
workspace too), and adopts late draft/held storage at commit. Composer's async
upload callbacks see committed props, not speculative renders. Existing draft
keys and per-tab persistence remain unchanged; no registry or alias map added.

## Independent review and assessment

`/llm-review` (claude-fable-5-1 finder, gpt-6-astra concurrency verifier) and
`/assess-findings`: two confirmed findings, both fixed here.

- Finder caught the initial patch's use of the destination workspace as the
  creation source. App's worktree handover changes both ID and workspace. The
  hook now retains the origin; all three ordering cases also cover worktrees.
- Verifier found `useHeldMessages.latest` also exposed a speculative ID: sending
  a second held message during suspended handover could post the first early,
  and a definite refusal restored its text into a draft the handover overwrote.
  Locally reproduced with both production hooks (one unexpected precommit POST).
  The ref now publishes at commit. The test requires zero precommit POSTs,
  ordered delivery afterwards, refused text restored, and no old held entries.

Review/assessment artifacts are local ignored `history/*attachment*` files;
these findings and their evidence are recorded here so they survive cleanup.
No unaddressed actionable findings or follow-up issues. Performance logging
was explicitly omitted because its writer publishes and this worker must not push.

## Validation

Birch; base `bed8ac600` plus this issue's final code diff; umask 077,
private `/var/tmp/oh-attach-*` scratch, `OH_PORT_BASE=16600`, two browser workers.
Dependencies installed from both committed npm locks.

- `./scripts/test-focused.sh --area web`: **1381 tests / 181 files**, static
  checks and typecheck passed.
- `npx vitest run src/app/useConversationDraft.test.tsx src/app/heldMessages.test.tsx`
  from web: **13 passed**, including eight new regression cases.
- `./scripts/test-focused.sh --area browser --spec attachment-documents.spec.ts`:
  **2 passed**, held creation/upload, document previews and axe coverage.
- Same focused entrypoint, `attachments.spec.ts`: **2 passed**.
- Same entrypoint, `lab-slow-creation.spec.ts`: **3 passed**.
- Same entrypoint, `lab-worktree-agent.spec.ts`: **1 passed** (includes a11y).
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`,
  `git diff --check`: passed.

Host-backed browser results are synthetic; no live server or real provider was
used. Go/contracts unchanged, so their checks were not run. No whole browser
suite or clean gate: integrated-main confirmation remains the conductor's job.
No push or deployment. No visual changes needing screenshots.

## Decisions for later review

None. Preserving typed text, attachments and held messages implements the
already-agreed behavior; no product or authority boundary changed.

## Tool/sub-workflow failures

Expected red regressions above established the two races and now pass.
Exploratory rg/ls calls used nonexistent Composer/message-composer paths and
an absent held-spec glob; corrected scoped lookups found the real files.
`test-focused.sh --help` prints usage with exit 2; ordinary documented checks
then passed. No required review, test or command remains incomplete.
