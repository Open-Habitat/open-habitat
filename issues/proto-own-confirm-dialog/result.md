# Kierros 1: oma vahvistus tallentamattomille muutoksille

Prototyyppi: `design-system/prototypes/rounds/2026-11-07-oma-vahvistus/`
(`NOTES.md` kertoo yläpalkin, tilanteet ja tarkistuksen). Kuvat ovat
`evidence/`-hakemistossa etuliitteellä `r1-`.

- **A Ikkuna**: kysymys keskellä sivua, sivu himmenee; kolme nimettyä painiketta: Tallenna ja sulje · Hylkää muutokset · Jatka muokkausta.
- **B Palkki**: rivi editorin alareunassa, muu sivu käytettävissä; lyhyet painikkeet Tallenna · Hylkää · Peru, ja kohde kerrotaan rivillä.
- **C Ei kysy**: ei kysymystä; poistuminen tallentaa ja ilmoitus kertoo sen, Kumoa palauttaa tekstin tallentamattomaksi. Kysyy vain, kun tallennus ei onnistu.

Akseli: kysytäänkö ja miten painavasti. Sama näkymä ja sama sisältö kaikissa:
`docs/asennus.md` on muokattu (rivit 3 ja 7), ja neljä tilannetta ovat
editorin sulkeminen, tiedoston vaihto puusta, siirtyminen toisen työtilan
keskusteluun ja VS Coden vaihtuminen puhelimen editoriin, kun ikkuna kapenee.
Kaikki suunnat näkyvät molemmilla kielillä, 1440 ja 390 px, vaaleana ja
tummana.

## Nykytila

`r1-0-nyt-confirm.avif`, `r1-0-nyt-vscode-confirm.avif` ja
`r1-0-nyt-beforeunload.avif` ovat oikean Chromiumin kuvia (virtuaalinäyttö,
kerroin 2) tuotannon teksteillä:

- `web/src/app/BrowserDocument.tsx` `leave()` kysyy
  `window.confirm(discardQuestion)`. Sitä kutsuvat editorin sulkeminen
  (`WorkspaceEditor.tsx` `show(false)`), tiedoston avaaminen (`open`, myös
  uudelleen, jos tekstiä kirjoitettiin lukemisen aikana), työtilan vaihto
  editorissa ja jokainen reitin vaihto `useBlocker`in kautta.
- Kysymys on suomeksi, mutta painikkeet ovat selaimen kielellä (*Cancel /
  OK*), ja *OK* hylkää muutokset. Otsikkona on palvelimen osoite.
- `WorkspaceEditor.tsx` kysyy `window.confirm(switchToPhoneEditor)`, kun
  ikkuna kapenee alle 800 px ja VS Code on auki – aina, koska Habitat ei näe
  VS Coden tallentamattomia muutoksia.

## Hostin tosiasiat, joita suunnat olettavat

- **Kysymys muuttuu odottavaksi.** `leave()` on nyt synkroninen ja palauttaa
  totuusarvon heti. A ja B tarvitsevat lupauksen, joka ratkeaa painikkeesta;
  `useBlocker` tukee tätä suoraan (`blocker.proceed()` / `blocker.reset()`),
  ja `open`/`show`/`switchEngine` odottavat vastausta. C ei kysy, mutta
  tarvitsee saman odotuksen tallennukselle.
- **Tallenna ja jatka** käyttää olemassa olevaa `save()`ia, joka voi jäädä
  odottamaan: agentin muutos samassa kohdassa (yhdistäminen), estetty
  tallennus tai vastaamaton pyyntö. Silloin teksti jää editoriin ja kysymys
  kertoo syyn (A ja B), tai C kysyy.
- **C:n Kumoa** kirjoittaa levylle version, joka oli siellä ennen tallennusta,
  samalla revisiotarkistuksella kuin tallennus, ja kieltäytyy, jos tiedosto
  on muuttunut sen jälkeen. Tätä ei ole nyt.
- **VS Coden tallennus** (A:n *Tallenna ja vaihda*, C:n automaattinen
  tallennus) vaatii kanavan, jota ei ole: `internal/gateway/editor_bridge.js`
  välittää VS Codesta vain tunnuksen ja kohdistuksen, eikä Habitat näe tai
  käske VS Coden puskureita. B ei oleta tätä: se jättää VS Coden käyttöön ja
  neuvoo tallentamaan siellä.
- **Keskustelun vaihto samassa työtilassa** ei sulje editoria
  (`WorkspaceEditor` pysyy samana, avain on tunnus), mutta `useBlocker`
  kysyy silti jokaisella reitin vaihdolla, ja hyväksynnän jälkeen teksti
  jää editoriin. Prototyyppi näyttää siksi toisen työtilan keskustelun, jossa
  menetys on todellinen; samassa työtilassa ei pitäisi kysyä mitään.

## Missä selaimen oma kysymys jää

Välilehden tai ikkunan sulkeminen, sivun uudelleenlataus, osoitteen
kirjoittaminen, selaimen takaisin-painike sivulta pois ja Habitatin ulkopuolinen
linkki samassa välilehdessä kysyvät aina selaimen omalla `beforeunload`-
kysymyksellä (*Leave site? Changes you made may not be saved.*). Selain ei
anna sivun näyttää siinä omaa tekstiä eikä painikkeita, eikä kysymystä voi
korvata. Se jää kaikkiin suuntiin, myös C:hen: C tallentaa vain Habitatin
sisäiset siirtymät, eikä sivun sulkemisen aikana voi luotettavasti tallentaa.
Päivityksen jälkeinen automaattinen uudelleenlataus (`blockAutomaticReload`)
lykkääntyy jo nyt kysymättä, kun tekstiä on tallentamatta.

## Suositus

**C, ja A:n ikkuna ainoana kysymyksenä.** Jarin moite oli, että kysymys
keskeyttää. Sulkeminen, tiedoston vaihto ja keskustelun vaihto ovat lähes
aina tarkoituksellisia, ja editorissa on jo tallennuspainike, joten
tallentaminen poistuttaessa tekee sen, mitä ihminen yleensä halusi, ja
*Kumoa* korjaa harvan väärän tapauksen kysymättä joka kerta. Kun tallennus ei
onnistu (agentin muutos samassa kohdassa), kysytään A:n ikkunalla, jonka
painikkeet sanovat tekonsa molemmilla kielillä. VS Codelle C:n
automaattinen tallennus vaatii puuttuvan kanavan, joten siihen asti VS Coden
vaihto kysytään B:n tavoin (VS Code jää käyttöön, tallenna siellä).

Riski: C kirjoittaa keskeneräisen tekstin työtilaan, jossa agentti voi lukea
sen. Kumoa palauttaa levyn, mutta agentti on voinut jo nähdä version.

## Kysymykset Jarille

1. Saako poistuminen tallentaa kysymättä (C), vai haluatko aina päättää itse
   (A tai B)?
2. C:ssä poistuminen ei voi hylätä muutoksia, ja *Kumoa* vain palauttaa
   tekstin tallentamattomaksi. Tehdäänkö editoriin oma *Hylkää muutokset*,
   vai riittääkö, että hylkääminen tapahtuu vain, kun tallennus epäonnistuu?
3. VS Coden vaihtuessa puhelimen editoriin: kysytäänkö kuten B (tallenna
   VS Codessa itse), vai tehdäänkö kanava, jolla Habitat tallentaa VS Coden
   puolesta (A:n *Tallenna ja vaihda*, C)?
