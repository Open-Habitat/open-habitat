---
created: 2026-09-29
updated: 2026-09-30
type: task
status: done
priority: normal
labels: [human-review]
closed: 2026-09-30
---

# Decide account display name and single conversation route

Two browser/host contract questions surfaced by the overnight synthetic UX audits (`issues/decidedly-loud-station/audit.md`, `issues/relatively-robust-flower/audit.md`). Both change the contract, so they are Jari's decision.

## 1. Show which account is signed in

Today every person sees "Oma tili" in the rail and settings: `accountLabel()` collapses the provider identity to a generic label, and the snapshot carries no person-facing name. After a logout and a different sign-in in the same tab, nothing on screen shows whose work is being read. No data leaked in the tests; the problem is that the page gives the person no way to check it.

**Recommendation:** the gateway already learns the verified GitHub login during OAuth. Add it to the snapshot's `auth` block as a display-only field, and show it in the rail and settings. The UI never uses it for authority, and the Unix username and UID stay hidden.

## 2. One route for a conversation

A writable browser chat lives at `/workspaces/:id?conversation=pi:…`, and the same conversation's native history lives at `/agents/:id`. They look the same but have different addresses, so deep links and back-navigation differ.

**Recommendation:** converge on the native-ID route `/agents/pi:<id>`, with the write controls shown when this daemon incarnation holds the controller for that session. Do this once the host semantics of "controllable here" are settled, rather than as a browser-only redirect.

## Decision

(Jari)

## Decisions

### 2026-09-30T08:09:10Z · @jari

Account display decision (Jari): show the person’s first name in the default/compact view; when the account view is opened, show the signed-in email address. Do not derive a first name by blindly splitting an email address. Determine a trustworthy source for the first name and which authenticated email to display before changing the browser/host contract; keep both display-only, never authority for Unix identity. The separate single-conversation-route question was not decided by this comment.

## Resolution

### 2026-09-30T08:34:19Z · @issuectl

Jari chose first name in the compact/default view and the signed-in email address in the opened account view; recorded above under Decisions. The design agent has been briefed separately. Closing this decision/handoff issue does not claim the UI or contract is implemented. The separate conversation-route suggestion remains undecided and can be revisited with the design results and host control semantics.
