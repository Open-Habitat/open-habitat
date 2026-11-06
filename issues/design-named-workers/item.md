---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/design-named-workers
lane: named-workers
lane_seq: 1
---

# Design: named support workers that report and wait for the next message

## Description

Jari 6.11.2026: toive "tukiagenteista" eli nimetyistä workereista. Kun
worker tulee valmiiksi, sen viesti tai viestit tulevat pääagentille, ja
worker jää hiljaisena odottamaan. Pääagentti voi lähettää sille uuden
viestin, esimerkiksi prototyyppari saa seuraavan riffauspyynnön ja
jatkaa samasta kontekstista sen sijaan, että uusi worker lukee kaiken
alusta.

Selvitettävä ja suositeltava:

1. **Käyttötapaukset**, myös kapellimestarin omasta kokemuksesta
   (prototyyppikierrokset, julkaisun valvonta, vika-analyysi joka johtaa
   korjaukseen, katselmoija, joka tarkistaa korjauksen, tutkija, jolta
   kysytään jatkokysymyksiä), ja milloin tavallinen kertaworker on
   parempi.
2. **Toteutus**: mitä Taskfleetissä jo on (`run message` Pi-workereille,
   `node.awaiting_input`, `run wait`, interactive-ajot, raportit), mitä
   puuttuu (worker, joka raportoi ja jää odottamaan; viestin
   toimittaminen ja vastauksen herättävä paluu pääagentille; nimi;
   konteksti ja sen koko; worktree, branch ja merge jokaisen kierroksen
   jälkeen; muistin ja Claude-kiintiön kulutus; lopetus ja siivous), ja
   kuuluuko muutos Taskfleetiin, Pi:hin vai Habitatiin. Unix-käyttäjäraja
   ja valtuuksien jako (root AGENTS.md, internal/AGENTS.md) pysyvät.
3. **Ohjeistus**: luonnos promptiteksteistä ja skillistä, joka kertoo
   agentille lainalaisuudet: milloin tukiagentti luodaan, milloin sille
   lähetetään viesti, milloin se lopetetaan, miten sen tulokset
   yhdistetään, ja miten sitä ei käytetä.

Tulos on suositus Jarille (arkkitehtuuripäätös tehdään hänen kanssaan),
ei toteutus. Käyttöliittymä prototypoidaan rinnalla
(`proto-named-workers`).

## Acceptance Criteria

- [ ] result.md: käyttötapaukset, toteutusvaihtoehdot ja suositus perusteluineen, promptiluonnokset, avoimet kysymykset Jarille
