---
created: 2026-11-03
updated: 2026-11-03
type: bug
status: open
priority: normal
provenance: other
provenance_detail: prototype round observation
source_ref: taskfleet:01m6fxf7v7923z7pmg1q2v8bmy/observation:start-page-bare-command
originating_run: 01m6fxf7v7923z7pmg1q2v8bmy
originating_run_kind: spinoff
lane: start-page-button
lane_seq: 0
preparation: ready
---

# Workspace page's Luo aloitussivu inserts a command Pi does not expand

## Description

## Observed

The workspace page's *Luo aloitussivu* / *Päivitä aloitussivu* button
(`web/src/app/WorkspaceLanding.tsx`, `prepareInvocation(..., "/open-habitat-start-page ")`)
puts `/open-habitat-start-page ` in the new conversation's field. Pi expands
only `/skill:<name>` into a skill call (`_expandSkillCommand` in the installed
`@earendil-works/pi-coding-agent`). The daemon installs `open-habitat-start-page`
only as a skill (`internal/daemon/start_page_linux.go`), with no prompt template
or extension command of that name. So the sent text is an ordinary user
message: the model never receives the skill as a call and has to infer that it
should read the skill itself. The history shows a plain bubble
`/open-habitat-start-page`, and the conversation is named
"/open-habitat-start-page".

Seen in the synthetic lab on 2026-11-03 (screens in
`issues/proto-start-page-request-presentation/evidence/nyt-*.avif`). The fake
Pi echoes the text. The expansion rule is from Pi's source, not a live run.

## Expected

The button sends or prepares `/skill:open-habitat-start-page `, so Pi records a
skill call and the composer can show it as a chip. How it should look is being
decided in the prototype round `proto-start-page-request-presentation`. This
defect stands on its own: the invocation string is wrong whichever direction
is chosen.
