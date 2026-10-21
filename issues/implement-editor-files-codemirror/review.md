# Final-diff review and assessment

Independent critical review: finder `claude-fable-5-1`, verifier
`gpt-6-astra`, two complete model calls. Both read the daemon/gateway/browser
boundary and ADR 0028. The host checked every candidate against local code;
model agreement was not treated as confirmation. Performance-corpus logging was
disabled to respect this run's no-push instruction.

| Finding | Evidence and disposition |
| --- | --- |
| EF-01: transient stale phase discarded dirty buffers | App withheld the CSRF prop on failed refresh; the editor's binding key changed and unmounted the document. Preserve the same bound CSRF while stale, but retain real identity **and CSRF** key resets. Browser regression preserves dirty text through a failed snapshot refresh. Fixed. |
| EF-02: repeated compact resize prompts | A cancelled VS Code→phone transition prompted on each resize. Remember refusal until returning above 800px. Browser regression dismisses once, resizes compact twice, and crosses back to verify the next decision. Fixed. |
| EF-03: metadata save restrictions incorrectly blocked reads | The common reader refused xattrs, hard links and read-only mode on GET. Metadata policy is now save-only; GET remains confined/owned/UTF-8/bounded, while PUT and stat editability enforce metadata restrictions. Tests distinguish GET success, PUT refusal and stat reason. Fixed. |
| EF-04: locally invalid text permanently blocked Save | Every failed save demanded a remote base, including a local pre-request validation refusal. Block only uncertain outcomes and `file_changed`; correcting ordinary invalid/refused input remains possible. Controller regression corrects and saves without comparison. Fixed. |
| EF-05: deletion preview omitted live file leases | Preview and actual deletion disagreed about active operations. Both now check descriptor overlap under the fence mutex; the lease test checks preview too. A vanished workspace was already revalidated by its caller; worktree removal now revalidates before returning a fence-failure blocker as well. Fixed. |

All five primary candidates were confirmed: likelihood occasional (EF-01,
EF-02, EF-04, EF-05), regular (EF-03); readability improves, architectural
reach minor, confidence high. Assessment outcome is FIX for each, implemented
in this run. No residual issue was filed. The identity-only React key suggested
by the finder was rejected because it would weaken genuine CSRF-binding resets.

The verifier found each primary fix adequate by source inspection and explicitly
did not claim test execution. The host ran the regressions recorded in
`result.md`. Additional local checks caught and fixed openat2's rejection of
`O_NONBLOCK|O_PATH` (ordinary sidebar entries were unsupported), a global mobile
navigation control covering the editor header, directory reads clearing save
conflict messages, and cleanup of a temporary name after rename had ended the
request's ownership of that name. Distinguishing tests or synthetic visual
captures cover these changes.

No global compare-and-swap guarantee against native uncooperative writers,
SELinux execution or live-server use is claimed. Native writer check/rename
races remain the ADR's explicit limitation. The review/assessment scratch
artifacts are `history/review-editor-files-codemirror.md` and
`history/assessment-editor-files-codemirror.{json,md}`; this disposition stands
without them.

## Late binding review

After the original review, local source/test checks added dirty-resource pinning
and corrected observed worktree history to select its place. A second bounded
Fable review (`b1a11c93-cd4f-4dbc-9c0e-87081f117606`) assessed that delta; Astra
independently verified its surviving finding and final fix
(`01a1600a-6651-7971-a972-0912b3ba64f5`).

| Candidate | Assessment and disposition |
| --- | --- |
| EF-06: background binding effect prompts, and accepted cross-workspace navigation prompts twice | Confirmed by source: the effect reused interactive `leave()`, already called by the router blocker. Occasional likelihood; real interruption/accidental-discard risk; minor architectural reach; clearer intent after separating observation from permission. FIX: a non-interactive retention probe keeps dirty/saving resources; router permission covers only the matching commit's layout, expires after that commit, and is revoked by edits. The real-router unit verifies decline/accept/layout/expiry; the host-backed disappearance test requires zero dialogs and preserved dirty text. |

The host rejected `retains()` alone as incomplete: it would retain the old
resource even after accepted navigation. It also closed stale permission after
same-workspace navigation. Astra found the scoped production fix adequate and
ran both focused controller tests successfully. Its first run exposed a bad
new test assertion (baseline content is not the live editor buffer), corrected
to assert dirty state. Its final limit was explicit: the unit uses a
representative parent layout, not full WorkspaceEditor integration. Pending
opens, actual identity/CSRF disposal and observed-place selection were checked
and not found defective. No residual recommendation was filed. Late scratch
outputs live at `/var/tmp/editor-late-*.txt`; this disposition is the durable
assessment.
