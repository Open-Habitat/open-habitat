---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: limit-card
lane_seq: 1
---

# Limit card opens below the composer and needs scrolling; say the limit counts working conversations

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Rajakortti avautuu kirjoituskentän alapuolelle (Jari 7.11., pilot.612, työpöytä): kun uusi keskustelu hylättiin rajan takia (daemon `POST /api/v1/conversations` 429 klo 07:34:34Z), rajakortti tuli oikein, mutta kentän alle, ja Jarin piti vierittää se näkyviin. Kortin pitää näkyä ilman vieritystä, esim. kentän yllä tai dialogina (`live-conversation-limit-admin`).

Yhtäaikaisten keskustelujen raja 1 ei näyttänyt estävän mitään (Jari 7.11., pilot.612): Jari asetti oman rajansa ja sitten oletusrajan 1:ksi ja aloitti kolme uutta keskustelua (07:20:41Z open-habitat, 07:21:25Z ja 07:22:46Z issuectl), jotka kaikki vastasivat. Raja oli voimassa (`/opt/open-habitat/live-limits.json` = `{"default":1,"people":{"21032":1}}`, kirjoitettu 07:22Z), mutta se laskee vain *työskentelevät* keskustelut (`internal/daemon/pi_activity_linux.go`): vuoro käynnissä, kysymys, taustaprosessi tai epävarma tila. Jarin keskustelut vastasivat nopeasti peräkkäin, eikä kaksi ollut työssä yhtä aikaa, joten raja ei tullut vastaan (agentti oli väittänyt, että tämä keskustelu pitää paikan, vaikka se lepäsi). Jari odotti rajan koskevan avoimia keskusteluja. Tarkista, sanovatko ylläpidon Keskustelut-sivu ja rajakortti selvästi, että raja koskee samaan aikaan työskenteleviä (`live-conversation-limit-admin`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa
