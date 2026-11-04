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
