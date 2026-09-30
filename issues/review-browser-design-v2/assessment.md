# UI-pohjan arvio selainpolku v2:ta vasten

30.9.2026. Koodihavainnot perustuvat revisioon `82a5c4e` ja aiempiin
synteettisen labin kuviin. [Ensiluku](first-read.md) käsittelee designin
sisällön ja sen erot sovittuun toimintaan.

## Johtopäätös

Nykyisen UI:n yhteisen fonttikoon, välistyksen tai painikkeen muuttaminen ei
välity näkymiin johdonmukaisesti. Osa mitoista tulee tokeneista, osa on
kirjoitettu käyttöpaikkaan, ja komponentin ulkoasua muutetaan sen ympärillä
olevan näkymän CSS-valitsimilla. Siksi designin tarkka toteuttaminen vaatii
sekä yhteisen pohjan parantamista että näkymäkohtaista sovitusta.

Nykyiset tuotantokomponentit ovat käyttökelpoinen lähtökohta. Näyttömallien
ja sovelluslogiikan erottelu, estosyiden esitys sekä olemassa olevat testit ja
Storybook tukevat ulkoasun muuttamista. Tämä arvio ei kuitenkaan osoita koko
käyttöliittymän toimivuutta: siinä ei ajettu uusia selainkokeita.

Suosittelen aloittamaan yhteisistä mitoitus- ja asetteluongelmista ja
sovittamaan niiden ratkaisut ensin yhteen kokonaiseen näkymään. Sen jälkeen
samaa pohjaa voi käyttää sivupalkin, keskustelun ja onboardingin viimeistelyyn.
Tavoite on designia tarkasti vastaava käyttöliittymä, jonka yhteistä ilmettä
voi säätää ennustettavasti. Alla olevat toteutustavat ovat suosituksia;
komponenttijako, tyylimekanismi ja työn pilkkominen täsmentyvät toteutuksessa.

## Mikä nykyisessä pohjassa auttaa

Komponentit saavat näyttömallin ja palauttavat käyttäjän aikomuksen.
Verkkoliikenne, luonnokset ja istuntosidonta ovat `web/src/app/`-kerroksessa.
Tämä antaa mahdollisuuden muuttaa esitystä säilyttäen toiminnan, vaikka myös
sovelluskerroksen näkymäkoostumuksia täytyy muokata.

`Availability` ja `Button` välittävät estetyn toiminnon syyn, ja `StatusMark`
yhdistää tilan tekstin ja merkin. Näitä sopimuksia voi käyttää myös uudessa
ilmeessä. Väritokenit ovat jo vedosten paletti, ja teeman vaihto on yhteinen
sovellukselle, Storybookille ja labille.

Testit käyttävät pääosin rooleja ja nimiä, joten ne kestävät rakenteen ja
ulkoasun muutoksia. Storybook ja synteettisen labin kuvaustyökalut antavat
valmiit välineet vertailuun. Saavutettavuudelle on selainkokeita molemmissa
teemoissa ja 200 prosentin zoomilla.

## Missä yhteistä työtä tarvitaan

### Mitoitus ei välity yhteisistä arvoista näkymiin

`components.css` käyttää kirjaimellista fonttikokoa 24 kertaa ja tokenia
viidesti. Otsikon koko määritellään eri tavoin `app.css`:ssä,
`.ah-agent-header h1`:ssä ja lukunäkymän ohituksessa. Layout-mittoja on myös
sovelluskomponenteissa: `BrowserConversation` rajoittaa viestivirran korkeuden
inline-tyylillä arvoon `60vh`.

Yhteisiä arvoja kannattaa käyttää niissä mitoissa, joiden halutaan muuttuvan
yhdessä. Designin mitat toimivat tavoitellun ulkoasun vertailukohtana;
jokaiselle luvulle ei tästä seuraa omaa tokenia.
[Tuotantodesign](../../design-system/production-v1.md) pitää vedosten
yksittäisiä mittoja sommittelureferensseinä. Toteutuksessa arvioidaan, miltä
osin nykyistä asteikkoa pitää muuttaa tarkan lopputuloksen saamiseksi.

### Keskustelun ja onboardingin asettelua pitää muuttaa

`AppShell` käyttää yhtä grid-rakennetta, jonka käyttäytymistä sivupalkin
läsnäolo muuttaa `:has(.ah-rail)`-valitsimella. Keskustelun viestivirta on
sen sisällä omassa korkeusrajoitetussa laatikossaan. Designissa yläpalkki,
vierittyvä viestivirta ja kirjoituskenttä muodostavat koko näkymän asettelun.
Tämä ero vaatii rakenteellista sovitusta.

Onboardingin kolme korttia on toteutettu erikseen: `LoginCard`,
`GitHubRepoChooser` ja `PiDeviceSignIn` käyttävät eri leveyksiä ja täytteitä.
Design yhdistää ne kehykseen, jossa näkyvät tuotenimi, palvelin ja vaihe.
Yhteinen kehys on perusteltu ehdotus tähän toistuvaan tarpeeseen. Keskustelun
ja keskitettyjen sivujen yhteiset osat täsmentyvät niitä sovitettaessa.

### Painikkeiden, tilamerkkien ja ikonien esitys hajautuu

`components.css`:ssä on 11 painiketta käyttöpaikan perusteella muuttavaa
esi-isävalitsinta. `Menu` ja `Dialog` puolestaan määräävät laukaisimensa
ulkoasun, mikä vaikeuttaa designin tilipainikkeen ja ikonivalikon tekemistä.
Painikkeen esitystapojen kokoaminen yhteiseen toteutukseen helpottaisi
muutoksia. Estetyn painikkeen läpinäkyvyys pitää sovittaa designiin ja sen
luettavuus tarkistaa molemmissa teemoissa.

Tilamerkkien esitys jakautuu `StatusMark`in, `Badge`n ja sivupalkin
CSS-ohitusten kesken. Niille kannattaa määritellä yhteinen visuaalinen
sanasto. Tekstimerkki-ikoneista osa näkyi ensiluvun selainympäristössä
puuttuvan merkin ruutuina. Pieni SVG-ikonijoukko olisi tapa poistaa tämä
fonttiriippuvuus.

### Tyyliohitukset vaikeuttavat muutosten ennakointia

Lukunäkymä esimerkiksi poistaa viestikortin reunan, taustan ja täytteen
valitsimella `.ah-reading-view .ah-feed .ah-message:not(.ah-message-alert)`.
Yhteisen viestityylin vaikutus riippuu siten siitä, missä viesti näytetään.

Komponentin omien esitystapojen selkeyttäminen vähentäisi tällaisia ohituksia.
Nykyisen suuren `components.css`:n jakaminen voi auttaa ylläpitoa, mutta
kahden tyylimekanismin olemassaolo ei yksin osoita, että toinen täytyy poistaa.
Siivousta voi tehdä sovituksen mukana. Muutamat testit, labin snapshot ja
`App.tsx`:n fokuspalautus käyttävät `.ah-*`-valitsimia; niiden viittaukset on
huomioitava rakennetta muutettaessa.

## Komponentit ja näkymät

Kartta kokoaa keskeiset sovitustarpeet. Uuden komponentin tarve ratkaistaan
sen perusteella, mikä rakenne tai käytös todella toistuu.

| Alue | Nykyinen pohja | Sovitustarve |
| --- | --- | --- |
| Sovelluskehys | `AppShell`, `ConnectionBanner` | Keskustelun korkeus ja vieritys, yläpalkki, kirjoituskenttä ja katkosbanneri. |
| Sivupalkki ja tilivalikko | `WorkspaceRail`, `WorkspaceSection`, `AgentNavItem`, `AccountShelf`, `Menu` | Tiiviit rivit, suljettu ikonikaista ja tilivalikon laukaisin. Nimen ja sähköpostin lähde seuraa tilinäyttöpäätöstä. |
| Keskustelun otsikko ja viestit | `AgentHeader`, `AgentFacts`, `Message`, `UserMessage`, `AssistantMessage` | Otsikon, Tiedot-paneelin, puhujatunnisteiden, kopioinnin ja viestien asettelu. Koko otsikko säilyy luettavana. |
| Työkalut ja eteneminen | `ToolGroup`, `ToolRow`, `Disclosure`, `WorkingProgress` | Yhteinen tilasanasto, työkalurivien mitoitus ja valmistuneen vuoron esitys. |
| Kirjoittaminen ja lähetyksen tulos | `Composer`, `QueuePanel`, `UncertainCommandCard`, `ConversationTimeline`, `HistoryView` | Ohjaa- ja Lähetä-painikkeet, epävarmuuden sijainti, viimeisimpään siirtyminen ja vain luku -selite. Luonnoksen ja lukukohdan säilyminen perustuu aiempiin päätöksiin. |
| Paluunäkymä | `App.tsx`:n `ah-continue` | Keskustelulistan esitys ja todellinen käynnissä-tieto; nykyinen `activityLabel` on tyhjä. |
| Asetukset | `AccountSettings` | Osioiden sommittelu sekä Pi:n todelliseen tilaan perustuva yhteysrivi. |
| Onboarding | `LoginCard`, `GitHubRepoChooser`, `PiDeviceSignIn` | Yhteinen kehys, vaiheilmaisin, reporivit, koodin esitys ja keskeytysvahvistus. Epävarma haun tulos säilyy näkyvänä. |
| Puhelin | Kapeassa näkymässä pinottu sivupalkki | Designin valikkolaatikko ja koko näkymän sovitus, jos mobiili otetaan toteutuslaajuuteen. |

## Eteneminen ja avoimet valinnat

Ensimmäinen toteutuskokonaisuus kannattaa valita niin, että yhteisiä
mitoituksia, painikkeita ja asettelua kokeillaan valmiissa näkymässä.
Keskustelu paljastaisi useimmat tässä havaitut ongelmat. Toimiva sovitus
antaa näyttöä siitä, mitkä ratkaisut kannattaa jakaa muille näkymille.
Kaiken tyylisiivouksen valmistuminen ei ole tämän edellytys.

Viipaleen yhteiset osat (tokenit, painike, tilamerkki, ikonit, kehys) ovat
kaikkien näkymien yhteisiä, joten sivupalkin ja onboardingin sovitus odottaa
sen valmistumista. Jotta viipale ei valmistu näkymäkohtaisina ohituksina,
sen hyväksymisehdoiksi kannattaa ottaa nämä, riippumatta siitä, miten ne
toteutetaan:

- Viipaleen näkymässä fonttikoot, välit ja layout-mitat tulevat yhteisistä
  arvoista, ja yhden arvon muutos näkyy näkymän kaikissa käyttöpaikoissa.
- Painikkeen ulkoasu ei riipu esi-isävalitsimesta, ja estetty painike on
  luettava molemmissa teemoissa.
- Tilamerkin sanasto (käynnissä, vain luku, ✓, ✕, ?, pilleri) tulee yhdestä
  komponentista.
- Ikonit eivät riipu järjestelmäfontista.
- Näkymän asettelu (yläpalkki, viestivirta, kirjoituskenttä) on
  komponenttikirjaston osa, ei sovelluskerroksen inline-tyyliä.
- Uusilla ja muuttuneilla komponenteilla on story molemmissa teemoissa.

Keskustelun sovitus kuuluu [complete-conversation-ui](../complete-conversation-ui/item.md)
-työhön ja onboarding [design-first-use-onboarding](../design-first-use-onboarding/item.md)
-työhön. Sivupalkin ja asetusten työnjako sekä yhteisen pohjatyön mahdollinen
oma issue täsmennetään toteutusta suunniteltaessa. Jaetut tiedostot, kuten
`App.tsx` ja komponenttityylit, vaikuttavat siihen, mitä voi tehdä rinnakkain.

Paluunäkymän käynnissä-tieto tarvitsee hostin todellisen tilan.
[Agenttiohjaustyö](../build-agent-control/item.md) määrittää ohjauksen kyvyt,
ja [tilinäyttöpäätös](../decide-account-display/item.md) nimen ja sähköpostin
esityksen. Reitin yhdistäminen ja projektin uudelleennimeäminen ovat erillisiä
kysymyksiä; niitä ei tarvitse ratkaista tämän arvion perusteella.

Kolme valintaa on edelleen avoinna Jarille:

- **Mobiilin toteutuslaajuus.** Aiempi rajaus koskee työpöytää. Puhelinvedos
  ei yksin muuta sitä. Suosittelen ottamaan puhelinsovituksen mukaan, mutta
  sen työmäärä arvioidaan koko näkymän ja vuorovaikutuksen perusteella.
- **Repohaun oletussuodatin.** Suosittelen kaikkia repoja aluksi näkyviin ja
  aikarajausta käyttäjän valintana, jotta tarpeellinen vanha repo ei katoa.
- **V2:n mitoitus tokenien lähteeksi.** `production-v1.md` pitää vedosten
  mittoja sommittelureferensseinä; v2-handoff ilmoittaa mitoituksensa
  lopulliseksi. Suosittelen ottamaan v2:n mitoitustaulukon yhteisten arvojen
  lähteeksi ja päivittämään tuon lauseen. Tämä on design systemin kaanonin
  muutos, joten se on Jarin päätös.

## Miten vastaavuus todetaan

Toteutuksen ja vedoksen samoja tiloja verrataan rinnakkain synteettisessä
labissa. Vertailuun kuuluvat sommittelu, mitoitus ja vuorovaikutustilat,
molemmat teemat sekä toteutuslaajuuteen kuuluvat näyttöleveydet. Yhteisen
mitan tai komponentin muutoksen pitää näkyä johdonmukaisesti sen eri
käyttöpaikoissa. Storybook auttaa tarkastamaan nämä yhdistelmät.

Ehdotus on kolme kerrosta, kevyimmästä raskaimpaan; laajuus valitaan
toteutuksessa:

1. **Mittaväitteet gatessa.** Selaintesti lukee labin näkymästä
   maamerkkielementtien lasketut tyylit (sivupalkin leveydet, yläpalkin
   täyte, sarakkeen leveys, tekstikoot, pyöristykset, fokusrengas) ja vertaa
   niitä handoffin mitoitustaulukkoon. Deterministinen ja paljastaa yhteisen
   arvon karkaamisen heti.
2. **Parikuvat katselmointiin.** Jokaisesta designin tilasta labin näkymä ja
   vedoksen sama tila rinnakkain issuekansiossa. Vedoksen fonttipyynnöt
   ohjataan paketoituihin fontteihin, jotta vertailu ei riipu CDN:stä.
   Pikselivertailua vedokseen ei tehdä, koska aineisto eroaa tarkoituksella.
3. **Baseline hyväksynnän jälkeen.** Hyväksytystä näkymästä tallennetaan
   kuvabaseline tilaa ja teemaa kohti, jotta myöhempi yhteinen muutos
   näyttää jalanjälkensä. Baseline päivitetään samassa commitissa muutoksen
   kanssa. Rooliin ja nimeen perustuvat toimintatestit
sekä saavutettavuuden, zoomin ja reduced motion -asetuksen tarkistukset
antavat täydentävää näyttöä. [TESTING.md](../../TESTING.md) kertoo, mitä eri
kokeet osoittavat.

## Arvion näyttö ja rajat

Alkuperäinen arvio perustui tokeneihin, tuotantokomponentteihin ja niiden
CSS:ään, sovelluskerroksen näkymäkoostumuksiin, Storybookin ja labin
välineisiin, testeihin sekä v2-handoffiin ja vedoksiin. Lukumäärät kuvaavat
revisiota `82a5c4e`.

Kuvaesimerkkeinä olivat aiemmat synteettiset lab-näkymät
[työn aikana](../complete-conversation-ui/working-after.png),
[lukunäkymästä](../complete-conversation-ui/reading-desktop.png),
[etusivulta](../extremely-impartial-spiders/round4-after-home.png),
[GitHub-vaiheesta](../extremely-impartial-spiders/round4-after-github.png) ja
[tummista asetuksista](../extremely-impartial-spiders/dark-settings.png).
Uusia kuvia, selaintestejä tai gatea ei ajettu tätä arviota varten.
Havainnot perustelevat sovitustyötä; ne eivät ole valmiin UI:n visuaalinen
hyväksyntä tai kattava toiminnallinen tarkistus.
