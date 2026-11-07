# Tulos: palvelinosiot normilla C

Kaikki palvelinalueen osiot on piirretty jaetuista osista
(`web/src/components/ServerSection.tsx`): johdanto kortin yllä
(`SectionLead`), kortti ja rivit (`SectionCard`, `SectionRow`), mittari luvut
otsikon vieressä, paksu palkki ja selite (`SectionMeter`), luku stepperillä
(`SectionNumber`), väliotsikko (`SectionSubhead`), henkilö- tai palvelulista
sarakeotsikoin ja lukemasarakkein (`PeopleList`, `PeopleRow`), henkilön
käyttö ohuella palkilla (`UsageFigure`), *Oletukseen* (`LimitReset`) ja
tallennuksen tila (`SectionStatus`). Storybookissa ne ovat kohdassa
*Settings/Palvelinosion osat*.

- **Keskustelut**: ennallaan rakenteeltaan; luvut (yhteensä · vapaana) nyt
  mittarin otsikon vieressä, henkilölistalla sarakeotsikot.
- **Levytila**: oma komponentti `app/ServerStorage.tsx`. Levy on sama mittari
  kuin Muisti (käytössä nyt ja rajojen summa), oletusraja ja jokaisen raja
  ovat steppereitä (5 GiB askel), henkilön käyttö omassa sarakkeessaan, ja
  muutos tallentuu hetken päästä viimeisestä painalluksesta kuten
  Keskusteluissa (`app/settledChanges.ts`, molemmat käyttävät samaa).
  Taulukko, *Raja…*-painike ja erillinen tallennuslomake poistuivat.
- **Yleiset**: johdanto kortin yllä.
- **Käyttäjät ja pääsy**: johdanto; ensimmäisessä kortissa lisäys, tiimit
  ja Jaetut linkit; väliotsikko *Henkilöt N* ja sen vieressä
  suodatinvälilehdet; henkilöt listana, Rooli omassa sarakkeessaan,
  painikkeet rivin lopussa.
- **AI-avain**: ehdot johdantona kortin yllä; Jo liittyneet -kortin lista on
  sama lista sarakkeella *Avain*.
- **Saneluavain**: johdanto ja kortti jaetuin osin (ennallaan näköisenä).
- **Integraatiot**: johdanto kortin yllä; palvelut samana listana
  sarakkeella *Tila*, tasorivit sisennettyinä.
- **Käyttöönotto**: reittieditori ennallaan (oma työkalunsa, ei asetuslista).

Hostiin, sopimukseen ja auktoriteettipolkuihin ei koskettu: osiot lukevat ja
kirjoittavat samoja reittejä samoin mutaatioluokin.

## Kapea ruutu

Asetusruutu on työpöydälläkin vain noin 440 px leveä sivupalkkien välissä,
joten lista sopeutuu säiliönsä leveyteen eikä ikkunan:

- yhdelle riville mahtuessaan kaikki sarakkeet rinnakkain otsikoiden alla;
- kapeampana (alle 560 px, tiiviillä listalla alle 380 px) viimeinen
  sarake jää nimen viereen ja muut sen alle; otsikoista näkyvät nimen ja
  viereisen sarakkeen;
- toimintolistassa (Käyttäjät, Integraatiot) toiminto jää nimen viereen ja
  tila sen alle ilman otsikkoriviä, puhelimessa toiminto omalle rivilleen.

## Decisions for later review

- **Levyn oma raja vai oletus.** Host pitää jokaisella henkilöllä yhden
  levyrajan, ja oletusraja koskee vain uusia käyttäjiä. Raja näytetään
  omana, kun se poikkeaa nykyisestä oletusrajasta, ja *Oletukseen* asettaa
  henkilölle nykyisen oletusrajan. Vaihtoehto: hostin muutos, jossa levyraja
  seuraa oletusta kuten keskusteluraja (prototyypin kysymys 2, vastaamatta).
  Seuraus nykyisestä: kun oletusrajaa muuttaa, entisellä oletuksella olevat
  näkyvät *oma raja*, koska heidän rajansa ei muutu.
- **Levyraja kokonaisina gibitavuina, askel 5 GiB.** Stepper hyväksyy vain
  kokonaisluvun; aiempi tekstikenttä hyväksyi desimaalit (8,5 GiB). Olemassa
  oleva murtoluku näkyy sellaisenaan. Vaihtoehto: desimaalistepper tai
  tekstikenttä yksikön kanssa (normi B), jonka Jari hylkäsi.
- **Stepperin pilkku.** `NumberStepper` luki pilkun tuhaterottimeksi, joten
  levyrajaksi kirjoitettu *9,5* olisi ollut 95 GiB. Nyt vain kolmen numeron
  ryhmät (16,000) ovat tuhaterottimia ja muu pilkku desimaalipilkku
  (9,5 → 10). Koskee kaikkia steppereitä.
- **AI-avaimen Jo liittyneet pysyy omana korttinaan.** Kortin ensimmäinen
  rivi (selite ja *Anna avain liittyneille…*) toimii väliotsikkona, ja lista
  on sen alla samassa kortissa. Prototyyppi siirsi rivin avainkorttiin ja
  listan väliotsikon alle; avaimen editori on käyttöönoton kanssa yhteinen,
  joten sen korttia ei pilkottu. Avaimen editori näkyy siksi ennallaan.
- **Toimintolistojen otsikot kapeassa ruudussa.** Käyttäjien ja
  Integraatioiden listoissa sarakeotsikot näkyvät vasta, kun rivi mahtuu
  yhdelle riville (noin 560 px lista); 1440 px ikkunassa sivupalkkien kanssa
  niitä ei siksi näy. Otsikko ei seisoisi sarakkeensa yllä, kun tila on
  nimen alla. Vaihtoehto: otsikot aina ja toiminto jokaisen rivin alla,
  jolloin lista kaksinkertaistuu korkeudeltaan.
- **Suodatinvälilehdet ja tasorivit säilyivät.** Prototyyppi piirsi ne
  yksinkertaistettuina; toteutus pitää Käyttäjien suodattimet (väliotsikon
  vieressä) ja Integraatioiden tasorivit (sisennettyinä).

## Todisteet

`evidence/<osio>-<leveys>-<teema>.avif`: jokainen osio 1440 ja 390 px
leveänä, vaalea ja tumma, kerroin 2, synteettisestä labista
(`web/lab/server-sections-norm.mjs`; Bobilla oma keskustelu- ja levyraja).
Vaalean kuvan pari on `evidence/<osio>-<leveys>-light.html`; tumman kuvan
DOM on sama, joten sille ei tallennettu omaa HTML:ää. Kuvat on muunnettu
AVIF:ksi koon vuoksi.

Tarkistukset: `npm run typecheck`, `npm run check`, koko `vitest` (1383),
selaintestit `account-settings`, `settings-name-and-storage`,
`server-integrations`, `server-access`, `live-conversation-limit`,
`site-ai-key`, `view-links`, `server-settings-area`, `settings-search` ja
`speech-input` (`OH_PORT_BASE=16700`, kaksi workeria). Katselmointi:
kohdennettu itsekatselmointi (vain selaimen esitys; host, sopimus ja
auktoriteettipolut ennallaan).
