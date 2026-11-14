# 31.10. päätöksistä kolme huomion arvoista

Tarkistettu 14.11.2026: kaikki koonnin 53 ★-kohtaa suhteessa main-haaraan
(`d9487255`), myöhempiin päätöksiin, avoimiin töihin ja tuotteen nykyiseen
suuntaan. Alla ovat edelleen voimassa olevat valinnat, eivät toteutumattomat
tutkimusehdotukset. Tämä on suositus, ei uusi päätös.

## 1. Uuden keskustelun avaaminen voi jättää vanhan ilman tilannekatsausta

**Valinta:** Kun samanaikaisten keskustelujen paikat täyttyvät, uusi keskustelu
saa paikan pysäyttämällä joutilaana olevan agentin. Sen vielä odottavaa
automaattista katsausta ei tehdä myöhemmin samalla tavalla kuin tavallisen
lepotauon jälkeen.

**Ihmiselle:** Valmistuneen työn yhteenveto voi jäädä tulematta juuri silloin,
kun töitä on paljon. Keskusteluhistoria ei katoa, ja katsauksen voi pyytää itse.

**Vaihtoehto:** Katsaus jää odottamaan vapaata paikkaa ilman, että agenttia
pidetään sen vuoksi käynnissä.

**Suositus: muuta — uuden työn aloittamisen ei pitäisi perua toisen työn yhteenvetoa.**

Tarkistus: alkuperäinen `recap-settings-polish-3`;
`internal/daemon/pi_activity_linux.go`, `makeRoom` ja `stopExpiredIdlePi`.
Vain jälkimmäinen siirtää odottavan katsauksen tehtäväksi pysäytyksen jälkeen.

## 2. Kesken katkennut työ jää näkyviin, kunnes jatkat tai arkistoit

**Valinta:** Palvelimen katkaisema keskustelu pysyy Käynnissä-listalla myös
pitkän ajan jälkeen. Erillistä kuittausta ei ole: rivin saa pois jatkamalla
keskustelua tai arkistoimalla sen.

**Ihmiselle:** Kesken jäänyt tehtävä ei unohdu päivityksen jälkeen. Toisaalta
listalle voi jäädä vanha työ, jota et halua jatkaa mutta et myöskään siirtää
arkistoon. Arkistointi säilyttää historian.

**Vaihtoehto:** Erillinen kuittaus siirtäisi keskustelun Hiljaisiin ilman uutta
viestiä tai arkistointia.

**Suositus: säilytä — keskeneräisen työn muistaminen on tärkeämpää kuin listan automaattinen siistiminen.**

Tarkistus: `rail-interrupted-turn-hidden-1` ja `-3`;
`web/src/app/railNow.ts`, keskeytyneen vuoron luokittelu, sekä
`docs/product.md`, Returning to work and finding your way.
Myöhempi keskeytyksen syyn tarkennus ei poistanut tätä sääntöä.

## 3. Viime hetkellä lähetetty ohjaus aloittaa tarvittaessa uuden vuoron

**Valinta:** Jos lähetät selaimessa ohjeen agentin vielä näyttäessä
kiireiseltä mutta agentti ehtii valmistua ennen viestin saapumista,
viesti aloittaa uuden työvuoron. Sitä ei hylätä myöhästyneenä.

**Ihmiselle:** Viesti menee perille ilman uutta lähettämistä. Esimerkiksi
”älä muuta sitä tiedostoa” voi kuitenkin saapua vasta muutoksen jälkeen:
ohjaus ei ole lupaus jo tehdyn työn estämisestä tai kumoamisesta.

**Vaihtoehto:** Palauta myöhästynyt ohjaus kenttään ja pyydä ihmistä
lähettämään se uutena tehtävänä.

**Suositus: säilytä — viestin toimittaminen on parempi oletus kuin lähetyksen hylkääminen ajoituksen vuoksi.**

Tarkistus: `enter-sends-twice-1`;
`internal/daemon/conversation_linux.go`, `admitMessage` ja selaimen
`idleStarts`-ehto. Sääntö koskee selaimen lähetystä, ei kaikkia agenttien ohjauskomentoja.

Pois jäi 49 ★-kohtaa myöhemmin korvautuneina tai ratkaistuina taikka tämän katselmoinnin kannalta vähäisinä; mukana ovat myös tutkimusehdotukset, joista ei tullut voimassa olevaa valintaa.

## Verdict (Jari 14.11.2026)

Item 2 (interrupted work stays in Käynnissä until continued or archived) and item 3 (a late steer starts a new turn): keep, as they are. Item 1 filed as `recap-lost-when-making-room`. The decisions made after 31.10. get the same distilling review (`decisions-review-after-31-10`).
