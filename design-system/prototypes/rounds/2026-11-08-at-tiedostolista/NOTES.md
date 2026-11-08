# @ ja Tiedosto-nappi – kierros 1

Issue `proto-at-file-list`. Jari 8.11. testipalvelimella: kirjoitettu `@` ja
Tiedosto-nappi avaavat hieman eri tiedostolistan, mikä tuntuu oudolta.

Akseli: avaavatko nappi ja kirjoitettu `@` saman listan, ja jos avaavat, kumman
muodon.

0. **Nyt**: nappi avaa listan omalla hakurivillä, jossa Tab merkitsee ja → näyttää kansiossa; kirjoitettu @ suodattaa tekstistä, Tab lisää ylimmän ja Ctrl+P siirtää napin listaan.
1. **Vanha** (kokeilu pois päältä): napin lista kentän yllä omalla haullaan, @-lista kursorin kohdalla ilman hakua ja puuta; useampi ja esikatselu vain Ctrl+P-valitsimessa.
2. **Hakuun**: kirjoitettu @ avaa napin listan ja kirjoitus jatkuu sen hakuun; @ odottaa tekstissä valintaa, Esc jättää sen ja askelpalautin tyhjässä haussa poistaa sen.
3. **Kenttään**: nappi kirjoittaa @:n tekstiin ja teksti suodattaa; molemmat avaavat nykyisen @-listan, jossa Tab lisää ylimmän ja useampi merkitään vain ruuduista.
4. **Yhteinen**: kuten Kenttään, mutta listassa on napin hakurivi ja näppäimet; haku on tekstin @-sana, Tab merkitsee ja → näyttää kansiossa.

Suositus: **Yhteinen**.

Jokaisessa suunnassa on kaksi komposeria rinnakkain samalla luonnoksella
(puhelimessa allekkain). Vasemmalla on painettu *Tiedosto*-nappia, oikealla
kirjoitettu `@`, ja kummassakin sen jälkeen `sha`. Yläreunan *Tila* näyttää
saman Escin tai Enterin jälkeen, ja *Alusta* toistaa avaukset. Kummallakin
puolella voi jatkaa kokeilemista itse: painallus toisessa sulkee toisen listan
kuten tuotannossa painallus komposerin ulkopuolelle.

Nyt ja Vanha ovat tuotannon `Composer` muuttamattomana, kokeellinen
*Listat kirjoituskentän sisällä* päällä ja pois. Suunnat 2–4 ovat kierroksen
kopio siitä (`forkComposer.tsx`, `forkFieldList.tsx`). Kopio on ensin
commitoitu sellaisenaan, joten sen diff seuraavaan commitiin on suuntien
speksi. Työtila on synteettinen `aurinkokello`.

## Nykytila: mikä eroaa

Kokeilu päällä molemmat avaavat saman `FieldList`-listan kentän sisään.
Rivit, järjestys, puu ilman hakua, esikatselu, otsikko ja lisäys
(`@polku `) ovat samat, ja molemmat alkavat tiedostoista. Erot:

| | Nappi | Kirjoitettu `@` |
|---|---|---|
| Mihin kirjoitus menee | listan omaan hakuriviin, teksti ei muutu ennen valintaa | tekstiin `@`:n perään |
| Tab | merkitsee ja siirtyy seuraavaan | lisää ylimmän (Pi:n päätteen tapa) |
| Usean valinta | Tab tai ruutu | vain ruutu hiirellä |
| → ja ← | avaa ja sulkee kansion; haussa → näyttää kansiossa | liikuttavat kursoria tekstissä |
| Esc | takaisin tekstiin samaan kohtaan, haku katoaa | sulkee, `@sha` jää tekstiin |
| Ctrl+P | vaihtaa komentoihin | siirtää napin listaan ja vie `sha`:n hakuun |
| Välilyönti | menee hakuun | päättää `@`-sanan ja sulkee listan |
| Sulkeutuu | painalluksesta tekstiin tai ulkopuolelle | kun kohdistus lähtee kentästä |

Kokeilu pois (Vanha): nappi avaa listan kentän *yläpuolelle* omalla
haullaan, ja kirjoitettu `@` avaa saman näköisen listan kursorin kohdalle
ilman hakuriviä. Kummassakaan ei ole puuta, esikatselua eikä merkintää.
Haku näyttää koko polun sumean osuman mukaan (ei nimeä ensin). Ctrl+P avaa
erillisen valitsimen koko näkymän päälle (Kaikki, Muutetut, Komennot,
esikatselu ja useampi). Tab lisää ylimmän kummassakin.

## Mitä kukin suunta päättää

- **Hakuun** tekee kirjoitetusta `@`:sta napin pikanäppäimen. Lista on aina
  napin lista, joten Tab, → ja Ctrl+P toimivat aina samoin. Kirjoitettu
  `sha` ei kuitenkaan näy tekstissä, vaan teksti näyttää pelkän `@`:n
  valintaa odottamassa. Pi:n päätteen tapa (`@sha` + Tab täydentää) katoaa.
  Escin jälkeen `@` jää tekstiin ja haku katoaa. Sen perään kirjoitettu
  sana on tavallista tekstiä, joten sähköpostiosoitteen tai `@nimen` voi
  kirjoittaa Escin jälkeen. Askelpalautin tyhjässä haussa poistaa `@`:n ja
  palaa tekstiin.
- **Kenttään** tekee napista `@`:n kirjoittajan. Kirjoitus näkyy aina
  tekstissä, ja Esc jättää sen sinne. Lista on nykyinen `@`-lista, joten
  napin listan Tab-merkintä, → kansioon ja haku kansiossa katoavat, ja
  useamman voi merkitä vain ruuduista. Ctrl+P kirjoittaa myös `@`:n. Nappi
  uudelleen ilman kirjoitettua hakua ottaa `@`:n pois.
- **Yhteinen** on Kenttään ja napin lista yhdessä. Haku on tekstin
  `@`-sana, ja listan hakurivi näyttää sen (siihen ei kirjoiteta, vaan
  tyhjänä se neuvoo kirjoittamaan `@`:n perään). Näppäimet ovat napin
  listan: Tab merkitsee, Enter lisää, → kursorin ollessa sanan lopussa
  näyttää haun tiedoston kansiossa ja ← heti `@`:n jälkeen siirtyy ylempään
  kansioon. Esc jättää `@sha`:n tekstiin. Tab ei enää täydennä ylintä kuten
  Pi:n päätteessä; Enter tekee sen.

## Suositus

**Yhteinen.** Jarin havainto oli, että kaksi tapaa avata tiedostolista
antaa kaksi eri listaa. Yhteisessä molemmat avaavat saman listan, ja
kirjoitus menee aina samaan paikkaan, tekstiin, jonne se lopulta päätyy.
Escin jälkeen kirjoitettu ei katoa, mikä Hakuun-suunnassa tapahtuu. Napin
listan hyvät osat (Tab-merkintä, → kansioon, esikatselu) jäävät, toisin kuin
Kenttään-suunnassa. Hinta on Tab: Pi:n päätteessä Tab täydentää, täällä se
merkitsee, kuten napin listassa nyt. Enter lisää ylimmän, joten täydennys
on yhden näppäimen päässä.

## Host-tiedot

Ei uutta hostin tietoa. Kaikki suunnat käyttävät samoja lukuja kuin nyt:
`file_tree` puulle, `files?…&rank=name` haulle ja `file_preview`
esikatselulle. Muutos on kokonaan selaimen komposerissa.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-08-at-tiedostolista/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-08-at-tiedostolista/check.mjs \
  design-system/prototypes/dist/at-tiedostolista/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci` tai linkki
päächeckoutin samaan lukkoon).
