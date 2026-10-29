---
created: 2026-10-22
updated: 2026-10-29
type: task
reporter: jari
status: done
priority: normal
lane: proto-editor
lane_seq: 1
preparation: pending
closed: 2026-10-29
---

# Prototype: editor choice in Settings and a cleaner CodeMirror file browser

## Description

Jari 2026-10-22: the Settings › Editori selector (screenshot /var/tmp/oh-shots/editor-choice.png on Alder: a bare fieldset with radio buttons and long text) is ugly and not in line with the other selectors in Settings; and CodeMirror needs a cleaner file browser on the left. Prototype round (design-system/prototypes/rounds/, same method as earlier proto-* rounds: 2–3 directions in production context, desktop and phone, light/dark, synthetic data, published for review): the editor choice consistent with existing Settings selectors (two options now: CodeMirror 6 and VS Code; Monaco is being dropped), and the CodeMirror file browser (tree, open file, dirty state, search/filter if warranted). Jari picks; implementation is a later issue.

## Prototype result

[Round 2 comparison, editor research and verification](result.md). Three tree presentations without the rejected coloured selection edge await Jari's choice; the round-1 Settings segmented control is retained. Round 1 remains below the new result. Production implementation is later work.

## Decisions

### 2026-10-22T06:11:27Z · @jari

Jari 2026-10-22 on round 1: Puu (tree) is good, but research first how file trees are presented in VS Code and other open-source editors (e.g. Zed, Theia, Gitpod/OpenVSCode, JetBrains Fleet, Sublime, Lapce); the coloured left-edge highlight does not work at all. Riff the tree after collecting ideas. The settings segmented control is not contested.

### 2026-10-22T12:20:56Z · @jari

Jari 2026-10-22 on round 2: take Viivasto's look plus Tiivistetty's compact folder chains. The folder disclosure must be the same chevron (>) style used elsewhere in the UI, not a triangle, and clearly larger than in the prototype.
