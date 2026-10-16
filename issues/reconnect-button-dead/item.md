---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: fixed
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
closed: 2026-10-16
---

# Yhdistä does nothing after a restart; uncertain creation stays blocked; header shows + + -

Jari on the test server, 2026-10-16 at 10:22 UTC. The guest's Pi runtime was switched by Fleetrepo (`a58281bb`, "verified processes runtime cutover", 10:21), which restarted the services while he was creating a conversation. He saw:
1. `luonti-epavarma.png`: "Keskustelun luonnin tulos epävarma … Älä luo uudelleen tässä istunnossa" and "Päivitä yhteys ennen uuden keskustelun luontia". The workspace header also shows two `+` buttons and a `-`, which looks like a broken header.
2. `yhteys-katkesi.png`: the top banner "Yhteys katkesi · tiedot voivat olla vanhoja … Yhdistä". **The "Yhdistä" button does nothing.**

Expected: after the server is back (it was healthy by 10:23), "Yhdistä" reconnects the event stream and refreshes the snapshot, the banner disappears, and creating a conversation is possible again. If the uncertain creation actually created a conversation, it shows up; if not, the person can retry, with the "Älä luo uudelleen" guard released once the state has been rechecked. The workspace header shows its intended controls (one `+`, the `…` menu, the Git pill) also in the uncertain state.

## Acceptance Criteria
- [x] "Yhdistä" reconnects and clears the banner after a real daemon or gateway restart; browser test with a host restart.
- [x] After an uncertain creation, a recheck resolves it: the conversation appears, or retry is allowed. Test.
- [x] The workspace header renders correctly in this state; lab screenshot.
- [x] Opening the home page first reconciles old creation guards for every workspace; home-row, sidebar and workspace-page + controls recover without repeating a creation.

## Comments

### 2026-10-16T10:33:24Z · @jari

Jari 13.28–13.32 local: the issuectl workspace page shows two + buttons, both disabled (issuectl-kaksi-plussaa.png). After archiving a conversation he landed on the open-habitat workspace page with 'Keskustelun luonnin tulos epävarma', both + disabled and a '-' (arkistoinnin-jalkeen-jumissa.png). He cannot create any new conversation: the uncertain-creation guard is stuck across pages and reloads, long after the server recovered. Releasing it after a recheck is the priority.

### 2026-10-16T10:50:22Z · @jari

Jari 13.49 local, after the fix was live (f04d0bd0, verified 10:45 UTC): on the home page (/workspaces), the + buttons of issuectl and open-habitat are still disabled, while taskfleet's + works (etusivu-plussat-harmaana.png). The stuck guards are not released on the home page rows.

## Reopen Notes — 2026-10-16

The explicit-refresh fix left persisted guards untouched on ordinary page loads. The home page therefore stayed blocked until the person found a separate refresh action.
