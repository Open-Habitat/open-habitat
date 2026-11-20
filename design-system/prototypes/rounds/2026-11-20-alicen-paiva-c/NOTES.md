# Alicen päivä, kierros 3 (c): kolme tarinaa muilta ihmisiltä (20.11.2026)

Riff kierroksen `2026-11-19-etusivu-kierros-2` suunnasta "Alicen päivä".
Kysymys on, mitä päivä sisältää. Kolme workeria tekee kukin kolme tarinaa;
tämä on worker c:n sarja: muita ihmisiä kuin kaupan pitäjä ja rohkeampia
kerronnan muotoja, jotka pysyvät helppoina seurata. Yläosa on kierroksen 2
kiinteä hero sellaisenaan, ja päivän alla on lyhyt tynkä (asennuksen
kehote ja alatunniste), jotta päivä arvioidaan paikallaan. Valitsin on
`/prototype`-taidon kelluva valitsin (`../../lib/picker.css`, `picker.js`
sanatarkasti); suunnan suomenkielinen rivi on sivun yläpuolella ja napin
`title`-vihjeenä.

Kaikissa: päivä alkaa kaiken jo toimiessa (ei kirjautumista, ei
yhdistämistä). Jokaisessa kohtauksessa on kellonaika, ihmisen oma pyyntö,
mitä agentti tekee, mitä tulee takaisin ("Back") ja miksi siihen tarvittiin
oikea kone ("Real computer"), ja ruutu piirretään kirjaston
keskustelukielellä (`../../lib/language.css`: kuplat, lanka, työkalurivit,
jotka aukeavat tulosteeseensa, workerit, luonnokset, muutokset, tarjottu
tiedosto, näkymä keskustelun vieressä). Työkalurivit ovat kiinni kuten
tuotteessa; kohtauksen kantava tuloste on auki. Yhteydet ovat tuotteen
nykyiset (Gmail, kalenteri ja Drive `gog`illa, IMAP `himalaya`lla), eikä
agentti lähetä postia tai muuta mitään omien tiedostojensa ulkopuolella
ilman ihmisen lupaa. Ihmiset, yhteisöt ja osoitteet ovat keksittyjä
(`example.org`).

1. **Kokouspäivä.** Taloyhtiön hallituksen puheenjohtaja Maria (päivisin
   farmaseutti), ja yksi kokous kantaa päivän: aamun briiffi kalenterista,
   viime kuun pöytäkirjasta, avoimista tehtävistä ja postista; kolmen
   kattotarjouksen vertailu PDF:istä ohjelmalla; kalvot kevään
   esityksen mallilla näkymänä keskustelun vieressä; kysymys puhelimelta
   kesken kokouksen (vuoden 2019 korjauksen hinta ja takuu arkistosta
   lähteineen); pöytäkirja litteroinnista ja tehtävät; kolme
   jatkoviestiluonnosta, joista kaksi lähtee ja yksi odottaa; seuraavana
   aamuna väärin kuultu nimi korjataan kolmeen paikkaan ja muutos näytetään
   ja voidaan perua. Palaavat: aamun tarjous (vertailu, kalvot, odottava
   luonnos), Peterin takuutehtävä (avoin aamulla, vastattu kokouksessa,
   suljettu illalla), väärin kuultu nimi. Muoto on kierroksen 2: luvut
   vasemmalla, tahmea vaihtuva ruutu oikealla, ja ruudun yllä päivän nauha,
   jolla kokous on oranssi lohko ja kohtaukset nastoja. Puhelimessa ruutu
   on luvun sisällä. Käyttötapaukset: 21, 13, 25, 29, 32, 20.
2. **Kaksi kaistaa.** Aikuisopiston kirjanpidon iltakurssin opettaja Ana
   tiistai-iltana. Kaksi rinnakkaista kaistaa: vasemmalla hänen iltansa
   (lähtee töistä, hakee lapsen, kokkaa, syö, sohvalla), oikealla agentin
   työ, ja välissä selkäranka, joka on katkoviivaa kun kansi on kiinni.
   31 palautusta kurssipostista, viikolla 2 kirjoitettu tarkistin, neljä
   workeria, Mac-tiedoston muunnos, yhdeksän samaa virhettä, jotka
   osoittautuvat tehtävänannon virheeksi, kaksi tavu tavulta samaa
   tiedostoa, illalla yhteenveto, tehtävän korjaus muutoksena ja 29
   vastausta lähtee luvalla; lopuksi kaksi tapaamista torstaille
   kalenteriin. Palaavat: viikon 2 työkalu, rivivirhe (havaittu 17:50,
   korjattu 20:40, ensi vuoden ryhmälle kunnossa), samat tiedostot (18:45
   sivuun, 21:05 tapaamiset). Puhelimessa kaistat pinoutuvat. Käyttötapaukset:
   44, 46, 47, 28.
3. **Viisi iltaa.** Urheiluseuran vapaaehtoinen sihteeri Nora hoitaa
   junioreiden kesäleirin ilmoittautumiset vartti illassa, maanantaista
   perjantaihin. Ajatus: agentin muisti on tiedosto. Oikealla tahmea
   `camp/STATUS.md`, joka kasvaa ilta illalta (uudet rivit vihreinä,
   poistuneet yliviivattuina), ja yläreunassa viikon nauha, josta pääsee
   illasta toiseen. Kolmesta lähteestä yksi lista ja kysymys mahdollisesta
   kaksoiskappaleesta; tiistaina yhdistäminen ja 63 kirjettä; keskiviikkona
   valmentajan sairastuminen muuttaa vain 14 kirjettä, ja kaikki lähtevät
   luvalla; torstaina "he ovat kaksoset", ja tiistain muutos perutaan
   historiasta keskiviikon muutosta koskematta; perjantaina avoimet asiat ja
   pieni ohjelma ryhmälistoille, joka jää kansioon. Palaavat: Lindin lapset
   (ma kysymys, ti yhdistetty, to kaksoset), statustiedosto, kirjeet.
   Puhelimessa tiedosto on illan lopussa avattavana. Käyttötapaukset: 45,
   26, 56.

Tarinoiden runko on käyttötapausraporttien kuvitteellisista esimerkeistä
(taloyhtiön puheenjohtaja, iltakurssin opettaja, seuran leirin
koordinaattori); muuta raporteista ei ole sivuilla.

## Rakentaminen ja tarkistus

```
TMPDIR=<oma scratch> node design-system/prototypes/rounds/2026-11-20-alicen-paiva-c/build.mjs <out.html>
PROTO_WEB=<web-hakemisto, jossa node_modules> \
  node design-system/prototypes/rounds/2026-11-20-alicen-paiva-c/check.mjs <out.html> <kuvahakemisto>
```

`build.mjs` tarvitsee ImageMagickin (`convert`, `identify`) heron kuvaan;
ruudut ovat HTML:ää, joten tulos on noin 0,5 Mt. `check.mjs`:n tarkistukset
on lueteltu sen alussa.
