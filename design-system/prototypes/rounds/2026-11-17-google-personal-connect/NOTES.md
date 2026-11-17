# Henkilökohtaisen Google-tilin yhdistäminen – kierros 2

Issue `google-personal-accounts`. Suunnat, suositus ja kysymykset ovat
issuen `result-person.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`) ja `AccountSettings`
Tiedot agenteille -osiossaan, ja sen päällä tuotannon `ConnectDialog`
Googlen pasted-redirect-kirjautumisessa (`Intro`, `PasteStep`,
`FailedStep`, yhdistetty-näkymä). Kierroksen palat viedään ikkunaan
portaaleilla (`useSlot`, kuten kierroksessa `2026-11-14-microsoft-folder-sizes`).
Useampi pala voi olla saman ankkurin vieressä; `useSlot` hyväksyy toiset
palat naapureikseen, jotta ne eivät siirtele toisiaan loputtomasti.
B piilottaa tuotannon virhesivuhuomautuksen ja ohjeluettelon, koska sen
reitti korvaa ne. C piilottaa Avaa Google -painikkeen, kun henkilö valitsee
"En tunnista palvelinta".

`PasteStep` pitää "avattu"-tilan itsellään. Tilanne, joka alkaa Googlen
välilehden avaamisen jälkeen, painaa tuotannon omaa linkkiä kerran, ja
kierroksen klikkausvahti estää ulkoisen osoitteen avaamisen.

`?s=<tilanne>` ja `?theme=dark` valitsevat alkutilan. Tiedot ovat keksittyjä:
palvelin `habitat.example.org`, tili `aino.esimerkki@gmail.example` ja
client ID `123456789012-exampleclientid…apps.googleusercontent.com`.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-17-google-personal-connect/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node design-system/prototypes/rounds/2026-11-17-google-personal-connect/check.mjs \
  design-system/prototypes/dist/google-personal-connect/offline.html <kuvahakemisto>
```

Rakennus kirjoittaa `design-system/prototypes/dist/google-personal-connect/`:iin
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
Tarkistus käy kolme suuntaa ja 17 tilannetta 1440 ja 390 px:n leveydellä
vaaleana ja tummana ja klikkaa jokaisen suunnan polun: taso → ennen Googlea
→ ohje → Googlen avaus → pysäytyksen ohje ja client ID:n kopiointi →
virheen sisältävä paluuosoite → alusta → oikea paluuosoite → yhdistetty
myönnettyine palveluineen. Lisäksi C:n pysähdys, osittaisen myönnön kortti,
englanti ja yksi polku 390 px:ssä. Konsoli on puhdas. `--quick` ajaa vain
1440 px vaalean.

## Mitä palvelimen ja sovelluksen pitäisi osata (ehdotus)

Valtarajat eivät muutu: kaikki tapahtuu selaimessa ja henkilön omassa
daemonissa, eikä uutta kenttää tule sopimukseen.

- **Ohje on ehdollinen.** Habitat ei näe Googlen varoitusta eikä estoja,
  koska ne tapahtuvat Googlen välilehdellä, eikä `GoogleApp` kerro yleisöä,
  julkaisutilaa, käyttäjärajaa tai Workspace-luottamusta. Mitään tilamerkkiä
  ei siksi näytetä.
- **Client ID tulee kirjautumisosoitteesta.** Selain lukee sen
  `authorization_url`:n `client_id`-parametrista, jonka daemon jo antaa.
  Työtilin ylläpitäjä tarvitsee juuri sen luottaakseen sovellukseen.
- **Googlen virheen sisältävä paluuosoite.** Nyt `google_linux.go`:n
  `Redirect` hylkää jokaisen `error=`-osoitteen (`redirect_rejected`), ja
  ikkuna sanoo, että osoite voi olla vanhan kirjautumisen. Ehdotus: selain
  tai daemon tunnistaa `error=access_denied`in ja näyttää peruutuksen
  (`cancelled`) ja rivin, joka kertoo keskeytyksen tapahtuneen Googlen
  sivulla. Tarkistamatta on, ohjaako Google varoitussivulta poistumisen
  paluuosoitteeseen lainkaan; lupasivun peruutus ohjaa.
- **Myönnetyt palvelut yhdistetty-näkymässä.** Sovelluskerros hakee tilin
  integraatiolistasta ja näyttää palvelut ja puuttuvat luvat jo ikkunassa,
  ei vasta kortissa. Tieto on jo `Account.grant`- ja `services[].access`-kentissä.
- **Palvelimen osoite** on selaimen `location.host`. Ylläpitäjän nimeä tai
  yhteystietoa ei ole, joten tekstit sanovat "palvelimen ylläpitäjä".
