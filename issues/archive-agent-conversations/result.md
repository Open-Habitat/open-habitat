# Result — conversation archive

Browser-owned Pi conversations can be archived after a verified idle turn or confirmed child exit, restored in their workspace and deliberately continued on the same native `pi:<sessionId>`. The daemon checks native history, the discovered workspace and a fresh observation token before writing `archived_at` to the mapped user's XDG presentation state. The shared state-file writer serializes workspace visibility and archive updates; corrupt annotations are never overwritten. Terminal histories have no admitted archive path. Archived browser conversations cannot accept another browser send until restored. Restore starts no Pi process. Native JSONL is not moved or copied.

## Evidence

- `TMPDIR=/var/tmp/nah-archive-build go test ./internal/daemon -count=1`: passed (synthetic histories and controller; includes stale token, active writer, terminal history, archive/restore, preserved native bytes, corrupt annotation and post-archive send refusal).
- `npm run typecheck --prefix web`, `npm run lint --prefix web`, `npm run test:unit --prefix web`: passed. `npm run test:e2e --prefix web -- --grep 'archive restores visibility'` passed against the synthetic gateway/daemon/fake Pi route; verifies the archive list and explicit same-ID continuation. Further browser and full clean gate outcomes are recorded below when complete.
- `python3 issues/define-host-contracts/validate_contracts.py`, `python3 scripts/validate-project-view.py`, `git diff --check`: passed.
- Paired disposable-lab screenshots and static HTML: [visual acceptance](visual-acceptance.md). They do not establish visual approval, live-server behavior or distinct-UID isolation.

## Decisions for review

- The host does not know whether an independently detached tool finished after the daemon child exited. Archiving only tests its own idle/confirmed-exit state; the UI does not call Pi `abort` or treat `stop` acknowledgement as proof. Terminal history stays readable but not archivable.
- There is no archive-specific approved draft or `ArchiveDialog` contract. Confirmation uses the shared control language inline on the conversation; the archive appears on its workspace page, with a separate restore action. Jari's visual verdict remains pending after deployment.
- A lost archive response is shown as uncertain until snapshot refresh; a rejected stale request is shown as a confirmed conflict. Restore works after daemon restart even if the control handle is lost, but archive requires a live daemon handle.
- Archive uses the already authenticated, CSRF-protected workspace POST route with a distinct `conversation_archive` action. The gateway's conversation route currently admits only enumerated actions and is owned by a concurrent worker; the daemon alone resolves native ownership. This is a workspace-scoped presentation annotation, not a new history store.

## Verification limits and gate

Final committed implementation gate: pending. No real provider, multi-UID VM, test-server deployment or Jari visual verdict is claimed.
