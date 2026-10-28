# Saaristoretki 2027

Tämä on Kaarinan pyöräseuran kesäretken suunnitelma. Agentti päivittää tiedostoa sitä mukaa kuin varaukset ja aikataulut varmistuvat; **lukitut** kohdat on merkitty erikseen.

> Lähtö lauantaina 12.6. kello 8.30 Aurajoen rannasta. Paluu sunnuntaina 13.6. noin kello 18.

## Tiivistelmä

- Reitti on Saariston rengastie myötäpäivään, yhteensä noin 200 km kahdessa päivässä.
- Mukana on 18 pyöräilijää ja yksi huoltoauto.
- Yöpyminen Houtskarissa, Hyppeisin majatalossa.
- Lauttoja on viisi; kaksi niistä on yhteysaluksia, joihin mahtuu rajallisesti pyöriä.

## Aikataulu

### Lauantai

| Aika | Paikka | Huomio |
| --- | --- | --- |
| 8.30 | Aurajoen ranta | Kokoontuminen ja lyhyt ohjeistus |
| 9.00 | Lähtö | Ryhmä A edellä, ryhmä B kymmenen minuuttia perässä |
| 10.40 | Paraisten lautta | Lautta kulkee 20 minuutin välein |
| 12.15 | Nauvon satama | Lounas Gästhamnissa, varattu 18 hengelle |
| 14.30 | Retais–Korppoo | Lautta 40 minuutin välein |
| 17.45 | Galtby | Yhteysalus Houtskariin, pyörät varattu |
| 19.00 | Hyppeis | Majoittuminen ja sauna |

### Sunnuntai

| Aika | Paikka | Huomio |
| --- | --- | --- |
| 8.00 | Aamiainen | Majatalo avaa keittiön tunnin tavallista aiemmin |
| 9.15 | Mossala–Iniö | Yhteysalus, **lukittu** |
| 11.30 | Kustavi | Lounas omin eväin |
| 13.00 | Vartsala | Lyhyt tauko sillan jälkeen |
| 16.30 | Askainen | Viimeinen huoltopiste |
| 18.00 | Aurajoen ranta | Maali |

## Reitti

Reitti kulkee Paraisten ja Nauvon kautta Korppooseen ja sieltä yhteysaluksella Houtskariin. Sunnuntaina jatketaan Iniön kautta mantereelle ja Kustavin ja Taivassalon kautta takaisin Turkuun.

### Etapit

1. Turku–Nauvo, 54 km, kaksi lauttaa.
2. Nauvo–Korppoo, 38 km, yksi lautta.
3. Korppoo–Houtskari, 41 km, yhteysalus.
4. Houtskari–Iniö, 22 km, yhteysalus.
5. Iniö–Turku, 67 km, ei lauttoja.

### Vaativat kohdat

Korppoon ja Galtbyn välinen tie on kapea, ja iltapäivällä siinä on paljon autoja lautalle menossa. Ajetaan jonossa ja pidetään väliä.

Iniön jälkeen on pitkä nousu ennen Kustavia. Huoltoauto odottaa mäen päällä.

## Lautat

Yhteysalusten pyöräpaikat varataan etukäteen Finferriesin ja Ålandstrafikenin varausjärjestelmistä. Tavallisille lautoille ei tarvitse varausta.

| Lautta | Väli | Varaus | Tila |
| --- | --- | --- | --- |
| Parainen | Lillmälö–Prostvik | Ei tarvita | — |
| Nauvo | Retais–Korppoo | Ei tarvita | — |
| Galtby | Korppoo–Houtskari | 18 pyörää | **lukittu** |
| Mossala | Houtskari–Iniö | 18 pyörää | **lukittu** |
| Heponiemi | Iniö–Kustavi | 18 pyörää | odottaa vahvistusta |

## Majoitus

Hyppeisin majatalossa on varattuna kuusi huonetta ja yksi kahdeksan hengen aitta. Huoneet jaetaan ryhmittäin; jako on erillisessä taulukossa `majoitus.csv`.

- Sauna lämpiää kello 19–22.
- Illallinen kello 20, kasvisvaihtoehto tilattu neljälle.
- Pyörät säilytetään lukitussa vajassa.

## Huolto

Huoltoauto kulkee ryhmän perässä ja kuljettaa varusteet ja varaosat. Kuljettajana Matti lauantaina ja Leena sunnuntaina.

### Varaosat

- Sisärenkaat 26", 28" ja 29", kaksi kutakin
- Ketjuöljy ja rätit
- Kaksi varajarrupalasarjaa
- Pumppu ja painemittari
- Ensiapulaukku

### Ryhmät

| Ryhmä | Vauhti | Vetäjä | Koko |
| --- | --- | --- | --- |
| A | 26–28 km/h | Ville | 9 |
| B | 22–24 km/h | Sanna | 9 |

## Sää

Jos tuulee yli 12 m/s tai sataa rankasti, sunnuntain etappi lyhennetään: Iniöstä ajetaan huoltoautolla Kustaviin. Päätös tehdään aamulla kello 7.

## Kustannukset

| Kulu | Hinta | Yhteensä |
| --- | --- | --- |
| Majoitus | 62 € / hlö | 1 116 € |
| Illallinen ja aamiainen | 38 € / hlö | 684 € |
| Lounas Nauvossa | 17 € / hlö | 306 € |
| Huoltoauton polttoaine | — | 140 € |
| Yhteensä | | 2 246 € |

Osallistumismaksu on 125 € henkeä kohden, ja seura maksaa erotuksen.

## Tarkistuslista ennen lähtöä

1. Vahvista Heponiemen lautan pyöräpaikat.
2. Lähetä osallistujille aikataulu ja majoitusjako.
3. Tarkista huoltoauton vakuutus.
4. Varmista, että jokaisella on toimiva takavalo.

## Komento aikataulun päivittämiseen

Agentti päivittää lauttojen ajat seuran skriptillä:

```sh
python3 tools/lautat.py --reitti saaristo --pvm 2027-06-12 --kirjoita aikataulu.md
```

## Avoimet kysymykset

- Ajetaanko Vartsalan silta jonossa vai odotetaanko liikennettä?
- Tarvitaanko toinen huoltoauto, jos osallistujia tulee yli 20?
- Kuka vie avaimen takaisin majataloon sunnuntaiaamuna?
