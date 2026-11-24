# Ajat keskustelussa

## Kierros 2

Kierros: `design-system/prototypes/rounds/2026-11-24-times-conversations-2/`
(rakennus ja tarkistus: `NOTES.md`). Tuotantokomponentit ovat
muuttamattomia, ja data on synteettistä. Sama keskustelu kuin
kierroksella 1.

Lähtökohta on päätöksesi kierroksesta 1: B Kello ja päiväerottimet.
Kierros tutkii sen päällä kahta asiaa: missä aika on viestissä ja miten
pitkä vuoro päättyy. Jokainen suunta yhdistää yhden paikan ja yhden
loppusäännön. Sivupalkin ikä jää kuluneeksi ajaksi, kuten päätit.

Ennen suuntia yksi havainto. Tuotannon työrivi mittaa vaiheen edellisestä
merkinnästä vaiheen päättävään vastaukseen. Yksivaiheisessa vuorossa se
on siis täsmälleen vuoron kesto: ”2 työkalua · 23 min 05 s” on
vastauskortin yläpuolella jo nyt. Loppurivi tuo uutta tietoa vain
monivaiheiseen vuoroon (välivastauksen jälkeen työrivit näyttävät
vaiheet, eivät summaa). Muuten se kokoaa saman tiedon sinne, mihin
silmä päätyy: vuoron loppuun valmistumisajan viereen. Vastauksen aika on
jo valmistumisaika, koska host tallentaa vastauksen vasta valmiina, joten
loppurivi ei saa toistaa sitä.

- **Nyt (kierroksen 1 B).** Aika otsakkeessa: sinun viestissäsi
  kopioi-painikkeen jälkeen, agentin vastauksessa oikeassa reunassa.
  Loppuriviä ei ole. Kesto on työrivillä ja loppuaika vastauksen ajassa.
- **A Otsake.** Aika heti nimen perässä kummankin viesteissä (”Sinä
  16.40”, ”✓ Vastaus valmis 17.03”), kopioi-painike sen jälkeen. Yli
  5 minuutin vuoron viimeinen vastaus jatkaa samaa riviä: ”✓ Vastaus valmis
  17.03 · vuoro kesti 23 min”. Uutta riviä ei tule, eikä aika toistu.
- **B Kuplan alla.** Otsakkeessa ei ole aikaa. Pieni aika on kortin alla
  kortin puolella, sinun oikealla ja agentin vasemmalla. Yli 2 minuutin
  vuoron viimeisen vastauksen alla rivi kuuluu ”Valmis 17.03 · vuoro kesti
  23 min”: kierroksen 1 C:n loppurivi on vastauksen oma aikarivi.
- **C Marginaali.** Aika on keskustelun reunassa otsakkeen korkeudella,
  agentin vasemmalla ja sinun oikealla, ja sarakkeen voi lukea alas kuin
  lokia. Yli 10 minuutin vuorossa vastauksen ajan alla on kesto
  (”23 min”). Reunat vievät puhelimella noin 80 px leveyttä.

Kynnys näkyy tässä keskustelussa näin: vuorot kestävät 41 s, 6 min, 1 min,
12 s, 23 min ja 15 min. Kahden ja viiden minuutin kynnys valitsevat samat
kolme vuoroa, kymmenen minuutin kynnys pudottaa 6 minuutin vuoron.

**Suositus: A Otsake, kynnys 5 minuuttia.** Aika on samassa kohdassa
kummankin viesteissä, nimen vieressä, ja otsake luetaan yhtenä lauseena:
kuka, milloin ja pitkässä vuorossa kuinka kauan. Loppu ei vie riviä eikä
toista valmistumisaikaa. Toteutus on pieni: `Message` järjestää otsakkeen
nimi, aika, kopioi, `HistoryView` antaa `time`-propsin ja `AgentTurn`in
vastauskortti saa ajan ja keston propseina. Host-tietoa ei tarvita lisää.
B on tuttu viestisovelluksista, mutta jokaisen kortin alle tulee rivi, ja
13 viestin keskustelu kasvaa yhtä monella rivillä. C antaa leveällä
ruudulla siistin aikasarakkeen, mutta puhelimella reunat ovat poissa
tekstiltä, ja aika irtoaa kortista, josta se kertoo.

### Päätökset myöhempään katselmointiin

- Vuoron kesto lasketaan käyttäjän viestin natiivista ajasta viimeisen
  vastauksen natiiviin aikaan. Se on sama väli kuin työrivien summa, ja
  host tietää vain sen.
- Kesto pyöristetään alas minuuteiksi (15 min 30 s → ”15 min”), jotta se
  ei koskaan sano enemmän kuin työrivi. Yli tunnin vuoro: ”1 t 12 min”.
- Kesto tulee vain viimeiseen vastaukseen. Välivastaus saa pelkän ajan.
- Käynnissä olevalla vuorolla ei ole kestoa. Elävä kello kertoo sen, ja
  kesto ilmestyy, kun vastaus on tallentunut.
- Pysäytetty vuoro pitää tuotannon rivinsä ”Keskeytit · 14.05” ilman
  kestoa (kysymys 3).
- Työrivin kesto pysyy ennallaan, myös kun se on sama kuin vuoron kesto.
- Kynnys on vakio, ei asetus.
- Jaetun keskustelun osallistujan viesti saa ajan samalla säännöllä kuin
  sinun viestisi. Selitystilaa ei kierroksella näytetty.

### Kysymykset Jarille

1. A (aika nimen perässä kummankin viesteissä) vai Nyt (vastauksessa
   oikeassa reunassa)?
2. Kesto yli 5 minuutin vuoroihin, vai vain monivaiheisiin vuoroihin,
   joissa työrivi ei jo kerro sitä?
3. Saako pysäytetty pitkä vuoro saman keston (”Keskeytit 14.05 · vuoro
   kesti 8 min”)?

## Kierros 1

Kierros: `design-system/prototypes/rounds/2026-11-24-times-conversations/`
(rakennus- ja tarkistuskomennot ovat sen `NOTES.md`:ssä). Tuotantokomponentit
ovat muuttamattomia, ja data on synteettistä.

### Host-tiedot

**Natiivi historia.** Pi kirjoittaa sessiotiedostoonsa jokaiselle merkinnälle
`timestamp`-kentän (RFC 3339) sillä hetkellä, kun se lisää merkinnän. Käyttäjän
viesti tallentuu, kun se lähtee. Agentin viesti tallentuu vasta valmiina, joten
sen aika on viestin valmistumishetki eikä aloitushetki. Työkalun tulos tallentuu,
kun työkalu päättyy. Vuoron alulle tai lopulle ei ole omaa merkintää: alku on
käyttäjän viestin aika ja loppu viimeisen agenttiviestin aika. Pysäytetty vuoro
tallentuu `stop_reason: aborted` -merkintänä omalla ajallaan.

**Habitatin historia-API.** Daemon (`nativeTimestamp`,
`internal/daemon/history_linux.go`) välittää natiivin ajan sellaisenaan
`HistoryEntry.timestamp`-kenttään (`contracts/v1/history.schema.json`; kenttä on
valinnainen). Puuttuva tai virheellinen aika jää tyhjäksi. Muita valmiita aikoja
ovat snapshotin `started_at`, `changed_at` (sessiotiedoston muokkausaika) ja
`archived_at`, herätysten `set_at`/`fired_at` sekä SSE-tapahtuman `emitted_at`.
Uutta host-tietoa ei tarvita yhteenkään suuntaan.

**Mitä selain näyttää nyt.** Viestikorteissa ei ole aikaa: `HistoryView` ei anna
`UserMessage`- ja `AssistantMessage`-komponenteille `time`-propsia, vaikka
`Message` piirtää sen otsakkeeseen ja tyyli asettaa sen vastauksessa oikeaan
reunaan. Aikoja käytetään nyt näissä:

- työrivin kesto (`stageElapsed`, ”2 työkalua · 41 s”)
- käynnissä olevan vuoron kello m:ss käyttäjän viestin natiivista ajasta
- pysäytetyn vuoron rivi (”Keskeytit · 14.05”, koko aika titlessä)
- vastauslainauksen ja Palaa tähän -rivien kellonaika
- agentin ilmoitukset
- sivupalkin rivin ikä `changed_at`ista (`changeAge`: ”nyt”, ”5 min”, ”3 t”, ”1 pv”)
- herätyksen aika rivillä.

**Aikavyöhyke.** Henkilöllä tai palvelimella ei ole aikavyöhykeasetusta. Kaikki
näytetyt ajat lasketaan selaimen vyöhykkeessä (`formatDate` ja Intl, `Date`):
herätyksen aika rivillä (”in the browser's zone”), yöhiljaisuus (”laitteen
paikallisen kellon mukaan”) ja laitelinkin kirjautumisaika (`signedInAt`). Vyöhyke luetaan
erikseen vain vastauskielen arvaukseen (`answerLanguage.ts`). Kierros seuraa
samaa sääntöä, ja sen vyöhykevalinta näyttää, miten ajat ja päivänrajat
siirtyvät.

### Suunnat

Akseli: kuinka paljon aikaa oletusnäkymä näyttää. Sama keskustelu kaikissa
suunnissa: se alkaa perjantaina ja jatkuu maanantaina ja tänään, siinä on
lyhyitä vaihtoja ja 6 ja 23 minuutin vuoroja, ja viimeisen vuoron voi vaihtaa
käynnissä olevaksi.

- **Nyt.** Viesteissä ei ole aikoja. Vain työrivi, elävä kello ja sivupalkin
  ikä kertovat ajasta. Perjantain viestit näyttävät samanikäisiltä kuin tämän
  aamun.
- **A Päivät.** Päivän vaihtuessa on erotin (Pe 20.11., Eilen, Tänään).
  Kellonaika on jokaisessa viestissä, mutta näkyy vasta osoittimen alla,
  kohdistettuna tai napautettuna. Ruudunlukija lukee sen aina.
- **B Kello.** Päiväerottimet ja hillitty kellonaika jokaisen viestin
  otsakkeessa, sinun ja agentin, myös välivastauksessa.
- **C Tauot.** Aika näkyy vain yli tunnin tauon jälkeen (”Eilen 9.15 · 2 päivän
  tauon jälkeen”). Yli kahden minuutin vuoro päättyy riviin ”Valmis 17.03 ·
  vuoro kesti 23 min”.

### Suositus

B. Aika on aina samassa paikassa, myös puhelimella ilman osoitinta, ja
päiväerotin näyttää jatketun keskustelun yhdellä silmäyksellä. Tuotannon
viestikortti ottaa ajan jo vastaan, joten toteutus on pieni: `HistoryView`
antaa `time`-propsin ja `AgentTurn`in vastauskortti saa samanlaisen propsin
(kierros asettaa sen ulkoa). C on hiljaisin, mutta aika puuttuu juuri silloin,
kun joku kysyy, milloin jokin tehtiin. A piilottaa ajan puhelimelta, ja
saavutettavuusohje kieltää olennaisen tiedon pelkässä hoverissa.

### Päätökset myöhempään katselmointiin

- Agentin vastauksen aika on sen tallennushetki eli valmistumisaika, koska host
  tietää vain sen. Suoratoistuva vastaus saa ajan vasta tallennuttuaan.
- Merkintä, jolta natiivi aika puuttuu, näytetään ilman aikaa. Aikaa ei
  arvata naapureista.
- Päivänrajat ja kellonajat lasketaan laitteen vyöhykkeessä ja muodossa
  `formatDate`n kautta (fi ”9.38”, en-GB ”9:38”), kuten herätykset.
- Sivupalkin ikä jää kuluneeksi ajaksi (”17 t”), vaikka keskustelu sanoo
  samasta hetkestä ”Eilen”. Rivillä lyhyt kesto on luettavampi kuin päiväsana.
- Työrivin kesto ja elävä kello jäävät ennalleen kaikissa suunnissa.
- Selitystilaa ja jaetun keskustelun osallistujan viestejä ei kierroksella
  näytetty. Osallistujan viesti saisi ajan samalla säännöllä.

### Kysymykset Jarille

1. B (aika jokaisessa viestissä) vai C (aika vain taukojen jälkeen)?
2. Otetaanko C:n vuoron loppurivi (”Valmis 17.03 · vuoro kesti 23 min”) mukaan
   B:hen pitkille vuoroille, vai riittävätkö työrivin kesto ja vastauksen
   kellonaika?
3. Pitäisikö sivupalkin rivin iän puhua samaa kieltä kuin keskustelu (”eilen”,
   ”pe”), vai jääkö se kuluneeksi ajaksi?
