---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: done
priority: normal
preparation: pending
provenance: chat
source_ref: chat:2026-11-06/design-named-workers
lane: named-workers
lane_seq: 1
closed: 2026-11-06
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

## Decision (Jari 2026-11-06)

- **Suunta A hyväksytty:** Taskfleet hoitaa nimetyt workerit, Habitat vain
  näyttää ne ja välittää viestit. Järkevä ja yksinkertainen työnjako.
- **Henkilö ei kirjoita workerille suoraan.** Jos workerille halutaan
  sanoa jotain, henkilö puhuu pääagentille, joka välittää viestin.
- **Odotusaika:** 24 h käy, voi olla lyhyempikin, kunhan "nukkuvan"
  workerin saa aina takaisin käyttöön. Worktreen siivous pitää miettiä
  samalla.
- **Avoinna:** laskeutuuko kierroksen työ mainiin joka kierroksella (Jari
  pyysi selitystä ja haluaa oikean tavan käsitellä worktree eri
  tilanteissa), ja otetaanko vaihe 1 käyttöön (Jari ei ole varma, mitä se
  käytännössä tarkoittaa).

## Decision (Jari 2026-11-06, toteutukseen)

- Kierroksen työ yhdistetään mainiin joka kierroksen lopuksi. Lisäksi kun
  worker saa uuden viestin, main yhdistetään sen worktreehen ennen kuin se
  jatkaa (rebase haaran kärkeen), jotta se näkee päätökset ja muiden
  landaukset.
- Vaihe 1 (nykyinen Taskfleet, vain Pi) jätetään väliin. Tehdään kunnolla:
  perustoiminnallisuus toimii ja näkyy niin kuin se on. Ei superkiirettä.
  Habitatissa kokeellinen ominaisuus.
- *Muutokset tarkemmin* -kuvaus (Taskfleet: `--resident --name`,
  `node round-report`, viiveetön herätys, `run message` jatkaa samasta
  istunnosta samassa worktreessä, `run land`, odotusaika ja worktreen
  siivous, herätys uudelleen; Habitat: näyttö ja herätys, ei suoraa
  kirjoittamista) on mietitty ja valmis toteutukseen.

Toteutus: Taskfleetissä issue `named-resident-workers` (repo
`taskfleet`), Habitatissa `named-workers-in-habitat`, joka odottaa
Taskfleetin julkaisua ja prototyypin `proto-named-workers` valintaa.

## Acceptance Criteria

- [ ] result.md: käyttötapaukset, toteutusvaihtoehdot ja suositus perusteluineen, promptiluonnokset, avoimet kysymykset Jarille
