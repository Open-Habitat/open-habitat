---
created: 2026-10-12
updated: 2026-10-12
type: bug
reporter: jari
status: fixed
priority: normal
related: ['@generate-conversation-titles', '@new-conversation-view']
lane: web
lane_seq: 2
collision: [internal/daemon/]
preparation: ready
closed: 2026-10-12
closed_by: claude
---

# Generate titles in the conversation language

Generated conversation titles should follow the conversation's language,
as agreed in @generate-conversation-titles.

Jari observed a regression on 2026-10-12 at 14.37 local in pilot.22: after a
couple of messages in Finnish, a new Pi conversation in the freshly cloned
`issuectl` workspace was titled “Checking the Connection”.

Find why this flow produced an English title and correct it while preserving
the native naming, generation timing and failure behavior described in
@generate-conversation-titles. Verify the language choice through a running
Finnish conversation and check that other conversation languages are still
respected; a Finnish UI alone does not determine the title language.
