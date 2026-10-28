---
{
  "title": "Aurinkopolku",
  "goals": [
    {
      "title": "Korjaa havaittu ongelma",
      "when": "Kun löydät toistettavan virheen.",
      "what": "Saat ongelman juurisyyn, rajatun korjauksen ja tiedon ajetuista testeistä. Lisää luonnokseen havainto ja toisto-ohje ennen lähettämistä.",
      "steps": [
        "Kuvaile havainto, odotettu tulos ja miten virhe toistuu.",
        "Agentti selvittää syyn ja tekee pienen toistavan testin.",
        "Agentti korjaa juurisyyn, ajaa testit ja kertoo tarkistamatta jääneen."
      ],
      "skill": "korjaa-ongelma",
      "prompt": "Selvitä ongelman syy. Tee ensin pieni toistava testi. Korjaa juurisyy ja aja aiheeseen liittyvät testit. Kerro, mitä tarkistit ja mikä jäi tarkistamatta.\n\n[kuvaile havainto]"
    },
    {
      "title": "Tutustu repoon",
      "when": "Kun aloitat tässä repossa ensimmäistä kertaa.",
      "what": "Saat kartan Aurinkopolun rakenteesta, tärkeimmistä ohjeista ja testien ajamisesta. Tiedostoja ei muuteta.",
      "steps": [
        "Agentti lukee repon ohjeet ja tärkeimmät aloitustiedostot.",
        "Agentti kokoaa hakemistokartan ja testien ajotavat.",
        "Tarkistat yhteenvedon ja valitset seuraavan tehtävän."
      ],
      "prompt": "Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja."
    },
    {
      "title": "Valmistele seuraava julkaisu",
      "when": "Kun haluat tarkistaa julkaisuvalmiuden.",
      "what": "Saat julkaisuvalmiuden tarkistuksen, estelistan ja julkaisuluonnoksen. Tämä ei luo tagia, pushaa tai julkaise mitään.",
      "steps": [
        "Agentti lukee julkaisuohjeen ja tarkistaa työpuun tilan muuttamatta sitä.",
        "Agentti kokoaa muutokset, tarkistaa esimerkit ja ajaa julkaisuohjeen testit.",
        "Saat estelistan, versioehdotuksen ja julkaisuluonnoksen hyväksyttäväksi."
      ],
      "prompt": "Tarkista seuraavan julkaisun valmius.\n\n1. Lue repon julkaisuohje.\n2. Tarkista työpuun tila muuttamatta sitä.\n3. Kokoa edellisen julkaisun jälkeiset käyttäjälle näkyvät muutokset.\n4. Erota korjaukset uusista ominaisuuksista.\n5. Tarkista dokumenttien esimerkit.\n6. Aja ohjeen nimeämät testit.\n7. Kerro myös tarkistukset, joita et voinut ajaa.\n8. Listaa avoimet esteet.\n9. Ehdota seuraava versio ja perustele se.\n10. Kirjoita lyhyt julkaisuluonnos.\n\nÄlä luo tagia, pushaa tai julkaise mitään. Odota hyväksyntää. Tarkistettava esimerkkipolku: docs/esimerkit/erittain-pitka-synteettinen-julkaisun-valmistelun-tarkistuslistan-tiedostonimi.md"
    },
    {
      "title": "Päivitä ohje",
      "when": "Kun käytäntö on muuttunut.",
      "what": "Saat täsmälliset korjausehdotukset valitsemaasi ohjeeseen. Lisää tarkistettavan ohjeen polku luonnokseen.",
      "steps": [
        "Nimeä tarkistettava ohje.",
        "Agentti vertaa esimerkkejä nykyiseen toteutukseen.",
        "Tarkistat rajatut korjausehdotukset ennen muutoksia."
      ],
      "prompt": "Tarkista ohjeen [polku] esimerkit nykyistä toteutusta vasten. Ehdota täsmälliset korjaukset. Älä muuta muita ohjeita."
    },
    {
      "title": "Arvioi muutos",
      "when": "Ennen muutoksen yhdistämistä.",
      "what": "Saat listan toistettavista ongelmista ja niiden vaikutuksista. Tyylitoiveet eivät kuulu tähän arvioon.",
      "steps": [
        "Tarkista, että arvioitava muutos on nykyisessä haarassa.",
        "Agentti lukee muutoksen ja varmistaa epäillyt ongelmat.",
        "Päätät löydösten perusteella, mitä korjataan ennen yhdistämistä."
      ],
      "prompt": "Arvioi nykyisen haaran muutos. Etsi vain toistettavia ongelmia ja kerro kunkin vaikutus, ei tyylitoiveita."
    },
    {
      "title": "Suunnittele pieni lisäys",
      "when": "Kun haluat uuden toiminnon.",
      "what": "Saat ehdotuksen pienimmästä hyödyllisestä muutoksesta ja sen testistä. Lisää tavoite luonnokseen; koodaus ei kuulu tähän pyyntöön.",
      "steps": [
        "Kuvaile uuden toiminnon tavoite.",
        "Agentti lukee nykyisen toteutuksen.",
        "Tarkistat muutosehdotuksen ja testin ennen koodausta."
      ],
      "prompt": "Suunnittele lisäys: [tavoite]. Lue nykyinen toteutus. Ehdota pienin hyödyllinen muutos ja sen testi ennen koodausta."
    }
  ]
}
---
Pieni **retkireittien suunnittelija**. Tässä repossa ovat sovellus, testit ja käyttöohjeet.
