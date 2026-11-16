---
created: 2026-11-16
updated: 2026-11-16
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m7hkw6a8hfyrr0s5mjrt6hgv/archive-uncertain-error-hidden
originating_run: 01m7hkw6a8hfyrr0s5mjrt6hgv
originating_run_kind: spinoff
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-16
---

# Archive refusal hidden when the reply beats the view change

## Description

## Problem

Archiving a conversation from its own view navigates optimistically to the
workspace and shows an undo offer. When the host then refuses the archive
(409, e.g. `control_uncertain` after a changed native revision), the person
should see "archive change failed" in the view they are now in. Under load the
error never appears: the clean gate on 524acd6c failed in
`web/tests/native-history.spec.ts` "unwritten terminal session can archive and
restore" at `archive-proof.ts:88` (`archive-error` never visible). The spec
passes alone.

## Suspected cause

`performArchive` scopes the refusal to `currentViewRoute.current`, which is
only updated when App renders. The router commits navigations as transitions,
so under load the reply can arrive before App has rendered the workspace
route. The refusal is then scoped to the conversation route just left, hidden
at the workspace, and cleared by the location effect when the navigation
commits.

## Done when

The refusal is visible in the view where archiving left the person even if the
reply arrives before that navigation renders, still does not follow into other
views, and a deterministic browser spec covers the branch.
