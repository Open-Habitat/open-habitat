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

# Yhdistä does nothing after a restart; uncertain creation stays blocked; header shows + + -

Jari on the test server, 2026-10-16 at 10:22 UTC. The guest's Pi runtime was switched by Fleetrepo (`a58281bb`, "verified processes runtime cutover", 10:21), which restarted the services while he was creating a conversation. He saw:
1. `luonti-epavarma.png`: "Keskustelun luonnin tulos epävarma … Älä luo uudelleen tässä istunnossa" and "Päivitä yhteys ennen uuden keskustelun luontia". The workspace header also shows two `+` buttons and a `-`, which looks like a broken header.
2. `yhteys-katkesi.png`: the top banner "Yhteys katkesi · tiedot voivat olla vanhoja … Yhdistä". **The "Yhdistä" button does nothing.**

Expected: after the server is back (it was healthy by 10:23), "Yhdistä" reconnects the event stream and refreshes the snapshot, the banner disappears, and creating a conversation is possible again. If the uncertain creation actually created a conversation, it shows up; if not, the person can retry, with the "Älä luo uudelleen" guard released once the state has been rechecked. The workspace header shows its intended controls (one `+`, the `…` menu, the Git pill) also in the uncertain state.

## Acceptance Criteria
- [ ] "Yhdistä" reconnects and clears the banner after a real daemon or gateway restart; browser test with a host restart.
- [ ] After an uncertain creation, a recheck resolves it: the conversation appears, or retry is allowed. Test.
- [ ] The workspace header renders correctly in this state; lab screenshot.
