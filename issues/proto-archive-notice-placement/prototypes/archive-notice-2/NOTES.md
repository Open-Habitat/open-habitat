# Arkistoinnin ilmoitus ylhäällä: kierros 2, ilme

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, joka on rakennettu
prototyyppikirjastosta eikä tuotantokomponenteista. Rakennus ja tarkistus tehdään
komennolla
`node design-system/prototypes/rounds/2026-10-28-arkistoinnin-ilmoitus-2/verify.mjs`
(Playwright `web/node_modules`ista). Kuvat ovat `evidence/`-hakemistossa
laitteen skaalauksella 2. Kierros 1 on vertailun vuoksi edelleen tallessa
hakemistossa `../archive-notice/`.

Valitsit suunnan **Ylhäällä**, joten kuittaus on kaikissa kolmessa ilmeessä
yläpalkin alla. Tällä kierroksella vaihtuu vain se, miltä kuittaus näyttää. Jokaisella
ilmeellä on lisäksi oma elinaika ja oma tapa pinota useampi ilmoitus.

## Kokeile näin

1. Olet työpuukeskustelussa *Kuvien pakkaus WebP-muotoon*. Paina yläpalkin
   arkistointi-ikonia.
2. Päädyt työtilasivulle, ja kuittaus ilmestyy. Fokus siirtyy sivun otsikkoon,
   ei kuittaukseen. Palauta on noin puoli sekuntia harmaana, kunnes palvelin on
   vahvistanut arkistoinnin.
3. Avaa *Status-skripti* ja ala kirjoittaa. Kenttä, Lähetä-painike ja uusin
   vastaus jäävät vapaiksi kaikissa ilmeissä.
4. Paina sivun yläpalkista **Poista työtila** ja sen jälkeen **Tilanvaihto**.
   Silloin näkyvissä on kolme ilmoitusta, ja näet, miten kukin ilme pinoaa ne.
5. **Poisto jää kesken** näyttää ilmoituksen, joka ei katoa itsestään. Sen
   teksti rivittyy, jotta sen voi lukea myös puhelimessa.
6. **Palauta** tuo keskustelun takaisin ja avaa sen. **×** sulkee kuittauksen.
   Esc sulkee sen vain silloin, kun fokus on kuittauksessa. **Arkistoi alusta**
   aloittaa tarinan uudelleen.

## Sama kaikissa ilmeissä

- **Kuittaus ei koskaan vie fokusta.** Jos fokus oli kuittauksessa, kun se
  sulkeutui, fokus palaa kenttään tai sivun otsikkoon.
- **Esc kentässä ei sulje kuittausta.** Kirjoittajan Esc kuuluu kentälle.
- **Osoitin tai fokus ilmoitusalueella pysäyttää kaikkien kellot**, ja
  ilmoitukset jatkavat siitä, mihin jäivät.
- **Kesken oleva tai epäonnistunut toiminto pitää kuittauksen auki** eikä
  näytä elinajan viivaa.
- **Saman lajin uusi ilmoitus korvaa vanhan**, ja eri lajit pinoutuvat.
  Uusin on aina lähimpänä yläpalkkia.

## Ilmeet

1. **Kortti** (8 s). Tuotannon tumma pilleri kompaktina korttina keskellä
   yläpalkin alla. Siinä on kuvake, ja leveys on enintään 440 px. Kun
   ilmoituksia on useita, ne ovat pakkana: uusin näkyy, ja sen takaa pilkistää
   kaksi reunaa sekä luku *+2*. Takana odottavien kellot ovat pysähdyksissä,
   joten myöhemmin tullut ei menetä kumoamisaikaansa. Kun osoitin tai fokus
   tulee pakan päälle, kortit levittyvät allekkain. Tämä ilme on lähimpänä
   tuotantoa ja huomiota herättävin.
2. **Nauha** (10 s). Ohut, koko sisältösarakkeen levyinen harmaa nauha, joka
   on kiinni yläpalkin alareunassa ja kelluu langan päällä. Toiminnot ovat
   korostusvärillä. Pinossa jokainen ilmoitus on oma rivinsä ja kaikilla on
   oma kellonsa, joten mitään ei jää piiloon. Kolme riviä vie puhelimessa noin
   120 px.
3. **Otsakerivi** (20 s). Hiljainen harmaa rivi yläpalkin sisällä, ilman
   taustaa ja varjoa. Yläpalkki kasvaa rivin verran ja lanka siirtyy alemmas,
   joten mitään ei jää kuittauksen alle. Uusin vastaus pysyy paikallaan, koska
   lanka on ankkuroitu alareunaan. Pinossa näkyy uusin rivi ja painike *+2*,
   joka avaa muut. Avaamattomat odottavat kello pysähdyksissä. Elinaika on
   pisin, koska rivi ei peitä mitään.

## Mitä katsoa

- Työtilasivu, jolle arkistointi vie: Kortti ja Nauha peittävät sivun otsikon,
  puhelimessa kokonaan (`*-tyotilasivu`-kuvat). Otsakerivi ei peitä mitään.
- Kun kuittaus on kolmen ilmoituksen pakassa, Kortti piilottaa kumoamisen
  pakan taakse. Löytyykö se, vai pitäisikö arkistoinnin pysyä aina päällimmäisenä?
- Onko Otsakerivi liian hiljainen? Huomaatko sen, kun katse on kentässä?
- Tarvitaanko elinajan viivaa? Otsakerivissä sitä ei ole, koska rivi on
  joka tapauksessa näkyvissä 20 s.
