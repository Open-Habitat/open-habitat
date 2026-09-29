---
created: 2026-09-29
updated: 2026-09-29
type: task
status: open
priority: normal
related: ['@build-agent-control', '@plan-v1-implementation']
lane: planning
collision: [docs/]
---

# Rethink project documents with Jari

## Tarkoitus

Käymme Jarin kanssa projektin dokumentteja läpi `/rethink-document`-skillillä,
jotta toteuttaja erottaa oikeat päätökset agentin lisäämistä vaatimuksista.
Tämä issue on jatkamiskohta: pidetään käsiteltyjen dokumenttien lista ja seuraava
ehdokas ajan tasalla, ei rakenneta erillistä katselmointiprosessia.

## Käsitelty

| Dokumentti | Lopputulos | Commit |
|---|---|---|
| [Agenttiohjauksen issue](../build-agent-control/item.md) | Tulevan toteutuksen käyttäjälle näkyvät lopputulokset, ei päätöshistoriaa. SSE ja päättyneen selainkeskustelun jatkaminen kuuluvat työhön; Pi:n kysymysdialogit ja terminaaliohjauksen haltuunotto eivät. | `8925a89` |
| [Toteutusbriefit](../plan-v1-implementation/implementation-briefs.md) | Lyhyt toteutuksen omistajuuskartta. Rajapintatiedot omalle sivulleen; vanhat portit ja perusteettomasti sitovat numerot pois. | `b54636a` |
| [ADR 0003: host stack](../../docs/adr-0003-host-stack.md) | Teknologiavalinta, vastuurajat ja perustelut. OAuth/OIDC-kirjaston valinta jää toteuttajalle; protokolla- ja käyttödetaljit muualle. | `4f50e89` |

ADR 0003:n hyväksyntämetatietojen täsmennys sekä historia- ja socket-detaljien
viimeinen siivous ovat tätä issueta luotaessa vielä työpuussa ilman committia.

Samalla on tehty kohdennettuja korjauksia muun muassa rajapintakuvaukseen,
arkkitehtuuri- ja toteutussivuihin, ADR 0004:ään, CLI-konformanssiin ja liittyviin
issueihin. Näitä ei ole vielä kokonaisuudessaan käyty läpi tällä skillillä.

## Seuraavaksi

Ehdotus: [docs/interfaces.md](../../docs/interfaces.md). Sivulle on siirretty
yksityiskohtia kahdesta edellisestä dokumentista. Selvitetään, mikä on varsinainen
rajapintasopimus, mikä nykyisen toteutuksen kuvausta ja mikä toteuttajan harkintaa.
Tämän sivun varsinainen läpikäynti on vielä aloittamatta.

## Lyhyt briefi jatkajalle

- Dokumentti palvelee omaa tehtäväänsä: ADR kertoo päätöksen ja syyn, toteutusissue
  tulevan työn. Korjaushistoria kuuluu Gitiin, ei varsinaiseen tekstiin.
- Jari ei halua säilyttää issueiden vanhoja päätösmerkintöjä sanatarkasti tai
  testikuitteja vain säilyttämisen vuoksi. Tämä tarkentaa skillin oletusta.
- Tarkat raja- ja puskuriluvut eivät ole tuotevaatimuksia. Mekanismi tarvitsee
  konkreettisen tarpeen; arvot säätyvät havaintojen mukaan eivätkä estä normaalia käyttöä.
- OAuth/OIDC-kirjaston valinta ei ole Jarin vaatimus. Toimiva ja turvallinen
  kirjautuminen on; tämä ei hyväksy nykyisiä kirjautumisongelmia.
- Riippumattomaan mallikatselmointiin Jari suosii Astraa.
