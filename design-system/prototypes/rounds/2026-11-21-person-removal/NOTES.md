# Henkilön poisto – ylläpitäjän poistokulku

Issue `person-removal` (Jari 21.11.2026: oikea henkilön poisto). Suunnat,
suositus ja kysymykset Jarille ovat issuen `result-ui.md`:ssä.

Akseli: **milloin tiedot katoavat ja miten poisto varmistetaan**.

- **1 Armonaika**: pääsy loppuu heti, tiedot poistetaan 7 päivän päästä.
  Rivillä näkyy `Poistetaan 7 pv päästä` ja Peru poisto molemmissa
  näkymissä. Yksi vahvistus, koska poiston voi perua.
- **2 Luettelo**: ikkuna luettelee tarkalleen, mitä poistetaan (koti
  polkuineen ja kokoineen, työtilat nimiltä, keskustelut ja käynnissä
  olevat, yhdistetyt tilit, julkaistut linkit, Unix-tili). Kaksi
  painallusta (Poista lopullisesti → Vahvista poisto) poistaa heti, ja
  eteneminen näkyy ikkunassa. Ei peruutusta. Poista vain pääsy jää
  ikkunaan sivupoluksi.
- **3 Arkisto**: ennen poistoa kotihakemistosta tehdään arkisto
  palvelimelle (polku näkyy, vain palvelimen ylläpitäjä pääsee siihen
  komentorivillä, säilyy 30 pv). Poisto etenee rivillä, ja poistetulla
  rivillä on Palauta arkistosta. Ilman arkistoa poisto kysyy kahdesti.

Oletusnäkymä on Käyttäjät ja pääsy, jonka päällä on suunnan oma vahvistus
henkilölle @mikko-l. Suunnat eroavat juuri siinä. Kun ikkunan sulkee,
näkyy lista. Levytila on palvelinalueen navigaatiossa.

Sivu koostuu tuotannon osista: palvelinalueen kehys (`Settings.css`,
`s-page s-server-area`, osioiden nimet `settingsIndex`istä),
`ServerSection`in kortit, `PeopleList`/`PeopleRow`, `StatusMark`,
`Segmented`-suodatin, `SectionMeter` rajojen summalla, `SectionNumber`,
`UsageFigure`, `LimitReset` ja `NumberStepper`, käyttäjälistan omat
luokat (`ServerAccess.css`) ja tuotannon dialogi (react-aria
`ModalOverlay` sekä `.ah-dialog` ja `.sa-consequences`). Tuotannon sanat
tulevat tuotannon katalogeista. Käyttäjälista on koottu näistä osista eikä
`ServerAccess`-komponentista, koska se omistaa rivien toiminnot ja
`RemoveDialog`in. Lisäyskenttä ja tiimit puuttuvat siksi listan yläpuolelta.

Kierroksen omat osat ovat vaiheet riveillä, kolme vahvistusta,
poiston eteneminen vaiheittain ja suunnan 3 Arkistot-rivi Levytilassa.

Kaikille suunnille yhteinen ratkaisu: henkilö, jolla ei ole pääsyä
(myös armonajalla tai kesken jääneessä poistossa), lasketaan rajojen
summaan käyttönsä mukaan eikä rajansa mukaan. Raja näkyy yliviivattuna.

Maailma on la 21.11.2026 klo 10.00. Levy 120 GiB. Henkilöt: aino-k
(ylläpitäjä, sinä), mikko-l (poistettava: 40 GiB raja, 14,2 GiB käytössä,
4 työtilaa, 37 keskustelua joista 2 käynnissä, GitHub ja Google, 3
linkkiä), sanna-v (`Ei pääsyä` 3.11. alkaen, vanha pääsyn poisto), olli-p ja
tuuli-r. Rajojen summa on 128,5 GiB (ylivaraus), armonajalla 102,7 GiB ja
poiston jälkeen 88,5 GiB.

Katselmoinnin työkalurivi: `+1 pv`, `+7 pv` (armonaika päättyy ja poisto
käynnistyy), `Seuraava poisto keskeytyy` (kotihakemiston poisto keskeytyy
kerran, Yritä uudelleen jatkaa) ja Alkutila. `?theme=light|dark|contrast`,
`?lang=en`, `?view=levy`, `?ask=none` ja `?fail=1` valitsevat alkutilan. Tuotannon dialogi
tekee muun sivun inertiksi. Valitsin pidetään silti käytössä, mutta
teema ja kieli vaihtuvat vasta, kun ikkuna on kiinni.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-21-person-removal/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-21-person-removal/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`<out>`:n oletus on `design-system/prototypes/dist/person-removal`.
`web/node_modules`in pitää vastata lukitustiedostoa (`npm ci --prefix web`).
Tarkistus: 395 tarkistusta ja puhdas konsoli. Ne ajetaan 1440 ja 390 px
leveydellä Päivä-, Yö- ja Kontrasti-teemoissa (kulut Päivässä ja Yössä).
Englanti tarkistetaan työpöydällä ja puhelimessa.
