# Tulos

Kierros pitää nyt kirjaa siitä, mitä palvelin listaa. Kun kierroksen
keskustelu arkistoidaan tai katoaa listauksesta, se poistuu jonosta. Paikka
pysyy samalla askeleella tai siirtyy edelliseen, jos poistettu oli se, jolla
oltiin, joten *Seuraava* vie yhä seuraavaan. Kun jäljelle jää pelkkä
lähtökeskustelu, kierros päättyy itsestään yhteenvetoon *Kierros käyty: N
hoidettu*. Arkistoidut lasketaan hoidetuiksi. Käytetään vain vahvistettua
listausta, ja keskustelu lasketaan kadonneeksi vasta, kun se on kerran nähty
listauksessa. Siksi juuri luotu lähtökeskustelu, joka ei vielä ole
listauksessa, ei päätä kierrosta.

Jonon näppäinvihjeet (aloitusrivi, jonon ↑/↓-painikkeet ja niiden
vihjetekstit sekä Kokeelliset-kortin kuvaus) ovat Macilla ⌥↓ / ⌥↑ ja muualla
Alt+↓ / Alt+↑ (`web/src/components/altKey.ts`). `aria-keyshortcuts`
pysyy standardimuodossa `Alt+ArrowDown`.

Todisteet: `web/src/app/nextWaiting.test.ts` (poisto, paikka, itsestään
päättyminen, lähdön arkistointi, listaamaton lähtö).
`web/tests/next-waiting-row.spec.ts` sisältää uuden tapauksen: Mac-alusta,
kierros, molemmat odottavat arkistoidaan sivupalkista, jono katoaa ja
yhteenveto näkyy. Tapaus kaatuu ilman korjausta. Vanha tapaus tarkistaa
Alt-muodon muulla kuin Macilla.

## Decisions for later review

- **Kierros päättyy vain, kun jäljellä on pelkkä lähtö.** Vaihtoehto:
  päättää kierros myös, kun mikään jäljellä oleva ei enää odota. Hylätty,
  koska viimeinen askel muuttuu luetuksi heti avattaessa, jolloin jono
  katoaisi kesken lukemisen ja *Lähtöön*-tie häviäisi.
- **Lähdön arkistointi päättää koko kierroksen.** Vaihtoehto: jatkaa ilman
  lähtöä. Hylätty, koska kierroksen loppu vie lähtöön, eikä arkistoitua
  voi avata.
- **Arkistoitu lasketaan yhteenvedossa hoidetuksi.** Arkistointi on tapa
  hoitaa keskustelu. Jos arkistointi myöhemmin perutaan (palvelin hylkää),
  askel ei palaa kierrokseen.
- **Kokeelliset-kortin kuvaus käyttää samaa ⌥/Alt-muotoa**, koska se kuvaa
  samoja jonon näppäimiä.
