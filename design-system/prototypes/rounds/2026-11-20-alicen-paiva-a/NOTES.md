# Alicen päivä, kierros 3 (a) – päivä yhden palaverin tai asiakkaan ympärillä (20.11.2026)

Jatkoa kierrokselle `2026-11-19-etusivu-kierros-2`, josta Jari piti "Alicen
päivää". Kolme workeria tekee kukin kolme tarinaa samasta pyynnöstä; tämä on
worker **a**, ja sen linssi on päivä, jota kantaa yksi palaveri tai yksi
asiakas: myynti, asiakastyö ja pienen yrityksen ulkopuoliset ihmiset.

Yläosa on kierroksen 2 kiinnitetty hero (sama kuvan keskitys `build.mjs`:ssä),
sen alla päivä ja lyhyt tynkä ("One server…") sekä alatunniste. Päivän rakenne
on kierroksen 2 Alicen päivä: luvut kellonaikoineen vasemmalla, oikealla
tahmea ruutu, joka vaihtuu luvun mukaan; puhelimessa ruutu on luvun alla.
Ruudut on piirretty kirjaston keskustelukielellä (`lib/language.css`:n kuplat,
työkalurivit, diff, taulukot) ja kierroksen omilla paloilla (postiluonnos,
kalenteri, workerit, näkymä, puhelin, "While you were away"), jotta ne voi
myöhemmin kaapata labista. Jokaisessa luvussa on Alicen pyyntö omin sanoin,
mitä agentti tekee, mitä palaa ja "Why a real computer" -rivi. Päivän alussa on
kolme "Things that come back" -painiketta; painettu korostaa luvut, joissa asia
ilmestyy tai palaa. Asennus, kirjautuminen ja yhteyksien liittäminen on jätetty
pois. Ruudut näyttävät vain valmiita yhteyksiä (Gmail, Google-kalenteri ja
-Drive, Dropbox, omat tiedostot), eikä mitään lähetetä tai muuteta oman kansion
ulkopuolella ilman Alicen lupaa samassa kohtauksessa.

1. **Palaverin kaari.** Alicen torstai on yksi asiakaspalaveri (Northwind
   Bakery): valmistelu asiakaskansiosta, postista ja kalenterista, kalvot
   hinnastosta ohjelmalla ja näkymänä, kysymys puhelimella kesken palaverin
   (takuu vanhasta sopimus-PDF:stä), nauhoitteesta muistio, tehtävät ja
   asiakaskortin muutos diffinä, tarjous-PDF ja seurantaposti hänen luvallaan.
   Palaavat: Tomin kysymys (aamun posti → kalvo 5 → tarjous), haalistunut
   kyltti (palaveri → tehtävä 3 → maksuton korjaus tarjouksessa), 5.12.
   (muistio → muistutus kalenteriin).
   Käyttötapaukset: 21, 13, 29, 27, 20, 23, 24.
2. **Reklamaatio.** Alicen tiistai on yksi tyytymätön asiakas (Fernhill):
   aamun valitus kansioksi alkuperäisine viesteineen ja aikajanoineen, vedos
   ja painotiedosto verrataan ohjelmalla (väärä vientiasetus), agentti
   kirjoittaa tarkistimen ja ajaa sen kuun 31 työlle, vastaus Priyalle
   Alicen kahdella muutoksella diffinä ja toimitus kalenteriin, ja välilehden
   sulkemisen jälkeen sama tarkistin hyväksyy uusintapainoksen ja posti
   painolle lähtee, koska Alice käski.
   Palaavat: lauantai (määräaika → perjantain toimitus), vientiasetus
   (löytö → tarkistin → uusintapainoksen tarkistus), kaksi muuta työtä
   (löytö → luonnos Benille).
   Käyttötapaukset: 34, 15, 56 (työkalu, koska valmista ei ollut).
3. **Tarjouspyyntö.** Alicen maanantai on yksi kunnan tarjouspyyntö
   (Easthaven): 23 liitettä luetaan ohjelmilla sivuviittein, hinnaston ja
   sopimuksen ristiriita kysymykseksi (kaksi kysymystä jätetään pois, koska
   vastaukset julkaistaan kilpailijoille), neljä workeria käy 146 vanhaa
   projektia referensseiksi, Samin 17 Word-kommenttia yksi kerrallaan
   lokiin, kysymykset kunnalle Alicen luvalla ja määräajat kalenteriin, ja
   hintataulukko täyttyy illalla muutoslistoineen.
   Palaavat: 25.11. (kysymysten määräaika → lähetetty viisi päivää ennen),
   lupamaksut (ristiriita → kysymys 1 → Samin kommentti odottaa → rivi 14
   jää auki), kolme referenssiä (vaatimus → workerien lista → Sam valitsee
   saman).
   Käyttötapaukset: 25, 28, 22, 8.

Ihmiset, yritykset ja osoitteet ovat keksittyjä (`example.org`); mikään
lähderaporttien todellinen yksityiskohta ei ole sivulla. Komentorivit ovat
havainnollisia (`gog`, `rclone`, `pdftotext`, pienet Python-työkalut), eivät
labista kaapattuja.

## Rakentaminen ja tarkistus

```
TMPDIR=<oma scratch> node design-system/prototypes/rounds/2026-11-20-alicen-paiva-a/build.mjs <out.html>
PROTO_WEB=<web-hakemisto, jossa node_modules> \
  node design-system/prototypes/rounds/2026-11-20-alicen-paiva-a/check.mjs <out.html> <kuvahakemisto>
```

`build.mjs` tarvitsee ImageMagickin (`convert`, `identify`); tulos on noin
0,5 Mt. `check.mjs`:n tarkistukset on lueteltu sen alussa.
