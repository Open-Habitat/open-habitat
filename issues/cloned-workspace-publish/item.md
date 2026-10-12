---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: open
priority: normal
lane: web
lane_seq: 8
collision: [web/]
---

# Cloned workspace offers Publish to GitHub

On pilot.22 on 2026-10-12, Jari opened the `issuectl` workspace after cloning
it from GitHub during onboarding. The page offered "Julkaise GitHubiin",
including owner, repository, visibility and "Tarkista GitHub ja Git", even
though the checkout already had a GitHub origin.

The workspace page should offer actions appropriate to the repository's
observed state. An existing GitHub remote makes a new-repository publishing
form misleading, so that form is absent for this cloned workspace. Existing
remote information, if shown, belongs in workspace details. A workspace
without a GitHub remote remains a candidate for the existing publication
flow, whose eligibility and confirmation rules are described in the
[workspace architecture](../../docs/architecture/workspaces.md).

The same screenshot raised three related presentation concerns to verify
and address in this view:

- The empty conversation list asks the person to select a workspace even
  though one is open. Its message should say that this workspace has no
  conversations yet.
- "Arkisto" appears as a heading with nothing beneath it. A confirmed empty
  archive should not leave an unexplained heading; an unreadable archive
  still needs an understandable error state.
- Settings and publication forms appear to use unstyled default controls.
  They should use the product's shared controls and visual language.

A useful comparison is the freshly cloned GitHub workspace against a local
workspace eligible for publication: the former has no publication form and
the latter retains it. Desktop and phone views with empty conversation and
archive lists should also read coherently and match the surrounding UI.
