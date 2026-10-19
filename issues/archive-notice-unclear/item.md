---
created: 2026-10-19
updated: 2026-10-19
type: bug
reporter: jari
status: fixed
priority: normal
lane: archive-notice
lane_seq: 1
collision: [web/src/app/]
preparation: ready
closed: 2026-10-19
---

# Archive notice is vague and fires for conversations of trashed workspaces

Jari on the test server (pilot.231), 2026-10-19, workspace page of `issuectl` (single-workspace mode): a notice "Arkistoa ei voitu kokonaan tarkistaa — Osa Pi:n historiasta tai arkistomerkinnöistä on poissa käytöstä. Tyhjä lista ei vahvista tyhjää arkistoa." Jari: "Varoitus oli todella epäselvä."

Cause found by `single-mode-notice-and-url` (its result.md): two archived conversations' workspace directories are in the freedesktop Trash (`~/.local/share/Trash/files/…`), so their native histories have no live workspace; the warning fires for that and stays as long as such workspaces are in the trash. Nothing is actually unavailable or broken.

Expected: no vague warning for an ordinary, known situation. Conversations whose workspace is in the trash belong to the trashed workspace (they come back when it is restored, and go when the trash is emptied), so they are not a gap in this workspace's archive and should not raise a notice on another workspace's page. Keep a warning only for a real unreadable state (unreadable history file, malformed annotation, I/O error), and then say concretely what could not be read and what it means for the person, in plain Finnish (e.g. "2 keskustelun historiaa ei voitu lukea: …"), never "tyhjä lista ei vahvista tyhjää arkistoa".


## Acceptance Criteria

- [x] Archived native histories of a trashed workspace do not make another workspace's archive incomplete; restoring the workspace brings its archived conversation back.
- [x] Missing or unreadable archived history still warns, with source-specific Finnish wording for history versus archive annotations.
- [x] Focused Go, web, browser/a11y, generated-contract checks and synthetic lab screenshot/HTML evidence recorded in result.md.
