# Henkilön poisto – ylläpitäjän poistokulku

Issue `person-removal` (Jari 21.11.2026: oikea henkilön poisto). Kierros
noudattaa ADR 0037:ää (`docs/decisions/adr-0037-person-removal.md`, ehdotus).
Suunnat, suositus ja kysymykset Jarille ovat issuen `result-ui.md`:ssä.

Akseli: **milloin kotihakemisto poistetaan ja mistä poisto alkaa**.
Kaikissa suunnissa on sama ADR:n mukainen poistoikkuna. Se kertoo
seuraukset henkilön kannalta: pääsy ja uloskirjaus, palvelut, jaetut
linkit sekä kotihakemiston koko ja poistohetki. Ikkuna ei kerro mitään
kodin sisällöstä, ja vahvistus tehdään kirjoittamalla GitHub-tunnus.

- **1 Armonaika** (ADR:n suositus): Poista henkilö -painike on rivillä Poista
  pääsy -painikkeen vieressä. Ikkunassa valitaan, poistetaanko 14 päivän
  päästä vai heti. Rivillä näkyy `Poistetaan 5.12.`, jäljellä olevat
  päivät ja Peru poisto molemmissa näkymissä. Peruminen jättää pääsyn
  poistetuksi (`Ei pääsyä`).
- **2 Heti**: armonaikaa ei ole. Vahvistuksen jälkeen poisto etenee
  ikkunassa vaihe vaiheelta, eikä sitä voi perua.
- **3 Vaiheittain**: aktiivisella rivillä on vain tuttu Poista pääsy.
  Vasta `Ei pääsyä` -rivillä on Poista henkilö, joka ajastaa poiston 14
  päivän päähän.

Oletusnäkymä on Käyttäjät ja pääsy, ja suunnan ensimmäinen ikkuna on
auki henkilölle @mikko-l (suunnissa 1 ja 2 poisto, suunnassa 3 pääsyn
poisto). Kun ikkunan sulkee, näkyy lista. Levytila on palvelinalueen
navigaatiossa.

Sivu koostuu tuotannon osista: palvelinalueen kehys (`Settings.css`,
`s-page s-server-area`, osioiden nimet `settingsIndex`istä),
`ServerSection`in kortit, `PeopleList`/`PeopleRow`, `StatusMark`,
`Segmented`-suodatin, `SectionMeter` rajojen summalla, `SectionNumber`,
`UsageFigure`, `LimitReset` ja `NumberStepper`, käyttäjälistan omat
luokat (`ServerAccess.css`) ja tuotannon dialogi (react-aria
`ModalOverlay` sekä `.ah-dialog` ja `.sa-consequences`). Pääsyn poiston
ikkuna käyttää tuotannon sanoja. Käyttäjälista on koottu näistä osista eikä
`ServerAccess`-komponentista, koska se omistaa rivien toiminnot ja
`RemoveDialog`in. Lisäyskenttä ja tiimit puuttuvat siksi listan yläpuolelta.

Kierroksen omat osat ovat poistoikkuna, vaiheet riveillä, poiston
eteneminen ja Poistettu-rivin palvelulaskurit (ADR:n kohta 4: vain
määrät, ei nimiä).

Maailma on la 21.11.2026 klo 10.00. Levy 120 GiB. Henkilöt: aino-k
(ylläpitäjä, sinä: ei poistopainiketta), mikko-l (40 GiB raja, 14,2 GiB
käytössä), sanna-v (`Ei pääsyä` 3.11. alkaen), olli-p ja tuuli-r. Rajojen
summa on 128,5 GiB (ylivaraus), poiston alettua 102,7 GiB ja poiston
jälkeen 88,5 GiB. Henkilö lasketaan käyttönsä mukaan heti, kun pääsy on
poistettu (ADR:n kohta 7).

Katselmoinnin työkalurivi: `+1 pv`, `+14 pv` (eräpäivä tulee, ja palvelin
aloittaa poiston itse), `Seuraava poisto keskeytyy` ja Alkutila. Keskeytys
tapahtuu kohdassa, jossa levytila todetaan vapaaksi (`files_remain`), ja
jättää 0,3 GiB. Yritä nyt jatkaa siitä. `?theme=light|dark|contrast`,
`?lang=en`, `?view=levy`, `?ask=none` ja `?fail=1` valitsevat alkutilan.
Tuotannon dialogi tekee muun sivun inertiksi. Valitsin pidetään silti
käytössä, mutta teema ja kieli vaihtuvat vasta, kun ikkuna on kiinni.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-21-person-removal/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-21-person-removal/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`<out>`:n oletus on `design-system/prototypes/dist/person-removal`.
`web/node_modules`in pitää vastata lukitustiedostoa (`npm ci --prefix web`).
Tarkistus: 491 tarkistusta ja puhdas konsoli. Ne ajetaan 1440 ja 390 px
leveydellä Päivä-, Yö- ja Kontrasti-teemoissa (kulut Päivässä ja Yössä).
Englanti tarkistetaan työpöydällä ja puhelimessa.
