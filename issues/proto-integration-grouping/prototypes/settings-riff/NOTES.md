# Tekoäly-sivu: oletusmalli ja API-avaimet · Kierros 2

Valitsit kierroksella 1 *Kolme sivua*. Tämä kierros jatkaa sen
**Tekoäly**-sivulla ja käsittelee kahta asiaa:

1. **Oletusmallin rivi.** Klikkaus avaa nykyisen mallivalitsimen (`ModelPicker`
   palveluntarjoajavälilehtineen, mallit radiopainikkeina, ajattelutaso).
   Samalla näytetään, miten oletus liittyy keskustelun omaan malliin.
2. **API-avaimet.** Jokaisella palveluntarjoajalla on oma avaimensa. Avaimen voi
   lisätä, vaihtaa ja poistaa. Näkyvissä on, mitkä mallit avain avaa, ja
   ylläpitäjän antama avain on henkilön omien rinnalla. Virheistä mukana ovat
   hylätty avain, täynnä oleva kiintiö ja väärän palvelun avain.

Palvelujen merkit ovat kierroksen 1 kirjainlaattoja: GitHub ja Gitea
Koodipalveluissa, ja samalla tavalla nyt myös tekoälypalvelut (Ch, Cl, OA, An,
DS). Tuotannon käyttöönoton tekoälylistassa on jo samat laatat. Kaikki tilit,
mallinimet ja avaimet ovat keksittyjä. Avaimesta näytetään vain neljä viimeistä
merkkiä, kuten tuotannossa.

## Kolme vaihtoehtoa

| Vaihtoehto | Oletusmalli | API-avaimet | Hinta |
| --- | --- | --- | --- |
| **1 · Paikallaan** | Rivi avautuu kortin sisällä. Valitsin, ajattelutaso ja selitys keskustelun mallista näkyvät rivin alla. *Valmis* sulkee sen. | Ryhmitelty **palveluntarjoajittain**: OpenAI, Anthropic ja DeepSeek. Kunkin alla ovat sen reitit: tilaus ja API-avain. Tämä selittää, että ChatGPT-tilaus ja OpenAI-avain ovat kaksi tietä samoihin malleihin. | Avaimet ovat kahden napsautuksen päässä (Hallitse → rivi). Kiinni olevasta rivistä näkee vain yhteenvedon. |
| **2 · Ponnahdus** | Sama pilleri ja ponnahdusvalikko kuin kirjoituskentässä. Puhelimessa valikko avautuu alhaalta nousevana arkkina. Oletuksen ja keskustelun mallin valitsee samalla kontrollilla. | **Tilaukset** ja **API-avaimet** ovat omina listoinaan. Avainrivillä näkyvät palvelu, `sk-…loppu`, *Oma* tai *Ylläpitäjän antama*, tila ja avattavat mallit. **Lisää API-avain** avaa dialogin, jossa valitaan ensin palvelu ja syötetään sitten avain. | Ponnahdusvalikko peittää sivun. Palveluntarjoajien yhteys (tilaus ja avain samaan malliin) jää lukijan pääteltäväksi. |
| **3 · Mallit edellä** | Oletusmalli on sivun pääkohta. Klikkaus avaa alisivun **Tekoäly › Mallit**: rivi per malli, ja jokainen reitti, joka sen tarjoaa, on painike. Lukitun reitin kohdalla on *Lisää Anthropic-avain*. | **Pääsy malleihin**: tilaukset ja avaimet yhtenä listana. Jokaisesta pääsee näkemään, mitkä mallit se avaa. | Mallisivu on uusi valitsin. Se ei ole sama kuin kirjoituskentän valitsin, joten mallinvalintoja olisi kahta eri muotoa. |

**Suosittelen vaihtoehtoa 2, Ponnahdus.** Oletusmalli valitaan samalla
kontrollilla kuin keskustelun malli kirjoituskentässä, joten opittavaa on yksi
asia. `ModelChip` ja ponnahdusvalikko ovat jo tuotannossa. API-avaimet nousevat
omaksi listakseen, jossa jokaisella avaimella on tila, alkuperä ja avattavat
mallit. Juuri ne puuttuvat tuotannosta nyt, kun avain on pelkkä rivi
”OpenAI API-avain · sk-…”. Vaihtoehdosta 3 kannattaa ottaa mallien
lukitus- ja reittitieto, jos mallivalitsimeen myöhemmin lisätään
”Lisää avain” -kohta. Vaihtoehdosta 1 kannattaa ottaa alateksti, joka
selittää tilauksen ja avaimen eron.

## Kokeile

```
issues/proto-integration-grouping/prototypes/settings-riff/index.html
```

## Ratkaisuja ja rajoja arvioitavaksi

- **Oletus ja keskustelun malli.** Kaikki vaihtoehdot sanovat saman, ja se on
  tuotannon nykyinen käytös: oletus tallentuu Pi:hin (myös SSH:lla), uusi
  keskustelu alkaa sillä, kirjoituskentän valitsin voi aloittaa keskustelun
  toisella mallilla, ja avoin keskustelu pitää mallinsa. Muotoilu vaihtelee:
  1 näyttää selitysruudun, 2 yhden rivin ja 3 kolmivaiheisen kuvion.
- **Ylläpitäjän avain on henkilön oma avainpaikka.** Pi:ssä on yksi avain
  palvelua kohden. Ylläpitäjän antama avain on siis kopio henkilön
  Anthropic- (tai OpenAI-) paikassa, ei erillinen avain. Siksi painike on
  *Vaihda omaan…*: oma avain korvaa kopion, ja laskutus siirtyy henkilölle.
  Kun palvelin on vaihtanut avaimensa, vanha kopio merkitään ja
  Virheitä-tilanteessa se on jo hylätty.
- **Mitä host tietää nyt ja mitä ei.** Tuotanto tietää jo, onko avain
  tallessa, sen neljä viimeistä merkkiä, ylläpitäjän kopion tilan ja kunkin
  palvelun mallit. Lisäksi se tietää, milloin palveluntarjoaja on torjunut
  mallin. Seuraavat ovat ehdotuksia, eivät nykytilaa:
  - Torjunnan syy avainriville erotettuna: *hylätty* (401) tai
    *kiintiö täynnä* (429) kellonaikoineen. Tämä luultavasti saadaan
    mallikohtaisesta torjuntatiedosta, ja se varmistetaan toteutuksessa.
  - **Tarkista ja tallenna**, eli palveluntarjoaja kokeilee avaimen ennen
    tallennusta. Se on uusi kutsu, jonka daemon tekisi henkilön nimissä.
    Tuotanto tarkistaa nyt vain avaimen muodon (`sk-`, Anthropicilla
    `sk-ant-`), ja sama muototarkistus on prototyypissä.
- **Ensimmäinen avain vaihtaa oletuksen.** Näin tuotanto toimii jo: palvelun
  ensimmäinen avain tekee sen mallista oletuksen. Prototyyppi sanoo sen
  lomakkeessa ja tilarivillä.
- **Poisto** käyttää tuotannon vahvistusta. Jos oletusmalli käyttää poistettavaa
  avainta, dialogi sanoo sen, ja poiston jälkeen oletusrivi kertoo, että uusi
  keskustelu kysyy mallin.
- **Väärän palvelun avain** jää muototarkistukseen ennen tallennusta.
  Hylätty avain ei tallennu, ja edellinen tila säilyy. Prototyypin
  katkoviivalaatikon painikkeet täyttävät synteettisen avaimen.
- **Koodipalvelut** on kierroksen 1 mukainen, GitHub- ja Gitea-laattoineen.
  Muut osiot ovat vain navigaatiossa.

## Rakentaminen ja tarkistus

```sh
python3 issues/proto-integration-grouping/prototypes/settings-riff/build.py
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node issues/proto-integration-grouping/prototypes/settings-riff/check.mjs
```

`build.py` upottaa tokenit, fontit ja vaihtoehtovalitsimen `index.html`-tiedostoon.
`check.mjs` tarvitsee `web/`-riippuvuudet (`npm ci --prefix web`). Se avaa
jokaisen vaihtoehdon kaikissa kolmessa tilanteessa 390 ja 1440 px leveänä,
oletusvalitsin auki, ja tarkistaa, ettei sivu vieri vaakasuunnassa. Lisäksi se
käy läpi nämä polut:

- oletuksen vaihto ja vahvistus
- virheestä toipuminen
- avaimen lisäys, hylkäys ja poisto
- ylläpitäjän avaimen korvaaminen omalla
- Escape ja fokus
- Koodipalvelujen laatat

Konsolissa ei saa olla virheitä eikä sivu saa tehdä verkkopyyntöjä. Kuvat ja
`checks.json` tallentuvat kansioon `evidence/`.
