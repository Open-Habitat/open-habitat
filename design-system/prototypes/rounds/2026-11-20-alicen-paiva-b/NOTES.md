# Alicen päivä, kierros 3 (b) – kolme tarinaa organisaation sisältä (20.11.2026)

Riff kierroksesta `2026-11-19-etusivu-kierros-2`, jonka "Alicen päivä" Jari
valitsi. Tämä kierros ei tutki asettelua vaan sitä, mitä päivä sisältää.
Kolme workeria tekee kukin kolme tarinaa; tämä on workerin **b** osuus, ja
sen linssi on organisaation sisäpuoli: talous, kirjanpito, sopimukset,
hallinto, hallitus, kuunvaihde.

Asettelu on kaikissa kolmessa sama (kierroksen 2 luvut kellonaikoineen ja
tahmea ruutu, puhelimessa ruutu luvun alla), jotta tarinoita verrataan
tarinoina. Yläosa on kierroksen 2 yläosa sellaisenaan, ja päivän alla on
lyhyt, tyngäksi merkitty loppu. Jokaisessa kohtauksessa on kellonaika, Alicen
pyyntö hänen omin sanoin (otsikkona), mitä agentti tekee ja mitä palaa,
"Why a real computer" -rivi ja, kun jokin aiempi asia palaa, nappi, joka
vierittää kohtaukseen, josta se alkoi. Päivä alkaa valmiista: ei
kirjautumista, ei yhdistämistä.

Ruudut on piirretty HTML:llä kirjaston esityskielellä (`lib/language.css`,
`lib/recap.css`): kuplat, lanka, työkalurivit, diff, tilannekatsaus. Omia
paloja ovat ikkunan yläpalkki, tarjottu tiedosto ja näkymä, viereen avattu
näkymä, viestiluonnos ja workerilista. Kuvia on vain yläosan kaappaus.

## Tarinat ja niiden lähteet (`KARSITTAVA.md`:n numerot)

1. **Kuunvaihde** – Alice sulkee lokakuun. Kantava idea: lukuja ei
   kirjoiteta eikä muisteta, ne lasketaan tiedostoista, ja edellisen kuun
   säännöt ja työkalut ovat levyllä. Palaa: aamun kuititon 49 euron veloitus
   → katsaus puhelimessa → tilausselvitys → omistajien sivu → sääntötiedosto
   joulukuuta varten. Lähteet: 2 (kuukauden kirjanpito), 1 (puuttuvat
   kuitit), 4 (ohjelmistotilaukset), 3 (ennuste ja kassan riittävyys),
   11 (kuukausiraportti omistajille).
2. **Hallituksen kokous** – Alice hallituksen sihteerinä. Kantava idea: yksi
   kokous kantaa päivän (valmistelu, luku kesken kokouksen, pöytäkirja,
   lähtevät viestit). Palaa: vuokranantajan tiistainen tarjous ja
   tehtävälista aamusta iltapäivään, ja aamun laskentaohjelma ajetaan
   uudestaan illalla. Lähteet: 21 (briiffi ennen palaveria), 3 ja 10
   (kassaskenaariot päätöksen pohjaksi), 22 (Word-kommentit kohta kohdalta),
   20 (nauhoitteesta muistio ja tehtävät), 11 (hallituksen aineisto),
   8 (määräajat kalenteriin; vain taustalla).
3. **Sopimuskansio** – Alice ja toimittajan hinnankorotuskirje. Kantava
   idea: yksi kysymys paljastaa sotkun, iso työ jaetaan workereille ja
   jatkuu ilman välilehteä, ja tulos on pysyvä rekisteri. Palaa: aamun kirje
   saa vastauksensa iltapäivällä, ja aamun tunnin haku on illalla yksi
   lause. Lähteet: 32 (allekirjoitetut sopimukset oikeaan kansioon oikealla
   nimellä), 57 (yhteisen levyn kartoitus), 28 (sata kohdetta rinnakkain
   workereilla; tässä sopimukset), 8 (määräajat kalenteriin), 31 (saapunut
   sopimus luetaan omaa vastaan; tässä hintaehto).

## Mitä ruudut olettavat tuotteesta

- Kytkennät ovat valmiina olevia: tarinassa 1 Gmail ja Drive, tarinassa 2
  Outlook-posti ja -kalenteri sekä agentin omat tiedostot, tarinassa 3
  Dropbox, Gmail ja Google-kalenteri. Kirjanpito-ohjelmaa ei ole kytketty:
  Alice vie raportit tiedostoiksi.
- Tarinassa 2 pöytäkirja ja ennakkoaineisto tarjotaan ladattavina
  tiedostoina eikä niitä kirjoiteta SharePointiin. Nauhoitteesta tulee
  agentille litteraatti tiedostona, koska litterointipalvelua ei ole
  valmiina.
- Posti lähtee vasta Alicen sanasta ("Send it."), ja Dropboxin
  uudelleennimeäminen tehdään vasta hänen luvallaan agentin oman kopion
  jälkeen. Fjordframen tilauksen Alice irtisanoo itse.
- Kytkentöjen työkalurivien nimet (`mail`, `drive`, `dropbox`, `calendar`)
  ovat kuvituksia; oikeat nimet tulevat, kun ruudut kaapataan labista.
- Kaikki ihmiset, yritykset, osoitteet ja summat ovat keksittyjä
  (Example Studio, Alice, Bob, Anna, Chen; osoitteet `example.org`).

## Rakentaminen ja tarkistus

```
TMPDIR=<oma scratch> node design-system/prototypes/rounds/2026-11-20-alicen-paiva-b/build.mjs <out.html>
PROTO_WEB=<web-hakemisto, jossa node_modules> \
  node design-system/prototypes/rounds/2026-11-20-alicen-paiva-b/check.mjs <out.html> <kuvahakemisto>
```

`build.mjs` tarvitsee ImageMagickin (`convert`, `identify`); tulos on noin
0,5 Mt. `check.mjs`:n tarkistukset on lueteltu sen alussa: jokainen tarina
1440 ja 390 px:n leveydellä, jokainen kohtaus vieritettynä esiin.
