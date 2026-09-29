# Aamun UI-katselmus — synteettinen laboratorio

Yön työn jälkeen ensikäytön repo- ja Pi-kirjautumispolku on selkeämpi, paluunäkymä kertoo milloin keskustelu on vain luettavissa, ja työtilan historia on tiiviimpi ja näyttää Markdownin sekä koodin luettavasti. Uudessa keskustelussa Pi:n työ ja vastaus erottuvat, hylätty viesti jättää luonnoksen talteen ja katkos säilyttää viimeksi vahvistetun sisällön vanhentuneeksi merkittynä. Tilivalikosta voi nyt valita järjestelmän, vaalean tai tumman teeman. Kuvat on otettu tämän työpuun nykyisestä päähaaran pohjasta `b132481` uuden tuotantobundlen kautta; aiemmat neljä [UX-katselmusta](../decidedly-loud-station/audit.md) ([2](../relatively-robust-flower/audit.md), [3](../unduly-grateful-slip/audit.md), [4](../extremely-impartial-spiders/audit.md)) kertovat, miksi näitä muutettiin.

**Mitä laboratorio näyttää:** paikallinen HTTPS-selainlaboratorio käyttää keksittyä Alicea, valekirjautumista GitHubiin, keksittyä repo- ja työtiladataa sekä vale-Pi:tä, mutta uuden keskustelun taustalla on oikea sovelluksen keskusteluohjain. Siksi siinä voi tarkastella selaimen kulkua, luonnoksen säilymistä ja synteettisen työn etenemistä; se ei todista oikean palveluntarjoajan kirjautumista, oikeaa Pi:tä eikä eri Linux-käyttäjien eristystä.

Kaikki alla olevat kuvat ovat tuoreita **synteettisiä** Chromiumin 1440 × 900 -näkymiä, ellei leveydestä tai teemasta toisin sanota. Kuvat näyttävät hetken, eivät testaa koko saavutettavuutta.

## 1. Kirjautuminen

![Kirjautumissivu](images/signin.avif)

Katso, löytyykö ainoa etenemistoiminto heti ja kertooko sivu ymmärrettävästi mihin ollaan kirjautumassa.

## 2. Ensikäyttö: repot ja Pi-kirjautuminen

![Repojen valinta](images/chooser.avif) ![Pi-kirjautumisen aloitus ja keskeytys](images/pi-start.avif)

Repojen valinta on vapaaehtoinen, ja Pi-kirjautumisen aloittaminen on ensisijainen toiminto; käyttöönoton keskeytys ja uloskirjautuminen ovat erillinen hillitty toiminto. Yrityksen käynnistyttyä valmisteluvaiheessa on oma peruutus, jota ei pidä sekoittaa uloskirjautumiseen: ![Kirjautumisyrityksen valmistelu](images/pi-code.avif). Kuvassa ei vielä ole laitekoodia. **Jari: ovatko etenemisen ja keskeytyksen painot oikeat?**

## 3. Paluu ja aloitus

![Paluunäkymä](images/landing.avif) ![390 pikselin paluunäkymä](images/narrow-landing.avif)

Paluulinkki kertoo, milloin avataan vain luettavaa historiaa eikä käynnistetä Pi:tä. Katso erityisesti, löydätkö jatkettavan työn ilman että työtilalista toistuu pääsisällössä. **Jari: antaako tämä etusivu oikean lupauksen palaajalle?**

## 4. Työtila ja historia

![Työtila](images/workspace.avif) ![Markdown ja koodi historiassa](images/history.avif)

Työtilasta pääsee natiivihistoriaan; viestit muodostavat luettavan virran ja Markdownin koodilohko pysyy omana kopioitavana sisältönään. Vertaile myös [390 pikselin historiaa](images/narrow-history.avif) ja [tummaa historiaa](images/system-dark-history.avif). **Jari: onko lukutiheys nyt sopiva, myös kapeassa näkymässä?**

## 5. Uusi keskustelu → työ → vastaus

![Uusi keskustelu](images/chat-new.avif) ![Pi työskentelee](images/chat-working.avif) ![Valmis vastaus](images/chat-answer.avif)

Tyhjä kirjoitusnäkymä on pääasia; `hidas` näyttää työn edistymisen ennen valmista vastausta. **Jari: näkyykö ero odotuksen ja valmistumisen välillä riittävän selvästi?**

## 6. Hylätty lähetys

![Hylätty viesti ja säilynyt luonnos](images/chat-rejected.avif)

`hylkää` näyttää hylkäyksen ja pitää kirjoitetun tekstin kentässä; uutta lähetystä ei tehdä itsestään. Katso, onko palautumistoiminto ymmärrettävä ilman teknistä selitystä.

## 7. Katkos ja vanhentunut tieto

![Vanhentuneeksi merkitty historia katkon aikana](images/outage.avif)

Katkos tuotiin jo avatun historian päälle. Luettu sisältö pysyy nähtävissä, mutta se on merkitty vanhentuneeksi eikä uutta työtä pidä tehdä sen perusteella. **Jari: huomaatko varoituksen ilman että se peittää itse historian?**

## 8. Tilivalikko, teema ja asetukset

![Tilivalikon teemavalinta](images/menu.avif) ![Tumma teema](images/theme-dark.avif) ![Asetukset](images/settings.avif)

Valikossa voi vaihtaa teemaa; erillinen [järjestelmän tummaa asetusta seuraava näkymä](images/system-dark-landing.avif) näyttää oletuksen ilman käsivalintaa. **Jari: toimiiko tumma kontrasti ja löytyykö teemavalinta oikeasta paikasta?**

## Auki ja todistamatta

- [@decide-account-display](../decide-account-display/item.md): Jarin päätös siitä, näytetäänkö vahvistettu, ihmisen tunnistama tilin nimi ja miten keskustelujen osoitteet yhtenäistetään. Nyt geneerinen *Oma tili* ei yksilöi käyttäjää.
- `pilot.13` ei ole testipalvelimella: uudelleen rakennetun VM:n vaihto- ja palautusoperaattori odottaa Jarin hyväksyntää Fleetrepossa. Tämä kuvakierros ei muuta julkaisutilannetta.
- Ei live-palvelinta, oikeaa Pi:tä tai palveluntarjoajaa. Laboratorion host ajaa saman UID:n piirissä; nämä kuvat eivät todista käyttäjien välistä eristystä. Ei täyttä CI-porttia, ruudunlukijakierrosta eikä todellista monikäyttäjäympäristöä tämän dokumenttikierroksen perusteella.
