# Liitteen lähetyksen eteneminen

## Kierros 1: nykytila ja kolme esitystä

Kierros: `design-system/prototypes/rounds/2026-11-09-liitteen-eteneminen/`.
Sama komposeri ja asetelma kuin liitteen torjunnan kierroksessa
(`2026-11-08-liitteen-torjunta`). Jokaisessa suunnassa on kaksi
komposeria rinnakkain. Vasemmalla on Jarin tapaus, yksi 18,6 Mt:n video.
Oikealla on valittu tapaus, oletuksena viisi tiedostoa kerralla (28 Mt).
Lähetys on simuloitu sivun omalla kellolla, joten etenemisen voi katsoa:
*Yhteys* vaihtaa nopeutta (40 / 8 / 3 Mbit/s), *Tauko* pysäyttää kellon,
*Alusta* aloittaa alusta, *Liike* vähentää liikkeen ja *Kieli* vaihtaa
englantiin. Nyt on tuotannon `Composer` muuttamattomana. Suunnat ovat
kierroksen kopio siitä (`forkComposer.tsx`), ja kopion diff ensimmäisestä
commitista on suuntien speksi.

Akseli: missä ja missä muodossa matkalla oleva liite näkyy. Käytös on
kaikissa kolmessa suunnassa sama (alla).

0. **Nyt**: jokainen tiedosto on sirurivissä heti tekstillä *Odottaa tallennusta*, myös matkalla oleva. Kentän yllä seisoo *Tallennetaan liitettä…*, ja Lähetä ja Liitä odottavat.
1. **Rengas**: tiedosto on sirurivissä heti, ja kuvakkeen paikalla on rengas ja prosentti. ✕ peruu juuri sen tiedoston.
2. **Palkki**: tiedosto on sirurivissä heti, ja sirun alareunassa kulkee ohut palkki. Rivin alla näkyvät megatavut ja jäljellä oleva aika.
3. **Erä**: kentän yllä on yksi rivi koko erälle: monesko tiedosto, megatavut yhteensä, aika, yksi palkki ja Peru. Siru tulee vasta tallennetusta tiedostosta.

Kuvat ovat `evidence/`-kansiossa: `r1-d<n>-<suunta>-oletus-*` kaikilla
leveyksillä ja teemoilla, ja tapaukset `katkeaa`, `peruttu`, `laheta` ja
`hidas` kokoa 1440 vaaleana.

### Mitä tänään tapahtuu (koodista luettu)

Nykytila on `main`in komposeri muutoksen `attachment-total-checked-late`
jälkeen (9.11.). Kierroksen kopio on otettu siitä.

- `uploadAttachment` lähettää tiedoston `fetch`illä. Se ei kerro mitään,
  ennen kuin host vastaa. Tiedostot lähtevät yksi kerrallaan.
- Valitut tiedostot näkyvät heti siruina tekstillä *Odottaa tallennusta*,
  myös se, joka on jo matkalla. Viestin rajan (30 tiedostoa, 100 Mt) ylittävät
  jäävät siruiksi tekstillä *yli rajan*, ja yhteinen varoitus kertoo määrän.
- Lähetyksen ajan Liitä on pois käytöstä, eikä Lähetä tee mitään. Painallus
  ei kerro syytä.
- Matkalla olevan sirun ✕ ei pysäytä lähetystä. Tiedosto tallentuu silti,
  ja vastaus vain jätetään pois luonnoksesta. Sivulta poistuminen tai
  keskustelun vaihto keskeyttää lähetyksen hiljaa.
- Katkennut yhteys näyttää selaimen raa'an *Failed to fetch*
  (`r1-d0-nyt-katkeaa`). Torjunnan kierros korjaa saman asian.

### Mitä suunnat muuttavat yhteisesti

- Lähetys tehdään `XMLHttpRequest`illa, ja sen `upload.onprogress` kertoo
  lähetetyt tavut. Kun kaikki tavut ovat lähteneet, tiedosto on vaiheessa
  *tallennetaan*, kunnes host vastaa (simulaatiossa 1,2 s).
- Valitut tiedostot jonoutuvat ja lähtevät yksi kerrallaan kuten nyt.
  Liitä pysyy käytössä, ja lisätyt tiedostot menevät jonon perään.
- Lähetä lähetyksen aikana: viesti jää odottamaan ja lähtee itse, kun
  viimeinen tiedosto on tallennettu. Kentän yllä lukee *Viesti lähtee, kun
  liitteet on tallennettu.* ja vieressä on *Älä lähetä vielä*.
- Katkennut tallennus pysäyttää erän. Torjunnan kierroksen suositeltu
  varoitus nimeää tiedoston ja kertoo, kuinka pitkälle se ehti (*5,0 Mt /
  8,4 Mt*) ja montako jäi odottamaan. *Yritä uudelleen* lähettää sen ja
  odottaneet. Odottanut lähetys peruuntuu, ja varoitus sanoo, ettei viestiä
  lähetetty.
- Jo tallennetut tiedostot jäävät luonnokseen, kun jotain perutaan.
  Matkalla olevan tiedoston peruminen keskeyttää sen lähetyksen.
- Viestin rajan ylittävät tiedostot pysyvät tuotannon *yli rajan* -siruina
  ja yhteisenä varoituksena kaikissa suunnissa. Suunnat näyttävät vain
  tiedostot, jotka ovat matkalla tai jonossa.

### Mitä kukin suunta päättää

- **Rengas** on suora vastaus Jarin toiveeseen (prosentti). Tiedosto on heti
  siinä, mihin se jää, eikä mikään hyppää paikasta toiseen. Rengas on
  kontekstimittarin (`ContextRing`) muotoinen. Tallennusvaiheessa se pyörii,
  ja vähennetyllä liikkeellä se pysyy paikallaan ja sana *tallennetaan*
  kertoo vaiheen. Jäljellä olevaa aikaa ei näy.
- **Palkki** kertoo eniten yhdestä tiedostosta: megatavut ja jäljellä olevan
  ajan sirurivin alla. Palkki sirun alareunassa näkyy vain värinä, joten
  rivi on tärkeä. Puhelimessa jokainen siru vie oman rivinsä, ja tuotannon
  140 px:n korkeusraja vierittää viidennen sirun pois näkyvistä
  (`r1-d2-palkki-oletus-390-*`).
- **Erä** on yhteinen tilarivi, kuten kloonauksen eteneminen (sama palkki).
  Se kertoo koko erän ajan ja koon, mikä on hyödyllisintä monesta
  tiedostosta. Yksittäistä tiedostoa ei voi perua: Peru peruu erän loput ja
  odottavan lähetyksen. Siru syntyy vasta tallennetusta, kuten nyt.

### Host-tiedot

- **Edistyminen ei vaadi hostin muutosta.** XHR lähettää `File`-rungon
  `Content-Length`in kanssa, ja gateway hyväksyy sen kuten nyt. Virrattu
  `fetch`-runko (`duplex: "half"`) ei käy: sillä ei ole `Content-Length`iä,
  ja gateway hylkää rungon ilman sitä (`proxy_linux.go`, `ContentLength <
  0`). Osiin pilkottu lähetys vaatisi uuden hostin rajapinnan, eikä sitä
  tarvita.
- Selaimessa `mutationFetch` on ainoa paikka, josta kirjoitus lähtee (ADR
  0023, `mutations.test.ts` valvoo). XHR-lähetys tarvitsee sen viereen oman
  funktion samalle `attachment.upload`-komennolle, ja sen vastaus luetaan
  samoilla tarkistuksilla kuin nyt (skeema, koko, pituusraja).
- `upload.onprogress` mittaa tavuja, jotka ovat lähteneet selaimesta
  ensimmäiselle hypylle. Jos reunapalvelin puskuroi koko rungon (esim.
  Cloudflare), sadan prosentin jälkeen tulee tauko, jonka aikana reuna
  välittää tiedoston ja daemon kirjoittaa sen. Siksi suunnissa on vaihe
  *tallennetaan*.
- **Hitaan lähetyksen aikarajat** (kirjattu issueksi
  `attachment-upload-timeouts`): gateway antaa liitteen lähetykselle saman
  60 s:n katon kuin muillekin pyynnöille, joten 20 MiB:n tiedosto vaatii noin
  2,8 Mbit/s. Daemonin socket-palvelimen `ReadTimeout` on 5 s, ja se kattaa
  koko rungon. Puskuroiva reuna piilottaa molemmat. Ilman sitä kierroksen
  *Hidas yhteys* -tapaus (16,2 Mt nopeudella 1,5 Mbit/s, 90 s) epäonnistuisi
  oikealla hostilla. Edistymisnäkymä tekee pitkästä lähetyksestä näkyvän,
  joten nämä kannattaa korjata ennen toteutusta tai samalla.

### Selitystilan kortit (luonnos)

- *Peru tiedoston liittäminen* (Rengas, Palkki: ✕ matkalla olevassa
  sirussa): "Lopettaa tämän tiedoston lähettämisen. Jo tallennetut liitteet
  jäävät viestiin, ja jonossa olevat jatkavat."
- *Peru* (Erä): "Lopettaa liittämisen. Jo tallennetut liitteet jäävät
  viestiin. Jos painoit Lähetä, viesti jää lähettämättä."
- *Älä lähetä vielä*: "Viesti odottaa liitteitä ja lähtee itse, kun ne on
  tallennettu. Tästä viesti jää kenttään, ja voit lähettää sen myöhemmin."

### Päätökset myöhempää arviota varten

- **Lähetä odottaa liitteitä** eikä ole pois käytöstä. Vaihtoehdot: Lähetä
  pois käytöstä syyn kera, tai lähetys ilman keskeneräisiä liitteitä. Valitsin
  odottamisen, koska painaja tarkoittaa viestiä liitteineen. Lisäksi
  komposerissa on jo sama ajatus näkymälle, joka ei ole valmis
  (`sendWhenReady`).
- **Katkos pysäyttää erän** eikä jatka seuraavaan tiedostoon. Vaihtoehto:
  muut tiedostot jatkavat. Katkos koskee yleensä kaikkia, ja yksi varoitus
  yhdellä *Yritä uudelleen* -painikkeella on selkeämpi kuin monta
  peräkkäistä virhettä.
- **Erän Peru peruu myös odottavan lähetyksen.** Yhden tiedoston ✕ ei peru
  sitä. Koko erän perunut ei luultavasti halua viestin lähtevän ilman
  liitteitä.
- **Liitä pysyy käytössä** lähetyksen aikana, ja uudet tiedostot menevät
  jonon perään. 30 tiedoston raja laskee mukaan myös jonossa olevat.
- **Jäljellä oleva aika** näytetään vasta, kun nopeutta on mitattu kaksi
  sekuntia. Se pyöristetään (*noin 25 s*, *noin 2 min*, alle 10 s:n kohdalla
  *hetki jäljellä*). Palkki laskee ajan tiedostolle viimeisten kolmen
  sekunnin nopeudesta, Erä koko erälle keskinopeudesta.
- **Peruttu tiedosto katoaa ilman ilmoitusta**, koska peruminen oli oma teko.

### Kysymykset Jarille

1. Mikä kolmesta? Vai yhdistelmä, esimerkiksi Rengas, jossa pitkän
   lähetyksen prosentin perään tulee aika (*42 % · noin 2 min*)?
2. Saako viesti lähteä itse, kun liitteet valmistuvat, vai pitäisikö
   Lähetä olla pois käytöstä, kunnes liitteet ovat perillä?
3. Korjataanko hitaan lähetyksen aikarajat (gatewayn 60 s ja daemonin 5 s)
   samalla, kun edistyminen toteutetaan?

**Suositus: Rengas.** Se näyttää prosentin, jota Jari pyysi, siinä
paikassa, johon tiedosto jää. Jokaisen tiedoston voi perua erikseen, ja se
vie vähiten tilaa. Palkin ja Erän megatavut ja aika ovat hyödyllisiä
hitaalla yhteydellä. Ne voi lisätä Renkaaseen vain pitkille lähetyksille,
jos Jari haluaa (kysymys 1).

## Jarin päätös (9.11.2026)

**Rengas.** Viesti ei lähde itsestään, kun liitteet valmistuvat: se lähtee
vasta, kun käyttäjä painaa Lähetä, ja Lähetä on pois käytöstä, kunnes
liitteet ovat perillä (automaattinen lähtö tuntui oudolta). Muut
huomatut asiat korjataan: hitaan latauksen aikarajat
(`attachment-upload-timeouts`). Toteutus: `attachment-upload-progress`.
