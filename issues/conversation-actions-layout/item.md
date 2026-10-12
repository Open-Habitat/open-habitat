---
created: 2026-10-12
updated: 2026-10-12
type: bug
reporter: jari
status: open
priority: normal
related: ['@new-conversation-view']
lane: web
lane_seq: 2
collision: [web/]
---

# Unify conversation actions and sidebar layout

Make conversation actions easy to find and sidebar conversations easy to scan,
using the shared design on desktop and phone.

## Evidence and intended behavior

Jari observed these problems on 2026-10-12 in pilot.22, in a new Pi conversation
in the freshly cloned `issuectl` workspace (14.24–14.37 local).
“Arkistoi” was a full-width bordered strip above the composer, easy to mistake
for something else. “Luo uusi otsikko” was styled as a link and appeared even
in an empty conversation.

The conversation top bar brings together the title and real buttons for title
regeneration, archiving and “Tiedot”. Title regeneration is absent in an empty
conversation because there is no content to name. Use the shared design's icon
buttons, accessible names and tooltips. Existing archive eligibility and
confirmation behavior still apply; this changes where the action lives.

After a couple of messages, the sidebar conversation occupied two lines, with
“○ Tila ei tiedossa” below the title and white backgrounds offset from each
other and the workspace row above. Each conversation should occupy one aligned
row: an ellipsized title and a compact state indicator at the right, with a
coherent background aligned with the workspace rows.

Each workspace row gets a “+” button after the repository name that starts a
new conversation in that workspace. It has an accessible label, appears on
hover or focus on desktop, and stays visible on touch devices.

## Design and verification

Use [the current design](../../design-system/design.md) and its referenced
screens; @review-browser-design-v2 supplies the design assessment. Verify the
empty and populated views and their actions in the lab on desktop and phone,
including long titles, keyboard focus and touch access.

Split from @new-conversation-view by agreement with Jari on 2026-10-12.
That issue owns false errors and state propagation; @conversation-title-language
owns the generated title's language. This issue presents the supplied state
without redefining its meaning.
