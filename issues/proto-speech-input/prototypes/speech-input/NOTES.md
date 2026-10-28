# Sanelu viestikenttään · mikä päättää pitkän sanelun

Päätit 27.10., että sanelu käyttää Sonioxia mallilla D + P1: daemon luo
kertakäyttöisen väliaikaisen avaimen ja selain striimaa suoraan Sonioxille.
Sanelu ei saa katketa minuuttiin, ja katto piti päättää prototyypissä.
Tämä kierros näyttää koko sanelun viestikentässä. Valittavana on yksi asia:
**mikä päättää pitkän sanelun.**

## Sama kaikissa suunnissa

- **Mikrofoni** on kentän alarivillä Lähetä-painikkeen vieressä
  (*Sanele*), samassa rivissä kuin Liitä, Komennot ja Tiedosto.
  Napautus aloittaa sanelun. Jos painiketta pitää pohjassa yli puoli
  sekuntia, sanelu loppuu, kun painikkeen päästää irti.
- **Sanelun aikana** mikrofonin paikalla on punertava nauha: piste,
  äänitasopalkit, kesto, tila (*kuuntelee* tai *tauko 0:12*) ja
  *Valmis*. Valmis tai Esc lopettaa sanelun.
- **Välitulokset**: vahvistettu teksti näkyy kentässä tavallisena ja
  Sonioxin vielä muuttuva arvaus himmeänä perässä. Arvaus voi korjaantua.
  Kokeile kohtaa, jossa sanotaan ”JSON-muotoinen” tai ”pytest”.
- **Tauot**: alle neljän sekunnin tauko ei näy tekstissä. Pidempi tauko
  aloittaa uuden kappaleen, jotta pitkä sanelu ei ole yhtä tekstimassaa.
- **Lopetus**: kun sanelu loppuu, kenttä on taas tavallinen muokattava
  tekstikenttä, ja kursori on tekstin lopussa.
- **Lähetä kesken sanelun** lopettaa sanelun ja lähettää viestin.
- **Kirjoitetun perään**: jos kentässä on jo tekstiä, sanelu jatkaa
  sen perään.
- **Yhteyskatko**: sanelu yhdistää kerran uudelleen uudella avaimella
  (*Yhdistetään uudelleen…*) ja jatkaa. Jos yhteys ei palaa, teksti jää
  kenttään ja ilmoitus kertoo, mihin asti sanelu ehti.
- **Virheet ja ei avainta** näkyvät ilmoituksena kentän alla: ei
  avainta (*Avaa asetukset*), mikrofoni estetty (*Yritä uudelleen*),
  avain hylätty ja yhteinen avain täynnä. Viimeinen kuuluu mallin D
  seurauksiin, koska kaikki yhteistä avainta käyttävät jakavat sen
  10 samanaikaisen sanelun rajan.

## Kolme suuntaa

| Suunta | Mikä päättää sanelun | Mitä katon lähestyessä näkyy | Vahvuus | Hinta |
| --- | --- | --- | --- | --- |
| 1 Katto | Kiinteä 30 minuutin katto, jonka Soniox itse valvoo (väliaikaisen avaimen istuntokatto). | 25 minuutin kohdalla kentän yläpuolelle tulee *Sanelu päättyy 4:59 kuluttua*. Viimeisellä minuutilla ilmoitus muuttuu punertavaksi. 30:00 kohdalla sanelu päättyy, teksti jää kenttään, ja ilmoituksessa on *Jatka sanelua*. | Yksinkertaisin ja rehellisin: katto on sama luku Sonioxilla ja näytöllä, eikä selaimen tarvitse arvioida mitään. Unohtunut mikrofoni sammuu viimeistään puolessa tunnissa. | Puhuja katkaistaan 30:00 kohdalla, vaikka hän olisi kesken lauseen. Jatkaminen on yksi painallus, mutta viimeinen sana voi jäädä kesken. |
| 2 Hiljaisuus | Ei näkyvää aikakattoa. Kolmen minuutin hiljaisuus päättää sanelun. Takarajana on 4 tuntia. | Kun on ollut kaksi minuuttia hiljaista, kenttä näyttää *Hiljaista 2:01 · Sanelu päättyy 0:58 kuluttua, ellei puhetta kuulu*. Puhe poistaa ilmoituksen. Lähellä neljää tuntia näkyy takarajan ilmoitus. | Puhujaa ei keskeytetä koskaan. Unohtunut mikrofoni hiljaisessa huoneessa sammuu kolmessa minuutissa. | Jos taustalla on puhetta, kuten televisio tai palaveri, hiljaisuutta ei tule. Sanelu jatkuu tunteja ja kirjoittaa kenttään muiden puhetta. Myös pitkä ajattelutauko päättää sanelun. |
| 3 Jatkokysymys | Sanelu kysyy 25 minuutin välein, jatketaanko. Jos kysymykseen ei vastata viidessä minuutissa, sanelu päättyy. Takarajana on 4 tuntia. | Kentän yläpuolelle tulee kortti *Jatketaanko sanelua? Sanelu on kestänyt 25:00. Se päättyy 4:57 kuluttua, ellet jatka.* Kortissa ovat *Jatka sanelua* ja *Lopeta nyt*. Kortti ei pysäytä nauhoitusta, ja jatkon jälkeen näkyy hetken *Kysyn uudelleen 50:00 kohdalla*. | Paikalla oleva puhuja ei katkea koskaan. Unohtunut mikrofoni sammuu 30 minuutissa riippumatta huoneen äänistä, koska puhe ei vastaa kysymykseen. | Puolen tunnin välein tulee kysymys, joka vaatii painalluksen. Katon valvoo selain, ja Soniox valvoo vain neljän tunnin takarajaa. |

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-speech-input/prototypes/speech-input/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa ja ilman mikrofonia, koska
puhe on simuloitu. Suuntaa vaihdetaan alareunan valitsimella tai
näppäimillä **1–3**. Yläreunassa ovat teema ja puhelinleveys sekä kaksi
kierroksen omaa valintaa:

- **Kohtaus** hyppää pitkän sanelun kohtiin: *Sanelu alkaa*, *Pitkä
  sanelu, 12 min*, *Tauko puheessa*, *Jatkaa kirjoitettua tekstiä*,
  *Sanelu lopetettu*, suunnan omat katon kohdat (esimerkiksi *Katto
  lähestyy, 25 min* ja *Katto täyttyy, 30 min*) sekä virheet.
- **Nopeus** 1×, 10× tai 60× kiihdyttää sanelun kelloa. Esimerkiksi
  Katossa 25 minuutin ilmoituksesta loppuun kuluu 60×-nopeudella viisi
  sekuntia.

Tehtävä on sama kaikissa suunnissa:

1. Paina *Sanele* ja katso, miten teksti syntyy. Lopeta *Valmis*-painikkeella.
2. Valitse kohdaksi *Katto lähestyy* tai *Hiljaisuus 2 min* tai
   *Jatkokysymys* ja aseta nopeus 60×. Katso, mitä tapahtuu, kun katto
   täyttyy. Jatkokysymyksessä paina myös *Jatka sanelua*.
3. Kokeile virheistä ainakin *Ei avainta* ja *Yhteys ei palaa*.

Synteettinen sanelu on noin neljän minuutin teksti statusskriptin
viikkoyhteenvedosta. Sitä pidemmissä saneluissa sama teksti toistuu.

## Kuvat

`evidence/` sisältää jokaisesta suunnasta työpöytä- ja puhelinkuvat
vaaleana ja tummana: `*-pitka-sanelu`, `*-katto-lahestyy` ja
`*-katto-paattyi`. Yhteiset tilat ovat Katon kuvina: `*-alku`, `*-tauko`,
`*-yhdistetaan-uudelleen`, `*-yhteys-katkesi`, `*-nokey`, `*-mic`,
`*-rejected` ja `*-limit`. Kuvat on otettu laitteen skaalauksella 2.

Suositus ja päätettävät asiat ovat issuen `result.md`:ssä.
