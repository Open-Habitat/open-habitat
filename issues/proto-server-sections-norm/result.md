# Kierros 1: kaikki palvelinosiot yhdellä normilla

Kierros: `design-system/prototypes/rounds/2026-11-07-palvelinosioiden-normi/`
(NOTES.md kertoo nykytilan inventaarion, suunnat ja vuorovaikutukset).
Akseli: minkä osion komponenttinormin mukaan kaikki palvelinosiot
piirretään. Oletusnäkymä näyttää kaikki kahdeksan palvelinosiota
rinnakkain (Keskustelut ja Levytila ensimmäisinä vierekkäin), ja jokaisen
alla on sen komponenttilista; suunnissa sivun yläosassa on lista jaetuista
osista, joista uusi osio (esim. Levyt) kootaan.

- **Nyt**: tuotannon kahdeksan osiota muuttamattomina; Keskustelut käyttää mittaria, steppereitä ja henkilörivejä, Levytila taulukkoa, ohutta palkkia ja Raja…-painiketta.
- **A Keskustelut**: jokainen osio on johdanto, kortti nimi–selite–arvo-riveistä, paksu mittari selitteineen ja henkilölista, jossa kullakin rivillä on oma säädin; luvut stepperillä, poikkeus Oletukseen-painikkeella.
- **B Levytila**: jokainen osio on yksi kortti arvoriveistä ja taulukko otsikkosarakkeineen; mittarina ohut palkki lukujen alla, muutos rivin Muuta…-painikkeesta avautuvaan kenttään.
- **C Yhdistelmä**: Keskustelujen rivit, mittari ja henkilölista, mutta mittarin otsikon vieressä luvut ja listan yllä sarakeotsikot; henkilön lukema (esim. 14,2 GiB / 40 GiB ohuella palkilla) omassa sarakkeessaan, raja stepperillä.

## Mitä inventaario näytti

Palvelinalueella on kahdeksan osiota, ja henkilölista on tehty neljällä
tavalla: Keskusteluissa lista steppereineen, Levytilassa taulukko,
Käyttäjissä painikerivit ja AI-avaimessa päivämäärärivit. Johdanto on
kolmessa osiossa kortin yllä, kahdessa (AI-avain, Integraatiot) kortin
sisällä ja kolmessa puuttuu. Levytilassa oma raja ja oletusraja eivät erotu
toisistaan, ja rajojen summa näkyy vain lauseena. Palvelinalueella taulukko
on vain Levytilassa. Käyttöönoton reittieditori on oma kaksipalstainen
työkalunsa, ei asetuslista; se on kaikissa suunnissa ennallaan.

## Jaetut osat uudelle osiolle

Suunnat kirjoittavat jokaisen osion samoista osista (`norm.tsx`), ja normi
päättää vain niiden ulkoasun. Uusi palvelinosio, kuten Levyt, kootaan niistä:

1. **Johdanto** (`s-intro`): A, C kortin yllä; B ensimmäisen rivin selitteessä.
2. **Kortti ja rivit** (`s-card`, `s-row`: nimi, selite, arvo oikealla): sama kaikissa.
3. **Mittari**: A paksu kaksivärinen palkki ja selite; B luvut ja ohut palkki (`s-bar`); C luvut otsikon vieressä, paksu palkki ja selite.
4. **Luku**: A, C `NumberStepper`; B `InlineTextSetting` yksikön kanssa.
5. **Väliotsikko** (`s-h3`) ja oma kortti: A, C; B:ssä taulukko samassa kortissa.
6. **Henkilö- tai rivilista**: A nimi + selite + rivin säädin; B `s-table`; C sama lista sarakeotsikoin ja lukema-sarakkein.

Osat ovat tuotannon komponentteja ja luokkia. Uutta on vain jaettu
henkilölista: A:ssa se on Keskustelujen nykyinen lista (`ah-live-people`)
yleistettynä, C:ssä sama lista sarakeotsikoin ja lukema-sarakkein.
Toteutuksessa normi olisi yksi jaettu henkilölista ja yksi mittari
`ServerConversations.css`:n nykyisistä luokista.

## Suositus

**C Yhdistelmä.** Se on Keskustelujen ilme, jota Jari piti hiottuna, mutta
säilyttää Levytilan ainoan hyödyllisen asian: henkilön käytön palkkina, josta
näkee heti, että Anna on lähes rajalla. A kirjoittaa käytön selitteeseen,
jolloin sen huomaa vain lukemalla. B tekee kaikista osioista lomakkeen
taulukkoja; muutos vaatii kaksi painallusta ja kentän, ja Keskustelujen
mittari kutistuu ohueksi viivaksi. C:n sarakeotsikot ja lukema-sarake
sopivat samalla Käyttäjiin (rooli), AI-avaimeen (avain) ja Integraatioihin
(tila), joten listoja on yksi neljän sijaan.

## Host-tiedot

Näkymä lukee vain nykyisiä reittejä: `/api/v1/server/conversations`
(muisti, rajat, poikkeukset), `/api/v1/server/storage` (levy, käyttö ja raja
henkilöittäin), `/api/v1/server/administration` (oletusraja, nimi, kieli) ja
osioiden omat reitit. Levytilan mittarin "jos jokainen täyttää rajansa" on
henkilöiden `limit_bytes`-summa, joka tulee samasta vastauksesta.

## Decisions for later review

- **Levyn oma raja vai oletus.** Storage-vastaus kertoo jokaisen
  henkilön rajan, mutta ei sitä, onko se oma vai oletus; oletusraja koskee
  vain uusia käyttäjiä. Kierros merkitsee rajan omaksi, kun se poikkeaa
  oletusrajasta, ja *Oletukseen* asettaa henkilön rajaksi nykyisen
  oletusrajan. Vaihtoehto on hostin muutos, jossa levyraja seuraa oletusta
  kuten keskusteluraja (kysymys 2).
- **Levyrajan askel 5 GiB.** Stepperin askel levyllä; kenttään voi
  kirjoittaa minkä tahansa kokonaisluvun.
- **Yksinkertaistukset suunnissa.** Saneluavaimen merkitty rivi,
  Käyttäjien suodatinvälilehdet ja Integraatioiden tasorivit on piirretty
  suunnissa tavallisiksi riveiksi; ne eivät ole normin ehdotus poistaa niitä.

## Kysymykset Jarille

1. Mikä normi: A, B vai C (suositus C)?
2. Seuraako levyraja oletusta kuten keskusteluraja (henkilöllä joko oma raja
   tai oletus, ja oletuksen muutos koskee kaikkia ilman omaa rajaa)? Se
   vaatisi hostin muutoksen; muuten *Oletukseen* tarkoittaa levyllä "aseta
   nykyinen oletusarvo".
3. Koskeeko normi myös Käyttäjien, AI-avaimen ja Integraatioiden listoja (yksi
   lista kaikkialla), vai vain osioita, joissa on rajoja?

## Todisteet

`evidence/r1-<suunta>-<vaihe>-<leveys>-<teema>.avif`: jokaisesta suunnasta
oletusnäkymä (`0-oletus`), työpöydällä koko sivu (`1-koko`), Ainon raja
muutettuna normin tavalla (`2-rajat-muutettu`) ja työpöytä vaaleana host
ilman levyrajoja (`3-ei-levyrajoja`). 1440 × 900 ja 390 × 844, vaalea ja
tumma, kerroin 2. `check.mjs`: 240 tarkistuspistettä, konsoli puhdas.
Kyse on synteettisestä komponenttilabrasta; sitä ei ole ajettu hostia
vasten.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-07-palvelinosioiden-normi/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/palvelinosioiden-normi/offline.html \
  --title "Palvelinosioiden normi – kierros 1" \
  --idempotency-key "$(uuidgen)" --json
```
