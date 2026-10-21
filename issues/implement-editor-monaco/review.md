# Focused final-diff review and assessment

Finder `claude-fable-5-1` (thread `56fd5e74-2513-491b-8bda-ee7626f1f96d`),
independent verifier `gpt-6-astra` (thread
`01a1601f-eb15-7580-9f72-f189524dbb5f`), two complete calls. Critical focus:
keyboard/input reliability and dirty-buffer/concurrency transitions. Scope is
phase-2 browser adapter/shell and dependency/asset integration, not a new host
security review. No daemon or gateway changed. Performance logging disabled to
honor the no-push instruction.

The finder inspected an attached earlier adapter snapshot while browser
integration was progressing. Each claim was checked against local/upstream
code and current test evidence; stale claims were not reported as current bugs.

| Finding | Evidence, assessment and disposition |
| --- | --- |
| MON-01: hidden IME input is not the editor focus target | Confirmed by the initial Chromium failure: Monaco's experimental EditContext mode creates a readonly, aria-hidden IME textarea. Pin `editContext:false` to use the established accessible textarea. Already fixed before finder returned. Verifier confirmed the original mechanism and current correction. Final Chromium cases type, save and return focus through Ctrl+Alt+K. |
| MON-02: minimal core lacks normal word/line/indent controls | Confirmed by Monaco's explicit contribution registrations. Added only word operations, line operations, commenting, indentation and bracket matching. Per-editor physical Ctrl+M toggles `tabFocusMode`, with Finnish help; upstream's global toggle would not override an explicit true option (effective setting ORs them). Tab leaves by default, never a permanent keyboard trap. Verifier found the fix adequate by source; host browser regression exercises word deletion, indent, Tab escape/toggle and saved bytes. |
| MON-03: Ctrl+S from find misses edit-context listener | Confirmed: find has its own textbox, not `editor.onKeyDown`'s edit context. Capture physical `KeyS` on the adapter container, suppress browser Save Page and call the existing save controller; remove the listener on unmount. Verifier confirmed the fix by source. A new browser case saves while the find textbox is focused. |
| MON-04: cross-tab preference prompts over typing | Confirmed narrowly as an unsolicited discard-dialog risk, not an unambiguous ADR breach: accepting the old confirmation did count as explicit discard, and phase 1 already allowed keeping the engine after declining. Background storage observations now use retention-only, without a prompt. Dirty/saving state keeps its engine; after save and close, a direct FileRef opening adopts any latest effective choice (previously special-cased only VS Code). Verifier confirmed this precise behavior; cross-tab regression requires zero dialogs and preserved native text. |

Assessment: MON-01/MON-03 occasional, MON-02 regular, MON-04 occasional;
readability improves throughout, architectural reach none/minor. FIX for all
four in this run, with MON-04's broader specification claim explicitly rejected.
No speculative residual or new issue filed. Local rendered assessment is
`history/assessment-editor-monaco.{json,md}`; this durable disposition stands
without those scratch files.

The verifier saw an intermediate 17-pass/1-fail receipt. Its one remaining
verification limitation was a test locator looking for an `input` where Monaco
renders the find field as a textarea. That locator was already corrected to
roles within the Monaco container, without asserting English UI wording, and
the final post-review run recorded in `result.md` supplies execution evidence.
Neither model claimed that incomplete receipt passed. Reopening is verified to
render a fresh editor; worker disposal is separately checked by native worker
records, with upstream source proving manager reset on last-model disposal.

Additional local integration corrections: production CSS may shorten token hex
values to three digits, which Monaco rejects; expand them without duplicating
design colors. Save tests await clean document state, not merely a disabled Save
button (which also occurs during a request). Shared controller regressions cover
unsupported reads and refused read-only saves preserving the current buffer.
No changes to host file authority, CSP or native-writer guarantees were needed.

Scratch originals: `/var/tmp/monaco-review-{finder,verifier}.txt` and
`history/review-editor-monaco.md`. Coverage includes selected lazy grammar
registration, worker construction/native teardown, token themes, identity-local
preference/disposal, focused input and shared save/conflict routes. Not claimed:
live-user assistive-technology trials, full VS Code parity, a new UID-isolation
proof or the conductor's full gate.
