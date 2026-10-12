---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: open
priority: normal
lane: signin-fix
lane_seq: 6
collision: [web/]
---

# Cloned workspace offers Publish to GitHub

_Source: chat_

Jari, 2026-10-12, pilot.22, workspace page of a freshly cloned repository (`issuectl`, cloned from GitHub during onboarding): the "Julkaise GitHubiin" section (owner, repo, visibility, "Tarkista GitHub ja Git") is shown although the workspace is already a Git repository with a GitHub origin. Publishing is only meaningful for a workspace without a GitHub remote; for a cloned repository the section must not appear (at most the existing remote is shown in the workspace details).

Further oddities on the same screenshot, noted by the conductor and to be checked in the same pass:
- "Keskustelut työtilassa" says "Keskusteluja ei vielä näy. Valitse työtila vasemmalta." while a workspace is already open; the empty state should say there are no conversations yet in this workspace.
- The "Arkisto" heading is shown with nothing under it.
- The settings and publish forms render as unstyled default controls, unlike the rest of the designed UI.
