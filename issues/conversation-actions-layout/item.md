---
created: 2026-10-12
updated: 2026-10-13
type: bug
reporter: jari
status: open
priority: normal
related: ['@new-conversation-view']
lane: web
lane_seq: 7
collision: [web/]
preparation: pending
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

The send button sits beside the composer field, not on a row of its own;
the current composer is too loose (agreed in the agent-turn prototype rounds,
2026-10-12).

## Chosen top bar (prototype round 2026-10-13)

Jari chose the icon row ("Ikonirivi") over an overflow menu and a details
panel: new title, archive and details are always-visible icon buttons at the
right of the top bar, after the state. The new-title icon is a serif italic "H"
(outline from Liberation Serif Bold Italic, OFL) with the two-arrow refresh
circle in its corner; while a title is generated only the arrows
turn. Details open in a popover; archive keeps its confirmation dialog and,
while Pi works, stays visible but disabled with its reason. On a phone the
state shows as its mark only and the sidebar opens as a drawer from ☰. The
frozen draft is `design-system/drafts/Agentin vuoro.proto.html`, built from
`design-system/prototypes/lib/app.*`; the round with the rejected directions
is `design-system/prototypes/rounds/2026-10-13-ylapalkki/`. The sidebar rows
and the "+" in that draft are the issue's proposal, not yet reviewed.

## Decided for production (Jari 2026-10-13)

- Send is an icon button (an up arrow), not a text button.
- Disabled actions stay visible with their reason in production too: archive
  while Pi works, and new title in a new conversation with nothing to name
  yet. The new-title button is disabled there, not hidden.
- The keyboard hint row under the field ("Enter lähettää · Shift+Enter
  rivinvaihto") goes away; it takes too much space.
- Stop stops at once, without a confirmation dialog: telling the agent
  "jatka" resumes the work.
- The composer is the "Työkalurivi" direction of
  `design-system/prototypes/rounds/2026-10-13-alakerta/`: a row in the
  composer with stop at the left and, at the right, a pill choosing
  "Ohjaa" / "Työn jälkeen" while Pi works, then the send icon. How that row
  separates from the writing area is the riff
  `design-system/prototypes/rounds/2026-10-13-tyokalurivi/`.

## Design and verification

Use [the current design](../../design-system/design.md) and its referenced
screens; @review-browser-design-v2 supplies the design assessment. Verify the
empty and populated views and their actions in the lab on desktop and phone,
including long titles, keyboard focus and touch access.

@new-conversation-view owns false errors and state propagation;
@conversation-title-language owns the generated title's language.
