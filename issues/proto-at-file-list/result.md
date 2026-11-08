# @ ja Tiedosto-nappi

## Kierros 1: nykyiset kaksi avausta ja kolme tapaa yhdistää ne

Kierros: `design-system/prototypes/rounds/2026-11-08-at-tiedostolista/`.
`NOTES.md` kertoo nykytilan erot taulukkona. Jokaisessa suunnassa on kaksi
komposeria rinnakkain samalla luonnoksella: vasemmalla painettu
*Tiedosto*-nappia ja oikealla kirjoitettu `@`, kummassakin sen perään `sha`.
Yläreunan *Tila* näyttää saman Escin ja Enterin jälkeen. Nyt ja Vanha ovat
tuotannon `Composer` muuttamattomana (kokeilu *Listat kirjoituskentän
sisällä* päällä ja pois). Suunnat 2–4 ovat kierroksen kopio siitä, ja kopion
diff on suunnan speksi.

Akseli: avaavatko nappi ja kirjoitettu `@` saman listan, ja jos avaavat, kumman
muodon.

0. **Nyt**: nappi avaa listan omalla hakurivillä, jossa Tab merkitsee ja → näyttää kansiossa; kirjoitettu @ suodattaa tekstistä, Tab lisää ylimmän ja Ctrl+P siirtää napin listaan.
1. **Vanha** (kokeilu pois päältä): napin lista kentän yllä omalla haullaan, @-lista kursorin kohdalla ilman hakua ja puuta; useampi ja esikatselu vain Ctrl+P-valitsimessa.
2. **Hakuun**: kirjoitettu @ avaa napin listan ja kirjoitus jatkuu sen hakuun; @ odottaa tekstissä valintaa, Esc jättää sen ja askelpalautin tyhjässä haussa poistaa sen.
3. **Kenttään**: nappi kirjoittaa @:n tekstiin ja teksti suodattaa; molemmat avaavat nykyisen @-listan, jossa Tab lisää ylimmän ja useampi merkitään vain ruuduista.
4. **Yhteinen**: kuten Kenttään, mutta listassa on napin hakurivi ja näppäimet; haku on tekstin @-sana, Tab merkitsee ja → näyttää kansiossa.

Nykytilassa (kokeilu päällä) rivit, järjestys, puu, esikatselu ja lisäys
ovat samat. Erot ovat siinä, mihin kirjoitus menee (hakuriviin vai
tekstiin), mitä Tab tekee (merkitsee vai lisää ylimmän), toimivatko → ja ←
kansioissa, jääkö haku Escin jälkeen tekstiin ja mitä Ctrl+P tekee.
Kummankin listan välilehti ja aloitustila ovat samat.

Mitä kukin päättää:

- *Hakuun*: lista on aina napin lista. Kirjoitettu `sha` ei näy tekstissä,
  ja Esc hävittää sen (`@` jää). Pi:n päätteen `@sha` + Tab katoaa.
- *Kenttään*: kirjoitus on aina tekstissä, mutta napin listan Tab-merkintä
  ja → kansioon katoavat.
- *Yhteinen*: kirjoitus on aina tekstissä, ja napin listan näppäimet
  säilyvät. Tab merkitsee eikä täydennä; Enter lisää ylimmän.

### Suositus

**Yhteinen.** Molemmat avaukset antavat saman listan, ja kirjoitus menee
aina sinne, minne se lopulta päätyy: tekstiin. Esc ei hävitä kirjoitettua,
ja Tab-merkintä, → kansioon ja esikatselu säilyvät. Hinta on, että Tab
merkitsee kuten napin listassa nyt eikä täydennä kuten Pi:n päätteessä.

### Host-tiedot

Ei uutta hostin tietoa. Suunnat käyttävät nykyisiä lukuja `file_tree`,
`files?…&rank=name` ja `file_preview`. Muutos on kokonaan selaimen
komposerissa.

### Kysymykset Jarille

1. Mikä suunnista: Hakuun (`r1-d2-hakuun-kirjoitettu-1440-light`),
   Kenttään (`r1-d3-kenttaan-kirjoitettu-1440-light`) vai Yhteinen
   (`r1-d4-yhteinen-kirjoitettu-1440-light`)?
2. Saako Tab merkitä kirjoitetussa `@`-listassa
   (`r1-d4-yhteinen-tab-merkitsee-1440-light`), vai pitääkö sen täydentää
   ylin kuten Pi:n päätteessä (`r1-d3-kenttaan-valittu-1440-light`)?
3. Jos Hakuun: kelpaako, että Esc hävittää haun ja jättää pelkän `@`:n
   (`r1-d2-hakuun-esc-1440-light`), vai pitääkö haun siirtyä tekstiin?

### Todisteet

`evidence/`, etuliite `r1-`: jokaisesta suunnasta oletusnäkymä (`kirjoitettu`)
1440 ja 390, vaaleana ja tummana, sekä Escin (`esc`) ja Enterin
(`valittu`) jälkeen vaaleana kummallakin leveydellä. Lisäksi 1440 vaaleana
on Tab-merkintä ja → kansioon (Nyt, Hakuun, Yhteinen), Vanhan Ctrl+P-valitsin
ja Nytin Ctrl+P kirjoitetusta listasta. Kuvat on otettu kertoimella 2.
Kierroksen `check.mjs` ajoi 357 tarkistusta (mihin kirjoitus meni, mitä Esc
jättää, mitä Enter kirjoittaa, ovatko yhdistävien suuntien kaksi listaa samat,
Tab, →, askelpalautin ja napin painaminen uudelleen), ja konsoli oli puhdas.
Kyseessä on synteettinen komponenttilabra, jota ei ole ajettu hostia vasten.

### Näyttäminen

```
node design-system/prototypes/rounds/2026-11-08-at-tiedostolista/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/at-tiedostolista/offline.html \
  --title "@ ja Tiedosto-nappi – kierros 1" \
  --idempotency-key "$(uuidgen)" --json
```
