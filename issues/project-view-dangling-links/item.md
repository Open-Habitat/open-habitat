---
created: 2026-11-13
updated: 2026-11-13
type: chore
status: open
priority: normal
provenance: other
provenance_detail: observed while validating an unrelated change
source_ref: taskfleet:01m7aecd6z08hz6vj3bmg4yvep/observed:project-view-dangling-links
originating_run: 01m7aecd6z08hz6vj3bmg4yvep
originating_run_kind: spinoff
lane: gate-repair
lane_seq: 1
preparation: ready
---

# Project-view validation fails on main with 16 dangling Markdown links

## Description

`python3 scripts/validate-project-view.py` fails on `main` (checked at 5ece8413) with 16 missing local link targets, so the check no longer tells a contributor whether their own change broke a link. Most targets are files of issue directories that have since been removed (the prune of closed issues removes directories that other open issues still link to by Markdown path); one is a design draft and one an issue attachment.

Errors:

```
design-system/design.md: missing local link target: drafts/Etusivu.proto.html
issues/expose-native-status/item.md: missing local link target: ../native-agent-host-architecture/ui-design-later.md
issues/expose-native-status/item.md: missing local link target: ../native-agent-host-architecture/ui-design-package.md
issues/expose-native-status/item.md: missing local link target: ../native-agent-host-architecture/ui-design-conversation.md
issues/extend-editor-tools/item.md: missing local link target: ../native-agent-host-architecture/ui-design-later.md
issues/extend-editor-tools/item.md: missing local link target: ../native-agent-host-architecture/ui-design-conversation.md
issues/extend-editor-tools/item.md: missing local link target: ../native-agent-host-architecture/ui-design-package.md
issues/extend-tool-views/item.md: missing local link target: ../native-agent-host-architecture/ui-design-later.md
issues/extend-tool-views/item.md: missing local link target: ../native-agent-host-architecture/ui-design-package.md
issues/extend-tool-views/item.md: missing local link target: ../native-agent-host-architecture/ui-design-conversation.md
issues/gitea-readonly-acceptance/item.md: missing local link target: ../fleetrepo-gitea-habitat/implementation-plan.md
issues/gitea-readonly-acceptance/item.md: missing local link target: ../fleetrepo-gitea-habitat/native-auth-evidence.md
issues/gitea-readonly-acceptance/item.md: missing local link target: ../fleetrepo-gitea-habitat/prototypes/connect/NOTES.md
issues/gitea-readonly-acceptance/item.md: missing local link target: ../fleetrepo-gitea-habitat/prototypes/connect-riff/NOTES.md
issues/gitea-readonly-acceptance/item.md: missing local link target: ../fleetrepo-gitea-habitat/prototypes/workspace-import/NOTES.md
issues/live-gap-banner-returns/item.md: missing local link target: attachments/banner.png
```

Expected: the validator passes on `main`. Each link either points at a file that exists or becomes a plain repository path / history reference, as the root AGENTS.md asks for removed files, and the prune script does not remove a directory that a living document still links to.
