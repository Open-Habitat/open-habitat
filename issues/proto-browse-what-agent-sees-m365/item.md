---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: done
priority: normal
related: ['@proto-m365-setup-flow']
preparation: pending
provenance: chat
source_ref: chat:2026-11-06/proto-browse-m365
lane: m365-browse-proto
lane_seq: 1
closed: 2026-11-06
---

# Prototype: browse what the agent sees in SharePoint and OneDrive, and what it changed

## Description

Jari 6.11.2026, Contosoin käyttöönotossa Ainon kanssa: Aino haluaisi
ensin navigoida ja nähdä, mitä agentti näkee hänen SharePointissaan (ja
OneDrivessa) Microsoft 365 -integraation kautta. Myöhemmin, kun agentti
kirjoittaa sinne jotain, hänen pitäisi nähdä, mitä agentti on tehnyt.
Prototypoi, miltä tämä näyttää.

Lähtökohtia: integraatio käyttää henkilön omaa Microsoft-kirjautumista ja
tasoa (täysi / luonnokset / vain luku; `internal/daemon/integrations/
microsoft_linux.go`, palvelut onedrive ja sharepoint). Agentti näkee
saman kuin henkilön tunnuksilla Graphin kautta näkee, rajattuna tasoon.
Selaa siis sitä, mihin integraatio ylettyy, ei Microsoftin koko
käyttöliittymää uudelleen. Mitä agentti on muuttanut, voi tulla
agentin omasta historiasta (Pi:n työkalukutsut) tai Graphin
muutostiedoista; kerro, kumpaan suunnat nojaavat. Ei uutta tietovarastoa
eikä välimuistia (root AGENTS.md); valtuus pysyy daemonilla henkilön
omana käyttäjänä.

Kysymyksiä suunnille: missä selaus asuu (Integraatiot-asetusten
tilisivu, oma näkymä työtilojen rinnalla, keskustelun sivupaneeli),
miten taso ja "tätä agentti ei näe" näkyvät, miten agentin muutokset
näkyvät (tiedoston kohdalla, keskustelun vuorossa linkkinä, muutoslista),
ja voiko kohteen antaa agentille keskustelussa.

## Decision (Jari 2026-11-06)

Jarin palaute kierroksesta 1: kaksi erillistä linjaa, jotka prototypoidaan
erikseen omina issueinaan.

- **C:n linja** (`proto-conversation-context-view`): keskustelun tilaloki
  ("mitä agentti luki ja muutti tässä keskustelussa") laajennetaan
  nykyisen kontekstin analyysinäkymäksi.
- **B:n linja** (`proto-agent-resources-view`): erillinen, selattava
  näkymä agentin käytössä olevista resursseista. Laajennetaan niin, että
  kaikki integraatiot näkyvät ja ovat selattavissa, ja niihin pääsee myös
  tätä kautta.

Tämä issue suljetaan; kierroksen 1 tulos on molempien lähtökohta.

## Acceptance Criteria

- [ ] kierros 1: kolme suuntaa, näkymätarjous ja kysymykset Jarille
