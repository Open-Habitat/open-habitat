# Tulos: täysi tallennustila ei enää lukitse siivousta

## Mitä täydellä kiintiöllä oikeasti epäonnistui

- **Agentti.** Pi ei voi lisätä keskusteluhistoriaan riviä (EDQUOT), joten
  vuoro tai käynnistys epäonnistuu. Daemon tunnistaa tämän jo ennestään
  (`quota_full` / `storage_full`, 507), ja selain piilottaa kirjoituskentän
  täydellä tilalla. Tätä ei muutettu (ks. päätökset).
- **Työtilan poisto selaimesta (sekä "roskakoriin" että "pysyvästi").**
  Molemmat siirtävät hakemiston ensin `Trash/files`-kansioon, ja siirto
  kirjoittaa ensin roskakorin info-tiedoston. Sen ensimmäinen lohko ei
  mahdu, joten poisto epäonnistui. Tämä oli se varsinainen lukko: henkilö
  ei voinut vapauttaa tilaa ilman agenttia.
- **Roskakorin puuttuminen.** Jos `~/.local/share/Trash` ei ollut vielä
  olemassa, sitä ei voinut luoda täydellä kiintiöllä, jolloin mikään
  selaimen poisto ei toiminut.
- **Roskakorin "poista pysyvästi" ja "tyhjennä roskakori"** toimivat jo:
  ne vain poistavat (unlink), eivätkä kirjoita mitään.
- **Editori (code-server)** ei ole tämän muutoksen piirissä; se kirjoittaa
  omaa tilaansa eikä luultavasti käynnisty täydellä kiintiöllä. Selaimessa
  ei ole henkilön omaa päätettä (vain workerin vain luku -näkymä).

## Mitä tehtiin

- **Daemon** (`internal/daemon/workspace_delete_linux.go`,
  `workspace_trash_linux.go`):
  - Kun info-tiedoston kirjoitus epäonnistuu EDQUOT/ENOSPC:llä, siirto
    tehdään ilman info-tiedostoa (`rename` ei vaadi uutta tilaa).
    - Pysyvä poisto poistaa siirretyn puun. Jos tarkistukset pitävät sen
      (esim. fetch ei onnistu), se palautetaan paikalleen ja vastaus on
      507, eikä mitään ole muuttunut.
    - Roskakoriin siirto jättää roskakoriin merkinnän, jonka voi poistaa
      sieltä, mutta jota ei voi palauttaa selaimesta. Vastauksessa on
      `restore: "unavailable"`; sopimukseen (`workspace-deletion.schema.json`)
      lisättiin kenttä.
    - Jos edes siirto ei onnistu, vastaus on 507 eikä mitään ole siirretty.
  - Daemon luo roskakorin hakemistot käynnistyessään, kun tilaa vielä on.
- **Selain:**
  - Keskustelun "Tallennustila on täynnä" -ilmoituksessa on painike
    "Tallennustila ja roskakori", joka vie Asetukset › Tallennustila
    -näkymään.
  - Ilmoitus, kellon tila-kohta, erittelyn varoitus ja epäonnistuneen
    vuoron viesti kertovat, mitä henkilö voi tehdä itse: tyhjentää
    roskakorin tai poistaa työtilan ja sitten roskakorista.
  - Poiston jälkeinen ilmoitus ei tarjoa kumoamista merkinnälle, jota ei
    voi palauttaa, ja sanoo, että tila vapautuu, kun sen poistaa
    roskakorista.

## Todisteet

- Go: `./scripts/test-focused.sh --area go --go-package ./internal/daemon`
  vihreä. Uudet testit `workspace_delete_full_linux_test.go`: molemmat
  poistotavat EDQUOT- ja ENOSPC-tilassa, siirto joka ei onnistu, palautus
  kun tarkistus pitää, keskeytynyt pysyvä poisto ja vaihtunut hakemisto.
- Oikea kernel-kiintiö: `TestWorkspaceDeleteAtRealFullQuota` ajettiin
  tmpfs-liitoksella (`usrquota,usrquota_block_hardlimit=4M`), joka täytettiin.
  Roskakoriin siirto, roskakorin tyhjennys ja pysyvä poisto (oikea
  `git fetch` paikalliseen etärepoon) onnistuivat. Tavallinen ajo ohittaa
  testin.
- Sopimukset: `--area contracts` vihreä.
- Web: `./scripts/test-web-fast.sh` vihreä. Uusi `TrashNotice.test.tsx`, ja
  `workspaceTrash.test.ts`:ssä 507-koodien tunnistus sekä se, että
  `restore`-kentällinen vastaus läpäisee sopimuksen.
- Selain: `lab-workspace-trash.spec.ts` (uusi tapaus: täysi kiintiö →
  ilmoituksen painike → Tallennustila → roskakorin tyhjennys) 3× vihreä.
  `quota-pressure.spec.ts` ja `lab-notices-composer.spec.ts` vihreitä.
- Katselmointi: `/llm-review` (gpt-6-astra). Se löysi kaksi vikaa, ja
  molemmat korjattiin: `restore`-kenttä puuttui sopimuksesta, jolloin selain
  olisi hylännyt onnistuneen siirron. Lisäksi vaihtuneen hakemiston
  ilmoitus lupasi palautuksen.

## Päätökset myöhempää tarkastelua varten

1. **Roskakoriin siirto täydellä tilalla tapahtuu ilman palautustietoa.**
   - *Vaihtoehdot:* (a) kieltäydytään (siirto ei voi pitää
     palautuslupausta); (b) pidetään 4 KiB:n varaus info-tiedostolle.
   - *Miksi tämä:* Työtilaa, jota ei saa poistaa suoraan (pushaamatonta
     työtä), ei muuten saisi selaimesta pois. Jos siirto kielletään, lukko
     jää juuri siihen tapaukseen. Tiedostot säilyvät roskakorissa
     koskemattomina.
2. **Agentti ei toimi täydellä kiintiöllä; varausta ei tehty.**
   - *Vaihtoehdot:* daemon pitäisi pientä varaustiedostoa ja vapauttaisi
     sen siivousvuoroa varten; tai Pi:n historiakirjoitus epäonnistuisi
     pehmeästi.
   - *Miksi tämä:* `internal/AGENTS.md` kieltää tuotepuolen varaukset ja
     kirjanpidon (toinen, valvomaton kiintiö). Pi on natiivi komponentti,
     jonka historiakirjoitusta emme muuta. Nyt kun henkilö pystyy itse
     vapauttamaan tilaa ja näkymä ohjaa hänet sinne, agentti jatkaa
     heti, kun tilaa on.
3. **Pysyvä poisto palautetaan paikalleen (507), jos tarkistukset pitävät
   sen täydellä tilalla.** Vaihtoehto olisi jättää se roskakoriin ilman
   tietoa. Palautus pitää tilan muuttumattomana, ja henkilö voi valita
   roskakorin ja poistaa sieltä.
4. **Roskakorin hakemistot luodaan daemonin käynnistyessä.** Ne ovat
   tavallinen freedesktop-sijainti, eikä se ole uusi tallennuspaikka.

## Ehdotus jatkoksi

Palautus tiedottomasta roskakorimerkinnästä. Kun tilaa taas on, daemon
voisi tarjota palautusta hakemistoon `~/src/<nimi>` niille merkinnöille,
jotka se itse siirsi täydellä tilalla. Siihen tarvittaisiin jokin kestävä
merkintä siirrosta, mikä on oma suunnittelukysymyksensä.
