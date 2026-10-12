---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: open
priority: normal
lane: web
lane_seq: 1
collision: [web/]
related: ['@conversation-actions-layout', '@conversation-title-language']
preparation: ready
---

# Show honest state when starting and continuing a conversation

A new conversation should open as a calm, usable place to write. Starting up
or having no messages is not a failure, and the conversation and sidebar
should describe the same observed state.

## Evidence

Jari observed this on 2026-10-12, pilot.22, in a new Pi conversation in the
freshly cloned `issuectl` workspace (14.24 and 14.28 local). The conversation
worked: the daemon and Pi were running and the session file was being written.
Yet the empty view immediately showed a “Tilannekatsaus” box with “Pyydä lyhyt
katsaus ennen kuin jatkat”, disabled “Luo katsaus”, “Yhteys tai ohjaus ei ole
käytettävissä” and red “Katsausta ei voitu tarkistaa. Lataa sivu uudelleen.”
The title had a “? Tila ei tiedossa” pill. The sidebar showed
“Uusi keskustelu × Historia ei luettavissa”, with the history warning floating
beside the row.

At 14.37, after a couple of messages, the sidebar still showed
“○ Tila ei tiedossa” although the conversation view knew the turn had completed.

## Intended behavior

An empty conversation has no situation-summary box because there is no prior
content to summarize. Normal connection and control startup should not produce
failure messages. A new conversation shows its known state, or leaves the
state indicator out while that information is arriving. Empty history appears
normally; a genuine history-read failure has a clear place of its own.

Find why a settled turn leaves the sidebar without state when the conversation
view has it. Both views should use the available evidence consistently.
Follow [the design's state meanings](../../design-system/design.md): an open
agent awaiting input is “Odottaa”; a completed turn alone does not establish
that the agent is closed and “Valmis”. Genuine uncertainty remains
distinguishable from a known state.

## Verification and scope

Verify empty history, connection/control startup, settled turns and genuine
history failure in the lab on desktop and phone. Exercise state propagation
through a running conversation as well as visual examples: a fixture alone
cannot show that the sidebar receives the same facts as the conversation.

Top-bar actions, title-action visibility, sidebar alignment and the workspace
“+” button belong to @conversation-actions-layout. The title language regression
belongs to @conversation-title-language.
