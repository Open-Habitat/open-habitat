# Yhteyksien ryhmittely asetuksissa · Kierros 1

Asetuksissa ulkopuoliset tilit ovat nyt kolmessa paikassa sen mukaan, miten
ne on toteutettu, ei sen mukaan, mihin niitä tarvitaan:

| Nykyinen sivu | Mitä siellä on |
| --- | --- |
| Agentit | Oletusmalli, agentin työ ja painike ”Hallitse kirjautumisia”, joka vie Yhteyksiin |
| Yhteydet | GitHub, ChatGPT (Pi), Claude-tilaus, API-avaimet |
| Integraatiot | Google, Microsoft 365, IMAP/CalDAV/CardDAV, Dropbox, iCloud **ja Gitea** |

Koodipalvelut ovat siis kahdessa paikassa, ja mallivalitsin vie Yhteyksiin,
jossa on myös GitHub. Tämä kierros vertailee kolmea ryhmittelyä. Muut osiot
(Tili, Laitteet, Ulkoasu, Editori, Tallennustila, ylläpito) pysyvät ennallaan
ja ovat mukana vain navigaatiossa. Kaikki nimet, osoitteet ja tilit ovat
keksittyjä.

## Kolme vaihtoehtoa

| Vaihtoehto | Akseli ja vahvuus | Hinta |
| --- | --- | --- |
| **1 · Kolme sivua** | Kolme rinnakkaista sivua käyttötarkoituksen mukaan: **Tekoäly** (tilaukset, avaimet, oletusmalli ja agentin työ samalla sivulla), **Koodipalvelut** (GitHub, Gitea ja niistä tuodut työtilat) ja **Tiedot agenteille** (posti, kalenterit, tiedostot). Navigaatiossa on yhtä monta kohtaa kuin nyt. Jokainen linkki muualta osuu suoraan oikealle sivulle, ja ”Hallitse kirjautumisia” -välilinkki poistuu. Henkilön sivu ei enää ole nimeltään Integraatiot, joten sekaannus ylläpidon Palvelinintegraatioihin poistuu. | Kolme sivua, joilla on samanlainen tilirivi. Virheistä kertoo vain navigaation pistemerkki, ei yhteistä yhteenvetoa. |
| **2 · Kaksi sivua** | Tekoäly yhdistetään Agentit-sivuun (**Agentit ja mallit**). Kaikki muut ulkopuoliset tilit ovat yhdellä **Yhteydet**-sivulla, väliotsikoina Koodipalvelut ja Tiedot agenteille. Navigaatio lyhenee yhdellä. | Yhteydet-sivu on pitkä, varsinkin puhelimessa. Työtiloista näkyy vain lukumäärä, ei listaa. Koodipalvelut ja posti ovat samalla sivulla, vaikka ne palvelevat eri asiaa. |
| **3 · Keskus** | Yksi **Yhteydet**-sivu on yhteenveto: kolme käyttötarkoitusta korttina, jokaisen tilin tila siruna. Kortti tai siru avaa ryhmän oman sivun. Agentit-sivu pysyy oletusmallille, ja tekoälytilaukset ovat Yhteydet › Tekoälypalvelut. Kaikkien tilien virheet näkyvät yhdellä silmäyksellä. | Yksi napsautus lisää ennen hallintaa. Tekoälytilaukset ja oletusmalli ovat yhä eri sivuilla, joten mallivalitsimen kaksi linkkiä vievät kahteen paikkaan. |

Värit, fontit, välit ja kontrollikoot tulevat `design-system/tokens/`-tiedostoista;
asetusten kehys mukailee tiedostoja `web/src/components/Settings.css` ja
`Integrations.css`. Palvelujen merkit ovat neutraaleja kirjainlaattoja, kuten
tuotannossa.

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-integration-grouping/prototypes/settings-grouping/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. Vaihtoehdon vaihtaa alareunan
valitsin, näppäimet **1–3** tai **←/→**; valinta säilyy osoitteen `?v=`-parametrissa.
Vaihto pitää aiheen: jos olet katsomassa tietolähteitä, toinen vaihtoehto avaa
omat tietolähteensä.

1. Valitse yläpalkista **Tilanne: Virheitä**. Navigaation punainen piste kertoo,
   missä osiossa on korjattavaa. Kolmosessa sama näkyy Yhteydet-keskuksen
   korteista ja siruista.
2. Kokeile rivien painikkeita: **Yhdistä**, korjaava painike (esim. *Vaihda tunnus*)
   ja **Hallitse › Irrota**. Ne muuttavat vain prototyypin tilaa, eivätkä avaa
   kirjautumisdialogia.
3. Tekoälysivulla (kolmosessa Agentit) näkyy, miten Claude-virhe heijastuu
   oletusmalliin. Linkki vie Claude-riville, joko samalla sivulla tai toiselle sivulle.
4. Valitse yläpalkista **Mistä linkataan**. Siinä ovat sovelluksen muut
   paikat, jotka ohjaavat asetuksiin: mallivalitsin, käyttöönoton viimeinen
   vaihe, Uusi työtila -sivun Gitea-virhe, Agentit-sivun kirjautumislinkki ja
   ylläpidon AI-avain-teksti. Jokainen kertoo, minne se tässä vaihtoehdossa
   vie. Linkki avaa kohteen ja korostaa rivin.
5. **Uusi henkilö** näyttää alun: vain GitHub ja ylläpitäjän antama AI-avain,
   ei tuotuja työtiloja.
6. Kokeile puhelinleveyttä (390 px). Asetukset avautuvat listana ja osio
   omana näkymänään kuten nyt; kolmosessa ryhmäsivulta palataan keskukseen.

## Ratkaisuja myöhempää arviointia varten

- **Käyttöönoton vaiheet eivät muutu.** Nykyään käyttöönotto sanoo vain
  ”voit tehdä tämän myöhemmin asetuksissa” nimeämättä sivua. Prototyypin
  ”Valmis”-vaihe ehdottaa, että sivu nimetään ja linkitetään. Se on ehdotus
  eikä tuotannon nykytila.
- **Tuodut työtilat Koodipalvelut-sivulla** (1 ja 3) näyttävät, minkä
  palvelun tunnuksella kukin työtila synkronoi, ja mitä koodipalvelun virhe
  tarkoittaa työtilalle. Työtiloja ei avata eikä poisteta täältä; se tapahtuu
  edelleen sivupalkissa ja Uusi työtila -sivulla.
- **Palvelimen AI-avain** on Tekoäly-ryhmän rivi, jota henkilö ei voi irrottaa.
  Ylläpidon teksti ”He näkevät sen kohdassa …” nimeää sivun vaihtoehdon mukaan.
- **Agenttivaroitus** näkyy kaikissa vaihtoehdoissa vain tietolähteiden
  yhteydessä, koska se koskee postia, kalentereita ja tiedostoja eikä
  malleja tai koodipalveluja.
- **Ylläpidon osiot** (Palvelin, Palvelinintegraatiot, AI-avain…) eivät ole
  osa kierrosta. Ne näkyvät, jotta navigaation pituus on realistinen.

## Rakentaminen ja tarkistus

```sh
python3 issues/proto-integration-grouping/prototypes/settings-grouping/build.py
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node issues/proto-integration-grouping/prototypes/settings-grouping/check.mjs
```

`build.py` upottaa tokenit, fontit ja valitsimen `index.html`-tiedostoon.
`check.mjs` avaa jokaisen vaihtoehdon jokaisen sivun 390 ja 1440 px leveänä
kaikissa kolmessa tilanteessa. Se tarkistaa, ettei sivu vieri vaakasuunnassa,
että jokainen ”Mistä linkataan” -linkki päätyy ilmoittamalleen sivulle ja että
konsolissa ei ole virheitä eikä sivu tee verkkopyyntöjä. Lopuksi se kirjoittaa
kuvat ja `checks.json`-tiedoston kansioon `evidence/`.
