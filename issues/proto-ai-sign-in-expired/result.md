# Kierros 1: tekoälyn kirjautuminen vanhentui

Kierros: `design-system/prototypes/rounds/2026-11-04-tekoaly-kirjautuminen/`
(NOTES.md kertoo suunnat ja vuorovaikutukset). Akseli: missä epäonnistunut
lähetys kertoo, että tekoälyn kirjautuminen pitää uusia, ja mistä sen uusii.
Yläpalkin *Tilanne* vaihtaa syyn: Claude-tilaus vanhentunut (oletus),
ChatGPT-tilaus vanhentunut, OpenAI-avain peruttu, Claude ei vastaa
(ylikuormitus, ei kirjautumisvika).

- **Nyt**: virhe näkyy valmiina vastauksena palveluntarjoajan omin sanoin, keskustelu jää Käynnissä-osioon, ja korjaus löytyy itse Asetukset › Tekoäly -sivulta.
- **A Vuoro**: epäonnistunut vuoro kertoo syyn ja kirjautuu kortissa paikan päällä; sen jälkeen kortissa on Lähetä uudelleen. Muualla ei näy mitään.
- **B Kenttä**: kuten GitHub-varoitus. Kentän yllä varoitus jokaisessa saman palvelun keskustelussa ja kello yläpalkissa; korjaus Asetukset › Tekoäly -sivulla, josta palataan viesti kentässä.
- **C Odottaa**: viesti ei lähtenyt vaan odottaa. Kaistale jokaisen keskustelun yläpalkin alla kertoo syyn, kirjautuminen aukeaa ikkunaan, ja viesti lähtee itse kirjautumisen jälkeen.

## Mitä kukin päättää

| | Missä sanotaan | Muut saman palvelun keskustelut | Mistä korjataan | Uudelleenlähetys | Ylikuormitus |
|---|---|---|---|---|---|
| A | Epäonnistunut vuorokortti (syy, raaka viesti avattavissa) | Eivät mitään ennen omaa virhettään | Kortin sisällä, samat vaiheet kuin asetuksissa | Kortin *Lähetä viesti uudelleen* | Kortissa syy ja *Yritä uudelleen* |
| B | Lyhyt rivi kortissa, varoitus kentän yllä, kello | Sama varoitus kentän yllä, kello | Asetukset › Tekoäly (ChatGPT: laitekoodisivu), paluu itsestään | Viesti kentässä, ihminen painaa Lähetä | Harmaa varoitus, ei kelloa, viesti kentässä |
| C | Oma kupla *Ei lähtenyt* ja rivi sen alla, kaistale | Sama kaistale | Ikkuna paikan päällä | Lähtee itse kirjautumisen jälkeen | Rivi *yritetään uudelleen… (1/3)*, lähtee itse |

Kaikissa suunnissa epäonnistunut keskustelu on Sinun vuorosissa
epäonnistuneena (punainen merkki), ei Käynnissä-osiossa.

## Suositus

**B, mutta korjaus aukeaa paikan päällä kuten C:n ikkunassa.** B pitää
sanomisen samana kuin GitHub-yhteydessä: kentän yllä siellä, missä
kirjoitat, kello kaikkialla, ja jokainen saman palvelun keskustelu kertoo
saman ennen kuin sinne ehtii lähettää turhaan. Tämä on se, mitä issue
pyysi. A jättää muut keskustelut hiljaisiksi, joten seuraava Claude-keskustelu
epäonnistuu samalla tavalla. C:n *Ei lähtenyt* ei pidä paikkaansa: Pi sai
viestin, ja malli vain kieltäytyi (ks. alla), joten kupla väittäisi jotain,
mitä host ei tiedä.

B:n kierros asetuksiin on kuitenkin turha: kaikki kolme nykyistä
kirjautumista (Clauden koodi, OpenAI:n laitekoodi, avain) tehdään
selaimessa poistumatta sivulta, ja asetuksissa joutuu painamaan
*Kirjaudu uudelleen* vielä kerran. Ikkuna samoilla vaiheilla aloittaa
heti. Viesti kannattaa palauttaa kenttään (B), ei lähettää itsestään (C):
vanha kysymys voi olla jo vanhentunut, ja ihminen näkee, mitä lähtee.

## Mitä host-tietoja näkymä olettaa

- **Luokittelu.** Daemonilla on jo `pi_auth_failed`
  (`modelAuthFailure` hakee 401, 403, unauthorized, "authentication
  failed", invalid api key) ja sille varoitus kentän yllä
  (*Kielimallikirjautuminen ei ole kunnossa*). Clauden "Failed to
  authenticate: OAuth session expired…" ei osu näihin sanoihin, ja Clauden
  silta kirjoitti sen tavallisena vastauksena, joten kortissa luki
  *Vastaus valmis*. Tämä on rinnakkaisen korjauksen (osa 1,
  `ai-sign-in-expired-shown-as-answer`) aluetta. Suunnat olettavat, että
  luokittelu kertoo myös **mikä palvelu** (claude-bridge, openai-codex,
  openai-avain, anthropic-avain) ja erottaa ylikuormituksen ja katkon
  (429/5xx, overloaded) kirjautumisviasta.
- **Nykyinen varoitus on ChatGPT:n.** Sen teksti ("Kirjaudu
  OpenAI-tilillesi") ja painike (`?pi_sign_in=1`, koko sivun tekoälyvaihe)
  sopivat vain ChatGPT-tilaukseen. Avaimen kohdalla se vie väärään
  korjaukseen (Nyt-tilassa näkyy). Uusi teksti ja korjaus tarvitsevat
  palvelun.
- **Koko sovelluksen tila (B, C).** `authError` on yhden keskustelun
  muistissa, eikä se selviä daemonin uudelleenkäynnistyksestä. Kello ja
  muiden keskustelujen varoitus tarvitsevat palvelukohtaisen tiedon
  "kirjautuminen hylättiin hetkellä T". Se saadaan Pi:n omista
  istuntotiedostoista samalla tavalla kuin mallien `refused`-havainnot
  (`model_observations_linux.go`): viimeisin hylkäys, joka on uudempi kuin
  viimeisin onnistunut vastaus tai kirjautuminen. Uutta varastoa ei tarvita.
  `ClearPiAuthFailures` tyhjentää tilan vain ChatGPT-kirjautumisen
  jälkeen; Clauden kirjautuminen ja avaimen vaihto tarvitsevat saman.
- **Asetusrivi valehtelee.** Clauden rivi sanoo *Kirjautunut*, koska
  `claude auth status` lukee tallennetun kirjautumisen eikä kokeile sitä.
  B:ssä ja Nyt-tilassa tämä näkyy. Rivin pitäisi lukea sama hylkäystieto.
- **Uudelleenlähetys.** Pi:n istunnossa viesti on jo, ja sen perässä on
  virheeseen päättynyt vuoro. Uudelleenlähetys (A, B, C) on uusi prompt
  samalla tekstillä, joten Pi:n kontekstiin tulee sama viesti kahdesti.
  Tämä on rehellistä ja harmitonta, mutta C:n *Ei lähtenyt* ei ole totta.
  Pi luultavasti yrittää ylikuormitusta itse uudelleen (`auto_retry`); C:n
  laskuri olisi Pi:n omat yritykset, ei hostin.
- **Kirjautuminen paikan päällä** käyttää samoja reittejä kuin asetukset
  (`/api/v1/pi/claude-login`, laitekoodi, `/api/v1/pi/credentials`). Uutta
  valtuutta tai gatewayn kierrosta ei tarvita.

## Kysymykset Jarille

1. Mistä korjaus tehdään: Asetukset › Tekoäly ja paluu
   (`evidence/b-kentta-claude-2-asetukset-1440-light.avif`) vai ikkuna
   keskustelun päällä (`evidence/c-odottaa-claude-2-ikkuna-1440-light.avif`)?
2. Kirjautumisen jälkeen: viesti kentässä odottamassa painallusta
   (`evidence/b-kentta-claude-3-palattu-1440-light.avif`) vai lähteekö se
   itse (`evidence/c-odottaa-claude-3-vastattu-1440-light.avif`)?
3. Mitä epäonnistunut vuorokortti sanoo, kun varoitus on kentän yllä:
   lyhyt rivi (`evidence/b-kentta-claude-0-oletus-1440-light.avif`) vai
   koko selitys ja raaka viesti avattavissa
   (`evidence/a-vuoro-claude-0-oletus-1440-light.avif`)?

## Tarkistus

`check.mjs`: 256 tarkistuspistettä, konsoli puhdas. Kaikki suunnat ja
neljä tilannetta 1440 px vaaleana läpi vastaukseen asti, Claude-kulku myös
tummana ja 390 px kosketuksella, avain puhelimessa, oletusnäkymät 390 px
tummana. Kuvat kertoimella 2 hakemistossa `evidence/` (AVIF). Kaikki on
synteettistä; host on `fetch`-sijainen, eikä palveluntarjoajien sivuja avata.

# Kierros 2: riffi B Kentästä

Kierros: `design-system/prototypes/rounds/2026-11-06-tekoaly-kirjautuminen-riff/`
(NOTES.md kertoo riffit ja vuorovaikutukset). Pohjana on Jarin 6.11.
valitsema B Kenttä. **Uutta kaikissa ja oletusnäkymässä:** epäonnistunut
viesti odottaa kentässä rivin *Odottaa kentässä · lähtee itse heti, kun olet
kirjautunut* kanssa ja lähtee painamatta, kun agentti on taas linjoilla.
Lähtevä teksti on se, mitä kentässä silloin on. Riffit vaihtelevat kahta
avointa kysymystä: B1–B2 kysymystä (a) ja B2–B3 kysymystä (c).

- **B1 Asetukset**: Kirjaudu uudelleen vie Asetukset › Tekoäly -sivulle, josta palataan itse keskusteluun. Epäonnistunut vuoro on lyhyt rivi.
- **B2 Ikkuna**: kirjautuminen aukeaa ikkunaan keskustelun päälle, eikä keskustelusta poistuta. Epäonnistunut vuoro on lyhyt rivi.
- **B3 Selitys**: ikkuna kuten B2, mutta epäonnistunut vuoro kertoo koko syyn, ja palvelun oman viestin saa auki.

## Suositus

**B2.** Ikkuna aloittaa saman kirjautumisen heti, ja keskustelu, varoitus ja
odottava viesti näkyvät koko ajan sen takana. Kun ikkuna sulkeutuu, ihminen
näkee viestinsä lähtevän (`evidence/r2-b2-ikkuna-claude-3-lahti-1440-light.avif`).
B1:ssä ollaan hetki toisella sivulla, siellä pitää painaa *Kirjaudu
uudelleen* vielä kerran, ja paluu tapahtuu itsestään, jolloin ihminen ei
välttämättä huomaa, mistä palasi. Asetusrivi on silti oikea paikka
ihmiselle, joka menee sinne itse, ja se toimii jo nyt. Lyhyt rivi riittää
vuorokortissa, koska varoitus kentän yllä kertoo saman syyn ja
korjauksen. B3:ssa syy sanotaan kahteen kertaan peräkkäin
(`evidence/r2-b3-selitys-claude-0-oletus-1440-light.avif`). Palvelun oma
viesti on kehittäjälle hyödyllinen, mutta tavalliselle käyttäjälle se on
kohinaa, ja se löytyy edelleen Pi:n istunnosta.

## Mitä host-tietoja näkymä olettaa

Kierroksen 1 tiedot pätevät edelleen: luokittelu kertoo palvelun ja erottaa
katkon kirjautumisviasta, palvelukohtainen hylkäystieto saadaan Pi:n omista
istuntotiedostoista, ja kirjautuminen käyttää samoja reittejä. Uutta tällä
kierroksella:

- **"Taas linjoilla" on selaimen tiedossa vain kirjautumisessa.**
  Clauden `claude-login` päättyy tilaan `completed`, laitekoodi tilaan
  `connected`, ja avain tallentuu `pi/credentials`-kutsulla. Näistä selain
  tietää, milloin lähettää. Ylikuormituksessa ja katkossa toipumisen
  kertoo vain uusi yritys. Joko selain lähettää uudelleen
  väliajoin, tai daemon kertoo palvelukohtaisesta tilasta, kun Pi:n oma
  `auto_retry` tai seuraava vastaus onnistuu. Kierroksen *Simuloi: Claude
  vastaa taas* -painike seisoo tämän paikalla.
- **Odottava viesti on selaimen luonnos.** Kentän teksti on jo nyt
  `sessionStorage`ssa (`nah:<identity>:draft:<id>`). Odotusmerkki tarvitsee
  saman paikan. Tuotannon nykyinen sääntö on, että suljetun näkymän
  pitämä viesti palaa kenttään eikä lähde myöhemmin kysymättä. Tämä on
  sopusoinnussa, kun viesti lähtee vain auki olevasta näkymästä. Jos
  kirjautuu toisella laitteella eikä keskustelu ole auki missään, viesti
  odottaa kentässä seuraavaan avaamiseen asti. Silloin se lähtee heti, jos
  kirjautuminen on jo kunnossa. Kahdessa välilehdessä sama luonnos voisi
  lähteä kahdesti, joten toteutus tarvitsee yhden lähettäjän (esimerkiksi
  `BroadcastChannel`-lukko tai luonnoksen tunniste daemonilla).
- **Tuotannon `Composer` ei näytä syyriviä muokattavan kentän alla.**
  `editorAvailability` piilottaa `availability`n syyn, joten
  odotusriville tarvitaan oma kohta komponentissa.
- **Uutta valtuutta ei tarvita.** Automaattinen lähetys on sama prompt kuin
  Lähetä-painike. Kierroksen 1 huomio pätee: Pi:n kontekstiin tulee sama
  viesti toisen kerran.

## Kysymykset Jarille

1. Mistä kirjautuminen korjataan: Asetukset › Tekoäly ja paluu
   (`evidence/r2-b1-asetukset-claude-2-asetukset-1440-light.avif`) vai
   ikkuna keskustelun päällä
   (`evidence/r2-b2-ikkuna-claude-2-ikkuna-1440-light.avif`)?
2. Mitä epäonnistunut vuoro sanoo: lyhyt rivi
   (`evidence/r2-b2-ikkuna-claude-0-oletus-1440-light.avif`) vai koko syy ja
   palvelun oma viesti avattavissa
   (`evidence/r2-b3-selitys-claude-1-raaka-1440-light.avif`)?
3. Saako viesti lähteä itse myös silloin, kun olet muokannut sitä
   odottaessa (`evidence/r2-b2-ikkuna-claude-2-ikkuna-1440-light.avif`,
   kentässä *… Kiitos!*), tai kun se odottaa toisessa saman palvelun
   keskustelussa (`evidence/r2-b1-asetukset-claude-1-toinen-keskustelu-1440-light.avif`)?

## Tarkistus

`check.mjs`: 424 tarkistuspistettä, konsoli puhdas. Kaikki riffit ja neljä
tilannetta käytiin läpi 1440 px:n vaaleana vastaukseen asti, Claude-kulku
myös tummana ja 390 px:n kosketuksella, avain puhelimessa ja oletusnäkymät
390 px:n tummana. 91 kuvaa on otettu kertoimella 2 hakemistoon `evidence/`
(AVIF, etuliite `r2-`). Kaikki on synteettistä: host on `fetch`-sijainen,
eikä palveluntarjoajien sivuja avata.
