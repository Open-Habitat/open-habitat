---
created: 2026-11-05
updated: 2026-11-05
type: improvement
reporter: jari
status: done
priority: high
preparation: ready
provenance: chat
source_ref: chat:2026-11-05/live-conversation-limit
lane: live-limit
lane_seq: 1
closed: 2026-11-05
---

# Lift the four-working-conversations limit to one that only protects the host

## Description

Jari 5.11.2026: neljän samanaikaisesti työskentelevän keskustelun raja
poistetaan tai sitä höllennetään merkittävästi; 10 voi olla vielä liian
vähän. Ville (Northwind) törmäsi rajaan (*Four conversations are already
working*, `POST /api/v1/conversations` 429) ja on omalla koneellaan
ajanut 8–10 keskustelua yhtä aikaa.

Raja on vakio `maxLiveConversations = 4`
(`internal/daemon/pi_activity_linux.go`), eikä koodi kerro sille syytä.
Northwindin VM:ssä on 30 GiB muistia ja 16 ydintä; yksi Pi-lapsi vie noin
210 MiB. Rajaan lasketaan myös keskustelu, jonka taustaprosessi on yhä
käynnissä ("processes"), joten pitkä taustatyö pitää paikkaa koko ajan.

Tee: korvaa matala luku rajalla, joka suojaa vain isäntää. Joko riittävän
korkea turvaraja (suuruusluokka 30+) tai ehto, joka perustuu siihen, mikä
oikeasti loppuu (muisti/henkilön slice), sen mukaan kumpi on yksinkertaisempi
ja todennettavissa. Pidä sama "kiireisen keskustelun" määritelmä ja
joutilaan lapsen paikanluovutus. Kieltäytymisteksti ei saa enää sanoa
"Four"; jos teksti muuttuu, käytä olemassa olevaa tyyliä. Asetuskäyttöliittymä
on erillinen prototyyppi (`proto-live-conversation-limit-setting`); tämä on
korjaus nykyiseen toimintaan eikä odota sitä.

## Acceptance Criteria

- [ ] henkilö voi ajaa selvästi yli kymmenen työskentelevää keskustelua tavallisessa asennuksessa; isäntää suojaava raja ja sen peruste kerrottu koodissa
- [ ] testit rajan rajapinnassa päivitetty; kieltäytymisteksti ei väitä kiinteää neljää
