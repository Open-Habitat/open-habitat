# Vastaa agentin viestiin

## Kierros 1

Kierros: `design-system/prototypes/rounds/2026-11-22-reply-to-message/`
(`NOTES.md` kertoo rakenteen, rakennuskomennon ja tarkistuksen). Sivu on
rakennettu tuotannon komponenteista ja tokeneista (sivupalkki, otsake,
viestit, työkalurivit, aikajana, kenttä); kierroksen omia ovat vain
vastausnuoli, lainaus, kieleke ja kohdan korostus.

Kaikissa suunnissa on sama perusta:

- Jokaisen agentin vastauksen oikeassa yläkulmassa on pieni ↩-painike
  *Vastaa tähän viestiin*. Työpöydällä se näkyy osoittimen alla tai
  fokuksessa kuten Palaa tähän -valikko, puhelimessa aina. Vastattavan
  viestin painike jää korostetuksi niin kauan kuin vastaus on kesken.
- Painallus vie lainauksen kentän yläpuolelle ja fokuksen kenttään.
- Lainauksen painaminen vierittää alkuperäisen viestin näkyviin ja
  korostaa sen hetkeksi; vähennetyllä liikkeellä vieritys on välitön ja
  korostus on liikkumaton reunus. Sama toimii lähetetyn viestin
  lainauksesta.
- ✕ poistaa lainauksen; luonnos jää kenttään.
- Lähetetty viesti kantaa viittauksen, ja agentti saa viestin
  natiivin tunnisteen ja lainatun otteen (ks. alla).

Akseli: kuinka paljon viestistä viittaus kantaa ja kuinka raskaana se
istuu kentässä ja lähetetyssä viestissä.

1. **A Lainaus**: kentän yllä kortti, jossa viestin alku kahdella rivillä
   (*Vastaat agentin viestiin · klo 9.20*). Lähetetyn viestin alussa on
   sama lainaus.
2. **B Kohta**: kuten A, mutta tekstiä voi valita vastauksesta, ja
   valinnan yllä on *Vastaa tähän kohtaan*. Lainaukseen tulee vain
   valittu kohta lainausmerkeissä, ja kohta pysyy alkuperäisessä
   korostettuna, kunnes lähetät. Kulmapainike lainaa koko viestin.
3. **C Kieleke**: yksi rivi kiinni kentän yläreunassa (*↩ Agentti 9.20
   Kaksi tapaa: …*). Lähetetyn viestin yllä on vain linkkirivi
   *Vastaus agentin viestiin klo 9.14* ilman otetta.

Oletusnäkymässä vastaus klo 9.20 viestiin on kesken ja historiassa on yksi
lähetetty vastaus, joten suuntien ero näkyy heti. Sivun yläreunassa on
jokaisesta suunnasta yksi rivi ja suositus. *Näytä, mitä agentti saa*
näyttää jokaisen vastauksen alla tekstin, jonka natiivi istunto saisi.

**Suositus: A.** Se on WhatsAppista tuttu, eikä se vaadi puhelimessa
tekstin valintaa, joka on kosketusnäytöllä hankalaa ja kilpailee
selaimen oman valintavalikon kanssa. Lainaus näkyy myös lähetetyssä
viestissä, joten keskustelua myöhemmin lukeva näkee, mihin vastattiin.
C on kevyin, mutta lähetetystä viestistä ei näe, mihin vastattiin,
ellei hyppää. B:n kohdan valinnan voi lisätä myöhemmin samaan korttiin
työpöydän lisänä.

### Tarkistus

`check.mjs` kävi kaikki kolme suuntaa Päivä-, Yö- ja Korkea kontrasti
-teemassa 1440 ja 390 px:n leveydellä: oletusnäkymä, hyppy kentän
lainauksesta ja lähetetyn viestin lainauksesta, ✕, uusi vastaus
kulmapainikkeesta, B:n kohdan valinta, lähetys ja agentille menevä
teksti. 306 tarkistusta meni läpi, ja konsoli pysyi puhtaana.
Kuvakaappaukset (DPR 2) ovat tallessa repositorion ulkopuolella
hakemistossa `/var/tmp/agent-keep/reply-to-agent-message/`.

## Miten viittaus kulkisi Pi:lle (luonnos, ei toteutusta)

Tämä on sovelluskerroksen ja daemonin asiaa, ei uusi auktoriteetti:
oma viesti omaan istuntoon, kuten nyt. Gateway ja provisiointi eivät
muutu.

**Selain → host.** `pi-message`-kuormaan tulee valinnainen
`reply_to: {entry_key, passage?}`. `entry_key` on sama natiivin Pi-merkinnän
tunniste, jota historia ja Palaa tähän jo käyttävät. `passage` on B:n
valittu kohta. Selain ei lähetä otetta itse: daemon lukee sen natiivista
istunnosta, jolloin ote on aina se, mitä istunnossa oikeasti lukee, eikä
selaimen käsitys siitä. Jos `passage` on annettu, daemon tarkistaa, että
se löytyy merkinnän tekstistä (välilyönnit normalisoituina). Muuten
pyyntö hylätään.

**Daemon → natiivi istunto.** Daemon tarkistaa, että merkintä on
avustajan viesti nykyisessä haarassa, ja liittää viestin alkuun lohkon,
ennen kuin lähettää sen Pi:lle tavallisena käyttäjän viestinä. Daemon
muokkaa viestiä jo nyt ennen lähetystä, kun se lisää liitteiden
levypolut.

```
<reply-to entry="b81e04d6" role="assistant">
Kaksi tapaa: zoneinfo: lasketaan paikallinen aika aikavyöhykkeen mukaan. …
</reply-to>

Mennään ensimmäisellä. Windows ei ole meillä käytössä.
```

Ote on viestin alku (enintään noin 280 merkkiä, katkaistu sanan
kohdalta) tai B:ssä valittu kohta (`part="passage"`).

**Mitä Pi näkee.** Käyttäjän viestin, joka alkaa lainauksella. Malli
ymmärtää otteesta, mihin vastataan; tunniste ei kerro mallille mitään
yksinään, mutta se säilyy natiivissa historiassa. Lohko on luettava myös
terminaalissa (`pi --resume`), eikä se tarvitse companion-laajennusta.
Rajaavat tagit ovat yksiselitteiset sekä mallille että jäsentimelle, toisin
kuin pelkkä Markdown-lainaus, joka voi olla myös käyttäjän omaa tekstiä.

**Takaisin näkymään.** Historian jäsennin tunnistaa käyttäjän viestin
alussa olevan `<reply-to …>`-lohkon ja antaa merkinnälle kentän
`reply_to: {entry_key, excerpt, passage}`. Lohko jätetään viestin
tekstistä pois samaan tapaan kuin osallistujaviestin Habitat-rivit
(`participant_message.text`), ja `UserMessage` piirtää lainauksen.
Hyppy etsii merkinnän ladatusta historiasta. Jos sitä ei ole ladattu,
vanhempia sivuja haetaan, kunnes se löytyy. Jos merkintä ei ole enää
nykyisessä haarassa (Palaa tähän on vienyt sen sivuun), lainaus näkyy,
mutta hyppy on estetty ja syy kerrotaan: *Viesti ei ole enää tässä
jatkossa*.

**Ohjaus ja jono.** Kesken vuoron lähetetty vastaus (ohjaus tai jatko)
kantaa saman lohkon. Jonoon jäänyt vastaus näyttää lainauksensa jonon
rivillä.

## Päätökset myöhempään katselmointiin

- **Vastattavat viestit**: vain agentin valmiit vastaukset. Vaihtoehdot:
  myös omat viestit, työkalurivit tai kesken oleva vastaus. Toive koski
  agentin viestejä, ja kesken olevalla vastauksella ei vielä ole
  lopullista tekstiä lainattavaksi.
- **Kulmapainikkeen näkyvyys työpöydällä**: osoittimen alla tai
  fokuksessa, kuten Palaa tähän. Vaihtoehto oli aina näkyvissä. Valinta
  pitää pitkän keskustelun rauhallisena; puhelimessa painike näkyy aina.
- **Yksi lainaus kerrallaan**: uusi kulmapainallus korvaa edellisen.
  Monta lainausta kerralla olisi raskaampi sekä näkymässä että Pi:lle.
- **Otteen pituus**: noin 280 merkkiä. Näkymä näyttää kaksi riviä (A, B)
  tai yhden (C). Pidempi ote kuluttaisi kontekstia, ja agentilla on
  alkuperäinen viesti jo historiassaan.
- **Muoto Pi:lle**: `<reply-to>`-lohko tekstissä eikä companionin
  kirjoittama custom-merkintä (kuten `oh-participant-message`).
  Custom-merkintä olisi rakenteisempi, mutta se tarvitsisi companionin
  ja näkyisi terminaalissa irrallaan viestistä. Tekstilohko säilyy
  natiivissa historiassa sellaisenaan.
- **Kierroksen paikka**: lähteet ovat `design-system/prototypes/rounds/`
  -hakemistossa kuten muillakin kierroksilla, ja issuessa on vain tämä
  tiedosto. `picker-check` ja kirjaston ohje olettavat kierroksen siellä.

## Kysymykset Jarille

1. Mikä suunta: A, B vai C, tai A ja myöhemmin B:n kohdan valinta
   työpöydälle?
2. Kelpaako `<reply-to>`-tekstilohko natiiviin istuntoon, vai halutaanko
   rakenteinen custom-merkintä, vaikka se vaatii companionin?
