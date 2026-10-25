---
created: 2026-10-25
updated: 2026-10-25
type: improvement
status: done
priority: normal
preparation: ready
provenance: chat
lane: unlaned
collision: [web/src/components/RecapCard]
closed: 2026-10-25
---

# Recap card: drop the 'luotu automaattisesti' and 'uusia viestejä' labels; refresh outdated automatic recaps

## Description

Jari 2026-10-25 on Birch (screenshot /var/tmp/oh-shots/recap-2026-10-25.png on Alder): the conversation recap card ("Tilannekatsaus") shows extra labels. "luotu automaattisesti" is unnecessary: how the recap was made need not be said. "uusia viestejä" should not be needed either: if new messages arrived after the recap, a stale recap should not be shown as such, and if the agent wrote new messages, the automatic recap should not have been left stale.

## Goal

Remove the "luotu automaattisesti" label. Replace the stale badge with behaviour: when messages arrive after an automatic recap, regenerate it automatically once the conversation is idle again (the same trigger that produced it), and meanwhile do not present the outdated summary as current (e.g. hide it or show it only while the refresh is in progress). A manual recap the person asked for may keep a quiet refresh affordance. Keep "ajantasaisuus ei tiedossa" only if it still has a real case; otherwise remove it too.

## Acceptance Criteria

- [ ] No "luotu automaattisesti" and no "uusia viestejä" label.
- [ ] An automatic recap that became outdated is regenerated after the conversation goes idle; unit and host-backed tests cover it.
