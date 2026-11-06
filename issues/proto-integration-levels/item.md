---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: normal
related: ['@proto-m365-setup-flow']
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/proto-integration-levels
lane: integration-levels-proto
lane_seq: 1
---

# Prototype: integration access levels and what each allows

## Description

Jari 6.11.2026, Contosoin käyttöönotossa Ainon kanssa: integraation
*Luonnokset*-taso on harhaanjohtava. He luulivat sen olevan muuten sama
kuin täysi (luku ja kirjoitus), mutta ilman sähköpostin lähettämistä.
Todellisuudessa luonnostaso on lähes vain luku: sähköposti luetaan ja
luonnostellaan, kalenterit, yhteystiedot ja tiedostot vain luetaan
(`microsoftLevelScopes`, `internal/daemon/integrations/microsoft_linux.go`;
perustelu koodissa: tapahtuma lähettää kutsuja ja tiedoston jako voi
luoda julkisen linkin). Väliin tarvittaisiin taso "kaikki paitsi
lähettäminen". Prototypoi, millaiset tasot on ja mitä niillä voi tehdä.

Suunnille: tasojen määrä ja nimet; mitä kukin sallii palveluittain
(sähköposti, kalenteri, yhteystiedot, OneDrive, SharePoint, Googlen ja
Dropboxin vastaavat), sanottuna ihmisen kielellä niin, ettei nimestä
tarvitse arvata; miten taso valitaan ylläpitäjän asetuksessa ja
henkilön tilillä; miten Microsoftin "kaikki paitsi lähetys" -tason
rajat esitetään (kalenterikutsut, jakolinkit). Tarkista Graphin
oikeuksista, mitä tällainen taso voi teknisesti rajata ja mitä ei
(esim. Mail.ReadWrite ilman Mail.Send; Calendars.ReadWrite lähettää
kutsuja; Files.ReadWrite.All voi luoda jakolinkkejä), ja kerro se
result.md:ssä. Liittyy `proto-m365-setup-flow`-prototyyppiin (sen
oikeusvaihe riippuu tasoista). Prototyyppikierros AGENTS-WORKFLOW.md:n
mukaan.

Jari 6.11. (kuvakaappaus ylläpitäjän palvelinasetuksista, Microsoft 365
*Ei tarjolla*, rivit *Taso: Luonnokset, ei lähetystä* ja *Taso: Vain luku*,
kullakin *Aseta tunnukset…*): tähän tarvitaan tasojen kuvaukset kunnolla.
Ylläpitäjän listassa jokaisen tason kohdalla pitää näkyä, mitä taso
sallii ja mitä ei, ennen kuin hän asettaa sille tunnukset.

## Decision (Jari 2026-11-06)

Kierros 2 riffaa **Ruudukkoa**. Kohdat, joissa ei ole oikeutta, ovat nyt
epäselviä, ja ruudukko tekee käyttöliittymästä tukkoisen. Riffataan
vertailutaulukolla, tai niin että taulukot avautuvat erikseen. Jari palaa
itse tasoihin seuraavan kierroksen jälkeen; tämä kierros auttaa häntä
ymmärtämään tasot.

## Acceptance Criteria

- [x] kierros 1: tämänhetkiset tasot ja kolme suuntaa, näkymätarjous ja kysymykset Jarille; Graphin tekniset rajat result.md:ssä
