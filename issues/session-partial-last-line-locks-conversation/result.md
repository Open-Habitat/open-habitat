# Tulos: keskeneräinen viimeinen rivi ei enää lukitse keskustelua

## Mitä tehtiin

- **Daemon** (`internal/daemon/history_tail_linux.go`): kun Pi:n
  istuntotiedosto päättyy rivinvaihdottomaan JSON-alkuun (kiintiö katkaisi
  kirjoituksen), jatkamistodistus pitää keskustelua jatkettavana. Vasta
  käynnistys (`resume`), omistuslukon ja kirjoittajalaskennan jälkeen,
  korjaa tiedoston:
  - ottaa tiedostoon Linuxin kirjoitusvuokran (`F_SETLEASE`): se ei onnistu,
    jos joku muu (esim. päätteen Pi) pitää tiedostoa auki, ja pidättää
    myöhemmän avaajan korjauksen ajan, joten lisätty rivi ei voi kadota;
  - kirjoittaa koko alkuperäisen tiedoston kopioksi viereen
    (`<istunto>.jsonl.partial-<UTC-aika>`, 0600, ei `.jsonl`, joten Pi ja
    Habitat eivät lue sitä), fsync tiedostolle ja hakemistolle;
  - lyhentää tiedoston viimeiseen rivinvaihtoon, vain jos koko ja mtime ovat
    ennallaan. Kokonaisia rivejä ei kosketa.
  - kirjaa `native_history_tail`-tapahtuman (poistettu tavumäärä).
- Jos kopiota ei voi kirjoittaa (EDQUOT/ENOSPC), tiedostoa ei muuteta ja
  käynnistyksen syy on `quota_full`/`storage_full`. Keskeltä rikkinäinen
  historia (kokonainen virheellinen rivi) on `history_damaged`: Pi:tä ei
  käynnistetä eikä tiedostoa muuteta. Tilakyselyt eivät koskaan muuta
  tiedostoa.
- **Selain**: jokainen käynnistyksen syy (`start_problem`) näytetään
  sanoin *Agentti ei käynnistynyt* -rivillä; lepokortin herätys kertoo syyn,
  kun viestin lähettäminenkään ei auttaisi; vain luku -alatunniste kertoo
  vioittuneesta historiasta. `continue` palauttaa `history_damaged` (409) ja
  `quota_full`/`storage_full` (507).

## Todisteet

- `go test ./internal/daemon` (test-focused, vihreä): uudet
  `TestCutPartialTailQuarantinesOriginal`,
  `TestPartialTailOpenElsewhereIsNotCut`,
  `TestPartialTailUnderFullQuotaKeepsFile` (EDQUOT simuloitu),
  `TestCutOffHistoryResumesAfterRestart` (Jarin tilanne: daemonin
  uudelleenkäynnistys, katkennut häntä, viesti toimitetaan kerran, aiempi
  historia tavu tavulta ennallaan, karanteenikopio = alkuperäinen),
  `TestDamagedHistoryStartFailsWithReason`.
- Web-yksikkötestit, `queued-send.spec.ts` (13/13) syy sanoin.
- Riippumaton katselmointi (`/llm-review`, löytäjä gpt-6-astra, varmistaja
  claude-fable-5-1): kaksi löydöstä, molemmat korjattu (kilpatilanne päätteen
  Pi:n kanssa → vuokra; virheellinen lupaus luettavasta historiasta →
  teksti korjattu).

## Päätökset myöhempää katselmointia varten

- **Koko tiedoston kopio, ei pelkkä häntä.** Vaihtoehto oli tallentaa vain
  poistettu häntä (pienempi, onnistuu helpommin lähes täydellä levyllä).
  Valittiin koko kopio, koska ohje vaati alkuperäiset tavut säilyttävän
  karanteenikopion ja Birchn käsikorjauksessa säilytettiin koko tiedosto.
  Täydellä kiintiöllä korjaus odottaa tilan vapautusta ja sanoo sen.
- **Korjaus käynnistettäessä, ei tilakyselyssä.** Kysely vain kertoo
  jatkettavuuden; tiedostoa muutetaan vasta, kun Pi on oikeasti
  käynnistymässä.
- **Karanteenikopiot jäävät** tiedoston viereen; mitään ei siivota
  automaattisesti.
