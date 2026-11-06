# Tekoälyn kirjautuminen vanhentui – kierros 3 (kaksi odottavaa viestiä)

Issue `proto-ai-sign-in-expired`. Edellinen kierros:
`design-system/prototypes/rounds/2026-11-06-tekoaly-kirjautuminen-riff/`.
Jari valitsi 6.11. kierroksen 2 B2:n: kirjautuminen aukeaa **ikkunaan**
keskustelun päälle, ja epäonnistunut vuoro on **lyhyt rivi**. Kierroksen 2
kolmas kysymys jäi epäselväksi: saako odottava viesti lähteä itse, jos (a)
sitä on muokattu odottaessa tai (b) toisessa saman palvelun keskustelussa
odottaa myös viesti. Tämä kierros kertoo sen tarinana vaihe vaiheelta.

## Tarina (sama kaikissa riffeissä)

Yläpalkin vaiheet 1–7 vievät tarinan läpi. Jokainen vaihe on valmis kuva, ja
näkymä toimii siitä eteenpäin myös käsin. *Alusta* palaa vaiheeseen 1.

1. **Viesti odottaa.** Claude hylkäsi kirjautumisen. Viikon tunnit -viesti on
   kentässä, ja sen alla oleva rivi kertoo riffin säännön.
2. **Muokkaat sitä (a).** Viestin loppuun tulee ”Kiitos!”.
3. **Toinen keskustelu (b).** Kesäajan virhe käyttää myös Claudea.
   Kirjoitat *Korjaa kesäajan testit.* ja painat Lähetä. Viesti jää
   odottamaan senkin kenttään.
4. **Kirjaudu uudelleen.** Palaat Viikon tunteihin ja painat *Kirjaudu
   uudelleen*. Ikkuna listaa odottavat viestit ja kertoo, mitä kummallekin
   tapahtuu.
5. **Kirjautunut.** Riffit eroavat tässä.
6. **Hetken päästä** Viikon tunneissa.
7. **Toinen keskustelu jälkeen.** Mitä Kesäajan virheessä tapahtui.

## Riffit

- **R1 Lähtee itse**: kirjautumisen jälkeen kaikki odottavat viestit lähtevät heti sellaisinaan, myös muokattu ja toisen keskustelun viesti.
- **R2 Kysyy ensin**: kirjautumisen jälkeen ikkuna näyttää odottavat viestit, ja sinä valitset, mitkä lähtevät.
- **R3 Vain koskematon**: viesti, jota et ole muokannut odottaessa, lähtee itse; muokattu jää kenttään odottamaan Lähetä-painallusta.

Ero näkyy jo oletusnäkymässä kentän alla olevalla rivillä:

- R1: *Odottaa kentässä · lähtee itse heti, kun olet kirjautunut.*
- R2: *Odottaa kentässä · kirjautumisen jälkeen kysytään, lähetetäänkö se.*
- R3: *Odottaa kentässä · lähtee itse kirjautumisen jälkeen, jos et muokkaa sitä.*

Muokkauksen jälkeen rivi kertoo, mitä nyt tapahtuu. R3:ssa rivi sanoo
*Muokattu · ei lähde itse. Paina Lähetä, niin se lähtee kirjautumisen
jälkeen.* Jos Lähetä painetaan, viesti odottaa taas koskemattomana.
Kentän tyhjentäminen lopettaa odotuksen kaikissa riffeissä.

## Mitä vaiheessa 5 tapahtuu

- **R1.** Ikkuna sulkeutuu, ja molemmat viestit lähtevät: muokattu Viikon
  tunneista ja Kesäajan virheen viesti, vaikka se keskustelu ei ole auki.
  Kentän yllä lukee *Claude-tilaus kirjautunut. Viestisi lähti.*
- **R2.** Ikkuna jää auki otsikolla *Claude-tilaus kirjautunut.* ja listaa
  molemmat viestit valintaruutuina (oletuksena valittuina). Vaihtoehdot ovat
  *Lähetä molemmat* (tai *Lähetä valitut*) ja *Jätä kenttiin*. Valitsematon
  viesti jää kenttäänsä, ja sen kentän yllä lukee *Claude-tilaus
  kirjautunut. Viestisi on kentässä.*
- **R3.** Ikkuna sulkeutuu. Kesäajan virheen koskematon viesti lähtee.
  Muokattu viesti jää Viikon tunteihin kenttään, ja sen yllä lukee
  *Claude-tilaus kirjautunut. Muokkasit viestiä odottaessa, joten se ei
  lähtenyt itse. Lähetä, kun se on valmis.* Rivi on Sinun vuorosissa
  (*Viesti kentässä, ei lähetetty*).

## Rakennettu

Kierros on rakennettu samoista tuotannon komponenteista kuin kierros 2:
`AppShell`, `WorkspaceRail`, `AgentNavItem`, `AgentHeader`, `StatusBell`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`, `Composer`,
`WarningBanner`, `Checkbox`, `SignInSteps` ja `AccountShelf`. Kierroksen
omia ovat ikkunan odottavien viestien lista, R2:n kysymys (tuotannon
`Checkbox`-ruuduista), kentän alla oleva odotusrivi (tuotannon
`ah-composer-reason`-ulkoasulla, kuten kierroksella 2) ja tarinan vaiheet.
Vain Claude-tilaus on mukana. Muut palvelut ja ylikuormitus toimivat kuten
kierroksella 2. Kaikki on synteettistä: Clauden sivu ei aukea, ja koodi
täytetään itse.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-tekoaly-kirjautuminen-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-tekoaly-kirjautuminen-3/check.mjs \
  design-system/prototypes/dist/tekoaly-kirjautuminen-3/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisessa riffissä tarinan seitsemän vaihetta ja tarkistaa
kunkin vaiheen kentän, odotusrivin, ikkunan listan ja viestien kohtalot.
Sen jälkeen se kulkee saman tarinan käsin oikean ikkunan ja Clauden
koodivaiheiden läpi. R2:ssa se jättää Kesäajan virheen valitsematta ja
varmistaa, että viesti jää kenttään. R3:ssa se painaa muokatun viestin
Lähetä-painiketta. Vaiheet kuvataan 1440 px:n vaaleana ja tummana sekä
390 px:n vaaleana kosketuksella, ja oletusnäkymät myös 390 px:n tummana.
Käsin kulku tehdään 1440 px:n ja 390 px:n vaaleana. Kuvat otetaan
kertoimella 2, ja konsolin pitää pysyä puhtaana. `index.html` on sama sivu
ilman upotettuja fontteja glasspadia varten.
