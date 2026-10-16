---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# New-conversation model controls: broken pill, slow loading, wrong labels

Jari on the test server, 2026-10-16, about the model choice from `implement-model-choice` in a new, empty conversation (screenshots in this directory):
- The composer's model pill ("Uuden keskustelun malli") is broken: too big, not shaped like a pill, and it does not work properly.
- The top bar says "Pi:n oletus" (`ylapalkki-oletus.png`). It should just say which model it is.
- Clicking the top-bar chip shows "Ladataan Pi:n malleja" for a very long time before the menu opens. In an empty conversation, the top bar should not offer a choice at all, because the composer pill below is the place to choose.
- In that dialog, "Aloita keskustelu" navigates to a conversation that "does not exist" ("keskustelua ei ole olemassa").
- The composer pill has the same long "loading models" wait. Model info should be available immediately when the control is clicked: load it ahead of time, keep it in browser memory and refresh it in the background. Pi stays the source of truth, and nothing is stored on the host.
- In an empty conversation with defaults, the action still reads "Aloita uusi keskustelu". It should say something like "Valitse", because no new conversation is needed in an empty one: the choice applies to this conversation's first message.
- The top bar first shows the full identifier (`openai-codex/gpt-6.1-sol`, `ylapalkki-pitka.png`) and only after the first reply switches to the normal short form (`ylapalkki-lyhyt.png`). It should show the short form from the start.

## Acceptance Criteria
- [ ] The composer pill is a proper pill per the prototype (`rounds/2026-10-16-mallit`, direction 1) and works, on desktop and phone.
- [ ] An empty conversation: the top bar shows the short model name, offers no choice, and the composer pill opens instantly with no "Ladataan" wait. Choosing a model applies to this conversation ("Valitse"), with no navigation to a nonexistent conversation.
- [ ] The short model label is consistent from the start.
- [ ] Browser tests for each point.
