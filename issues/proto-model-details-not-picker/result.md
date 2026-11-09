# Kierros 1: mitä mallisirun takaa aukeaa

Kierros: `design-system/prototypes/rounds/2026-11-09-mallin-tiedot/`
(`NOTES.md` kertoo tarinan, rakennuksen ja tarkistuksen). Akseli: mikä
yläpalkin mallisirun ponnahdus on, eli valitsin, tieto vai osoitin.

- **Nyt**: tuotannossa mallit ja tasot ovat reunustettuina riveinä, ja käytössä oleva on korostettu. Ne näyttävät painikkeilta, mutta mitään ei voi painaa (`evidence/kaisa-model-popover-2026-11-09.avif`).
- **A Vaihda tässä**: oikea valitsin tälle keskustelulle. Vaihto koskee seuraavaa viestiä, ja keskusteluun jää rivi "Malli vaihtui".
- **B Tietona**: pelkkä tieto ilman reunuksia: malli, ajattelutaso ja kirjautuminen; muut mallit hiljaisena tekstinä.
- **C Lyhyesti ja minne**: yksi rivi ja kaksi tietä: uusi keskustelu toisella mallilla tai uusien keskustelujen oletus.

Kuvat: `evidence/r1-<suunta>-0-oletus-{1440,390}-{light,dark}.avif`,
A:n valinta, vaihto ja estetty tila (`r1-a-vaihda-{1-valinta,2-vaihdettu,3-tyossa}-*`)
sekä C:n uusi keskustelu (`r1-c-lyhyesti-2-uusi-1440-light`).

## Mitä Pi ja host tekevät nyt

- Selaimessa malli ja taso valitaan nyt vain ennen ensimmäistä viestiä,
  viestikentän mallivalitsimesta. Daemon lähettää valinnan Pi:lle
  RPC-kutsuilla `set_model` ja `set_thinking_level` (`first_choice`).
  Yläpalkin siru on sen jälkeen vain lukunäkymä.
- Pi itse osaa vaihtaa kesken keskustelun: `/model`, Ctrl+P ja Shift+Tab
  päätteessä, ja samat RPC-kutsut. Vaihto kirjautuu istuntoon
  (`model_change`, `thinking_level_change`). Seuraava vuoro lähettää koko
  keskustelun uudelle mallille. Selain näyttää jo tällaisen vaihdon
  ketjussa rivinä "Malli vaihtui: Opus 5.5 → Sonnet 5.5", esimerkiksi kun
  vaihto on tehty SSH:lla.
- Asetukset › Tekoäly muuttaa Pi:n oletusta uusille keskusteluille.
  Avoimet keskustelut eivät vaihdu.

## Mitä kukin suunta tarvitsee hostilta

- **A**: uuden komennon. Daemonin pitää hyväksyä `set_model` ja
  `set_thinking_level` käynnissä olevalle, joutilaalle keskustelulle myös
  ensimmäisen viestin jälkeen, ja sopimukseen (`contracts/v1/`) tarvitaan
  operaatio sitä varten. Kaikki muu on jo olemassa: luettelo ja sen
  kontekstiikkunat, istunnon vaihtorivit ja kontekstin osuus. Tämä ei siirrä
  valtuuksia: daemon toimii jo käyttäjänä ja puhuu tämän omalle Pi:lle.
  Uusi ohjain tarvitsee Explain-kortin.
- **B**: ei mitään uutta. Ponnahdus käyttää samoja tietoja kuin nyt.
- **C**: ei uutta hostin tietoa. Pi:n oletus ja uuden keskustelun avaus
  työtilaan ovat jo olemassa. Kahdelle uudelle tielle tarvitaan
  Explain-kortit.

## Päätökset myöhempään tarkasteluun

- **A:ssa vaihto vaatii erillisen Vaihda-painikkeen** eikä tapahdu heti
  rivin valinnasta. Vaihtoehto oli välitön vaihto kuten Asetusten
  oletuksessa. Painike valittiin, koska vaihdolla on seuraus (koko
  keskustelu uudelle mallille, kontekstin osuus muuttuu) ja se jää
  ketjuun pysyvästi.
- **A:ssa vaihto on estetty, kun agentti työskentelee.** Vaihtoehto oli
  vaihtaa seuraavasta vuorosta alkaen. Esto on yksinkertaisempi selittää,
  eikä vuoron kesken tehty vaihto jää epäselväksi.
- **A tarjoaa vain saman kirjautumisen mallit**, kuten nykyinen ponnahdus.
  Pi osaisi vaihtaa myös toiseen palveluun, mutta silloin kirjautuminen ja
  laskutus vaihtuisivat kesken keskustelun.
- **B sanoo, että malli valitaan ennen ensimmäistä viestiä.** Ei sanota,
  että malli olisi lukittu, koska SSH:lla sen voi vaihtaa.
- **C:n osoitin oletukseen näyttää vain ilmoituksen**; toteutuksessa se
  avaa Asetukset › Tekoäly › Oletusmalli.

## Kysymykset Jarille

1. Pitääkö mallia voida vaihtaa kesken keskustelun selaimesta (A), vai
   riittääkö, että siru kertoo mallin (B tai C)?
2. Jos A: riittääkö saman kirjautumisen mallit, ja saako vaihdon tehdä vain
   kun agentti ei työskentele?
3. Jos ei A: kumpi on parempi, rauhallinen tieto (B) vai lyhyt rivi ja
   tiet eteenpäin (C)?

**Suositus: C.** Se korjaa Kaisan havainnon niin, ettei ponnahduksessa
ole mitään valitsimen näköistä, ja kertoo samalla, mistä mallin oikeasti
valitsee. Se ei vaadi hostilta mitään uutta. A on luonteva seuraava askel,
jos kesken keskustelun vaihtamiselle tulee oikea tarve. Pi tukee sitä jo,
ja rivi "Malli vaihtui" on valmiina. B:n muiden mallien luettelo on tietoa,
jota käyttäjä ei voi tässä käyttää.

## Jarin päätös (9.11.2026)

Suunta **B Tietona** (sanelussa "Hietala", tulkittu "tietona"): ei valitsinta,
rauhallinen tieto. Lisäksi Kaisan toive: jokaisella mallilla lyhyt
kuvaus (pelkkä "Opus" ei kerro mitään) ja ajattelutasolle selitys, mitä se
tarkoittaa. Toteutus `model-details-described`.
