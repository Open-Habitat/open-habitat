# Palvelinosioiden normi – kierros 1

Issue `proto-server-sections-norm`. Jari 7.11.2026 testikoneella:
palvelimen asetusten *Keskustelut*- ja *Levytila*-näkymien pitää käyttää
samannäköisiä komponentteja. Keskustelut on hiottu, Levytila rujo. Uusi
palvelinosio, kuten levyt, tehdään jatkossa samalla mallilla.

Sivu näyttää kaikki kahdeksan palvelinosiota rinnakkain yhdellä sivulla
(työpöydällä kaksi palstaa, Keskustelut ja Levytila ensimmäisinä vierekkäin,
puhelimessa yksi palsta). Jokaisen osion alla on lista sen komponenteista.
*Nyt* piirtää tuotannon osiot muuttamattomina (`AccountSettings` yksi osio
kerrallaan, oma lista piilossa). Suunnat piirtävät jokaisen osion samoista
jaetuista osista (`norm.tsx`), joiden ulkoasun normi päättää. Suuntien
yläosassa on lista osista, joista uusi palvelinosio (esim. Levyt) kootaan.
Kaikki suunnat käyttävät tuotannon luokkia ja komponentteja: `s-card`,
`s-row`, `s-intro`, `s-h3`, `s-table`, `s-bar`, Keskustelujen mittariluokat,
`NumberStepper`, `InlineTextSetting`, `StatusMark`, `LetterMark`,
`ServerLanguageRow`, `ServerVersionRow` ja `ControlButton`.

Hostin paikalla on `fetch`-sijainen `contracts/v1/examples`-esimerkeistä:
Contoso, kuusi henkilöä (yksi ei vielä kirjautunut), 500 GiB levy, 32 GiB
muistia, Ainolla oma levyraja 40 GiB ja keskusteluraja 6, Mikolla
keskusteluraja 2. Kirjoitukset muuttavat samaa tilaa, joten stepperit ja
kentät toimivat. Yläpalkin *Levyrajat* vaihtaa hostin tilaan, jossa
käyttäjäkohtaisia rajoja ei ole. Kaikki on synteettistä.

## Suunnat

Akseli: minkä osion komponenttinormin mukaan kaikki palvelinosiot
piirretään.

- **Nyt**: tuotannon kahdeksan osiota muuttamattomina; Keskustelut käyttää mittaria, steppereitä ja henkilörivejä, Levytila taulukkoa, ohutta palkkia ja Raja…-painiketta.
- **A Keskustelut**: jokainen osio on johdanto, kortti nimi–selite–arvo-riveistä, paksu mittari selitteineen ja henkilölista, jossa kullakin rivillä on oma säädin; luvut stepperillä, poikkeus Oletukseen-painikkeella.
- **B Levytila**: jokainen osio on yksi kortti arvoriveistä ja taulukko otsikkosarakkeineen; mittarina ohut palkki lukujen alla, muutos rivin Muuta…-painikkeesta avautuvaan kenttään.
- **C Yhdistelmä**: Keskustelujen rivit, mittari ja henkilölista, mutta mittarin otsikon vieressä luvut ja listan yllä sarakeotsikot; henkilön lukema (esim. 14,2 GiB / 40 GiB ohuella palkilla) omassa sarakkeessaan, raja stepperillä.

## Nykytila: osiot ja komponentit

| Osio | Johdanto | Rakenne | Luvut ja mittarit | Henkilöt / rivit |
|---|---|---|---|---|
| Keskustelut | kortin yllä | kortti + väliotsikko HENKILÖT + toinen kortti | 12 px kaksivärinen mittari, selite värineliöin; stepper | nimi + oletus/oma raja, stepper, Oletukseen |
| Levytila | ei | yksi kortti, taulukko sisällä | luvut tekstinä + 6 px palkki; oletusraja tekstikenttänä | taulukko Käyttäjä · Tallennustila · Toiminnot, Raja… avaa kentän; oma raja ja oletus eivät erotu |
| Yleiset | ei | yksi kortti | – | nimi kenttänä, kieli valintana, versio |
| Käyttäjät ja pääsy | ei | yksi kortti, Henkilöt-otsikko ja suodatinvälilehdet sisällä | – | @tunnus + tilamerkki, Unix-rivi, painikkeet |
| AI-avain | kortin sisällä | kaksi korttia, toisen otsikko rivinä | – | @tunnus, Unix-nimi, päivämäärä oikealla |
| Saneluavain | kortin yllä | kortti, merkitty rivi kuvakkeella | – | – |
| Integraatiot | kortin sisällä | yksi kortti | – | kirjainmerkki, nimi, tila, Tunnukset; tasorivit sisennettyinä |
| Käyttöönotto | kortin yllä | leveä kaksipalstainen editori | – | oma reittieditori |

Sama asia on siis tehty neljällä tavalla: henkilölista on Keskusteluissa
lista steppereineen, Levytilassa taulukko, Käyttäjissä painikerivit ja
AI-avaimessa päivämäärärivit. Johdanto on kolmessa osiossa kortin yllä,
kahdessa kortin sisällä ja kolmessa puuttuu.

## Mitä kussakin näkyy

- **A.** Levytila näyttää samalta kuin Keskustelut: johdanto, Levy-mittari
  (käytössä nyt 80 GiB, jos jokainen täyttää rajansa 120 GiB), oletusraja
  stepperinä 5 GiB:n askelin ja henkilölista, jossa käyttö on selitteessä
  (*oma raja · 14,2 GiB käytössä*) ja raja stepperinä. Käyttäjät, AI-avain
  ja Integraatiot käyttävät samaa listaa: tila kirjoitetaan selitteeseen,
  painikkeet rivin oikeaan reunaan. Henkilökohtainen käyttöpalkki katoaa.
- **B.** Keskustelut näyttää samalta kuin Levytila: muistin luvut tekstinä
  oikealla ja ohut palkki niiden alla, pahin tapaus selitteen lauseena,
  raja henkilöä kohden tekstikenttänä ja henkilöt taulukossa
  (*Henkilö · Raja · Toiminnot*), Muuta… avaa kentän ja Tallenna/Peruuta.
  Johdanto siirtyy ensimmäisen rivin selitteeseen. Puhelimessa taulukko
  pinoutuu soluiksi kuten tuotannon Levytila nyt.
- **C.** Keskustelujen rakenne ja paksu mittari, mutta mittarin otsikon
  vieressä on lukema (*500 GiB yhteensä · 420 GiB vapaana*), ja listan
  yllä ovat sarakeotsikot. Levytilassa henkilön käyttö on omassa
  sarakkeessaan ohuen palkin kanssa, raja stepperinä ja poikkeus
  Oletukseen-painikkeella. Käyttäjissä sarake on Rooli (tilamerkki), AI-avaimessa
  Avain, Integraatioissa Tila.

Käyttöönoton reittieditori on oma kaksipalstainen työkalunsa eikä
asetuslista; se on kaikissa suunnissa ennallaan (sen johdanto on jo kortin
yllä). Saneluavaimen merkitty rivi ja Integraatioiden tasorivit on suunnissa
yksinkertaistettu tavalliseksi riviksi ja palveluriviksi.

Kuvat: `issues/proto-server-sections-norm/evidence/r1-<suunta>-<vaihe>-<leveys>-<teema>.avif`.
Vaiheet: `0-oletus` (oletusnäkymä), `1-koko` (koko sivu, työpöytä),
`2-rajat-muutettu` (Ainon raja muutettu normin tavalla), `3-ei-levyrajoja`
(host ilman käyttäjäkohtaisia rajoja, työpöytä vaalea).

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-07-palvelinosioiden-normi/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-07-palvelinosioiden-normi/check.mjs \
  design-system/prototypes/dist/palvelinosioiden-normi/offline.html <kuvahakemisto>
```
