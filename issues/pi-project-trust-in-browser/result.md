# Tulos: työtilat ~/srcin alla ovat Pille luotettuja

## Mitä tehtiin

- **Daemon** (`internal/daemon/project_trust_linux.go`): selaimen keskustelun
  Pi (uusi, jatkettu ja odottaneen viestin käynnistämä) ja kirjoituskentän
  `/`-listan lyhytikäinen Pi saavat Pin oman kertakäyttöisen `--approve`-lipun,
  kun pidetyn työhakemiston todellinen polku (symlinkit ratkaistuina, ytimen
  antama) on tiukasti `~/src`in alla. Jatketulla keskustelulla myös Pille
  kerrottu cwd (istunnon otsakkeen cwd) ratkaistaan ja sen on oltava sama
  hakemisto. Muualla Pin oletus pysyy. Otsikointityöläinen ei saa lippua.
- `~/.pi/agent/trust.json`iin ei kirjoiteta mitään.
- **Ohjeet:** `docs/operations.md` (mitä latautuu ja miksi),
  `internal/daemon/host-context.md` (agentti tietää, miksi repojen taidot
  näkyvät ja miten ihmisen oma `false` toimii). UI-taito ei puhu luottamuksesta.
- **Testit:** päätöksen yksikkötestit (työtila, työpuu, symlinkki ~/srciin ja
  siitä ulos, ~/src itse, ~/srcin ulkopuolella, eri cwd, tallennetut päätökset
  mukaan lukien rikkinäinen ja liian suuri tiedosto), oikea Pi 1.3.0
  (`TestListOnlyPinnedPiLoadsTrustedWorkspaceSkills`: työtilan
  `.agents/skills`-taito näkyy `get_commands`issa ~/srcin alla, ei muualla eikä
  tallennetun `false`n kanssa) ja valepi-testi, joka todistaa sekä apurin että
  keskustelun saavan lipun. Koko `./internal/daemon` vihreä. Selaimen
  `/`-listan spec ei kata työtilan taitoja erikseen (lista tulee Piltä), joten
  selainspeciä ei muutettu.
- **Katselmointi:** `/llm-review` (löytäjä gpt-6-astra, varmistaja
  claude-fable-5-1) ja `/assess-findings`: kaksi harvinaista ohitusta
  (yli 1 MiB:n tallenne, repeytynyt luku Pin kirjoittaessa tiedostoa paikallaan)
  korjattiin: tallenne, jota daemon ei pysty arvioimaan, jättää päätöksen Pille.

## Decisions for later review

- **Ihmisen oma tallennettu `false` kunnioitetaan.** `--approve` ohittaa Pissä
  kaikki tallennetut päätökset, joten daemon lukee `trust.json`in Pin tavalla
  (kanoniset avaimet, lähin voittaa) ja jättää lipun pois, jos lähin päätös on
  `false`. Vaihtoehto: ohittaa aina (yksinkertaisempi, ei Pin tiedoston lukua).
  Peruste: päätteessä tehty nimenomainen ”älä luota” on ihmisen oma valinta, ja
  sen hiljainen ohittaminen selaimessa yllättäisi. Hinta: daemon tulkitsee Pin
  tiedostomuotoa; jos muoto muuttuu niin, ettei sitä voi lukea, lippu jää pois
  ja Pi päättää itse (turvallinen suunta).
- **Raja on polku, ei työtilaluettelo.** Työpuu `~/src`in ulkopuolella (esim.
  käsin `git worktree add ~/muualla`) saa Pin oletuksen, vaikka se on ~/srcin
  repon työpuu. Habitatin ja Taskfleetin työpuut ovat `~/src/<työtila>__worktrees/`
  -kansiossa, joten ne kattuvat. Vaihtoehto: luottaa jokaiseen daemonin
  tuntemaan työpuupaikkaan, mikä vaatisi jatkamispolulle tiedon paikan lajista.
- **`~/src` itse ei ole luotettu**, vain sen alla olevat hakemistot (keskustelu
  ei koskaan käynnisty ~/srcissa itsessään).
- **Taskfleetin Pi-workerit ja pääte jäivät ennalleen.** Ne käynnistyvät
  julkaisun `pi`-käynnistimellä interaktiivisena Pinä, joka näyttää oman
  luottamuskehotteensa (havaittu tmuxissa). Jarin päätös koski daemonin
  käynnistyksiä; valvomaton worker voi jäädä kehotteeseen. Kirjattu intakeen
  (`wholly-awesome-sisters`).
