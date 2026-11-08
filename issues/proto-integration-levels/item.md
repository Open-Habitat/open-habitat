---
created: 2026-11-06
updated: 2026-11-08
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

## Decision (Jari 2026-11-06, kierros 2)

- **Vertailutaulukko** on paras, mutta sen jatkuva näkyvyys on ongelma: kun
  asetus on hoidettu, tiedon pitää olla avattavissa, ei koko ajan esillä.
- Solu ilman oikeutta: lyhyt ja yksinkertainen, **✕ Ei**.
- Neljän eri Entra-sovelluksen rakentaminen (yksi tasoa kohden) pitäisi
  olla **yksi yhteinen työnkulku**, jossa ne kaikki tehdään. Prototypoidaan
  (kierros 3), yhteensopivasti `proto-m365-setup-flow`-kierroksen 4 (A1b,
  alakohdat) kanssa.

## Decision (Jari 2026-11-06, kierros 3)

**1 Sovellus kerrallaan**, ja **3 Yksi komento** sen rinnalle. Mukaan oikeat
kuvakaappaukset. Cloud Shellin avaamisesta pitää tehdä kuvakaappaukset:
prototyypin polut ovat nyt väärin, eikä Jari löytänyt Cloud Shelliä. Ohjeen
pitää auttaa siinä (Entra admin centerin yläpalkin Cloud Shell -kuvake,
tai portal.azure.com / shell.azure.com; tarkista Microsoftin
dokumentaatiosta ja tilausvaatimus). Kuvakaappaukset Jarin tenantista
tarvitaan häneltä; peitä tunnukset kuten kierroksella 3.

## Acceptance Criteria

- [x] kierros 1: tämänhetkiset tasot ja kolme suuntaa, näkymätarjous ja kysymykset Jarille; Graphin tekniset rajat result.md:ssä
- [x] kierros 2: kolme riffiä Ruudukosta (vertailutaulukko, avautuva ruudukko, erillinen ikkuna), solut ilman oikeutta kieltomuodossa; näkymätarjous ja kysymykset Jarille
- [x] kierros 3: yksi työnkulku neljälle Entra-sovellukselle kolmena riffinä (sovellus kerrallaan, vaihe kerrallaan, yksi komento) ja taulukko auki ennen asetusta, avattavissa sen jälkeen; näkymätarjous ja kysymykset Jarille
- [x] Jari valitsee kierroksen 3 riffin
- [x] kierros 4: sovellus kerrallaan pelkkänä klikkauspolkuna ilman Cloud Shelliä, näkymätarjous ja kysymykset Jarille
- [ ] Jari valitsee kierroksen 4 riffin

## Jari 2026-11-08: Cloud Shell ei aukea

Jari yritti avata Cloud Shellin Azure-portaalista (yläpalkin `>_`-kuvake):
*Welcome to Azure Cloud Shell* → Bash → **No valid subscriptions found · You
need an Azure subscription to use Azure cloud Shell**
(`evidence/jari-2026-11-08-cloud-shell-{1,2,3}.png`). Tavallisella M365-tenantilla
ei ole Azure-tilausta, joten kierroksen 3 riffi *3 Yksi komento* ei toimi
juuri niille ylläpitäjille, joille ohje on tehty. Klikkaamalla Jari pystyy
tekemään integraation (SharePoint onnistui).

Kapellimestarin päätös: Cloud Shell -reitti poistetaan ohjeesta; ohjattu
asetus on **1 Sovellus kerrallaan** klikkauspolkuna olemassa olevin oikein
kuvakaappauksin. Kierros 4 näyttää sen ilman Cloud Shelliä.

## Decision (Jari 2026-11-08, kierros 4)

**Jokainen kokonaan**, mutta ohjeen pitää osata ohittaa jo tehdyt kohdat, tai
henkilö valitsee alussa, mitkä neljästä tasosta hän nyt asettaa. Aloitukseen
myös vertailutaulukko. Kierros 5: riffit aloitusnäkymästä ja aloitusaskeleista.
- [x] kierros 4: klikkauspolku ilman Cloud Shelliä
- [ ] kierros 5: Jokainen kokonaan, aloitusnäkymä (valitse tasot, ohita tehdyt, taulukko), näkymätarjous ja kysymykset Jarille
