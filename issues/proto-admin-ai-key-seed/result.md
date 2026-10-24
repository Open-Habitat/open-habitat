# Sivuston AI-avain jo liittyneille

**[Avaa kierros](https://glasspad.example.test/p/zm4yhxhjk5xcsh6e26sbvzwdqu/).** Valitse suunta alareunasta (myös näppäimet 1–3 ja nuolet). Yläreunan *Tilanne* vaihtaa tilanteiden *Ei avainta*, *Avain juuri asetettu* ja *Avain vaihdettu* välillä. *Näkymä* vaihtaa ylläpitäjän ja Ainon oman näkymän välillä. Kaikki henkilöt ja avaimet ovat keksittyjä.

## Mikä on sama kaikissa suunnissa

Avaimen antaminen on aina sama tapahtuma. Ensin henkilön oma palvelu tarkistaa, mitä hänen Pi:llään on avaimen palvelulle, ja vastaa yhdellä sanalla: *ei tunnusta*, *sivuston aiempi avain*, *on jo tämä avain*, *oma tunnus* tai *ei vastausta*. Kirjoitus tehdään vain kahdessa ensimmäisessä tapauksessa, ja se tarkistetaan uudelleen Pi:n lukon alla. Oma avain tai tilaus (myös Claude-tilaus, joka on Pi:ssä Anthropic-tunnus) ei koskaan korvaudu. Silloin dialogissa ei ole kirjoituspainiketta, vaan siinä lukee *Ei koskaan korvata*. Ylläpitäjä ei näe henkilön oman tunnuksen lajia eikä loppuosaa.

Ennen kirjoitusta dialogi kertoo ylläpitäjälle neljä asiaa. Hän kirjoittaa toisen henkilön omiin tunnuksiin, ja palvelu laskuttaa sivuston tiliä. Kopio on henkilön oma, eikä sitä voi perua; käytön estää vain mitätöinti palvelussa. Oma avain ei korvaudu. Henkilö näkee, että avain on sivuston antama. Painike nimeää kohteen: *Kirjoita avain @aino-v:n tunnuksiin*.

Henkilö näkee Asetukset › Yhteydet -osiossa rivin *Anthropic API-avain*, merkin *Sivuston avain*, päivän, jona ylläpitäjä antoi avaimen, ja tiedon, että käyttö laskutetaan sivuston tililtä. Hän voi vaihtaa avaimen omaansa. Jos sivusto on sittemmin vaihtanut avaimensa, rivillä lukee, että kopio voi lakata toimimasta.

Kun avain vaihdetaan, aiemmat kopiot jäävät ennalleen, kuten ADR 0030:ssa. AI-avain-sivu nimeää heti henkilöt, joille aiempi avain annettiin, ja tarjoaa uuden antamista. Uuden avaimen antaminen korvaa vain sivuston aiemman kopion. Poistodialogi nimeää henkilöt, joille avain on annettu, ja kertoo, että kopiot jäävät.

## Akseli ja suunnat

Akselina on se, **missä ylläpitäjä antaa avaimen**.

1. **Rivillä.** Käyttäjät ja pääsy -sivun jokaisella liittyneellä rivillä on *AI-avain…*. Se avaa dialogin yhdelle henkilölle, ja rivillä näkyy sen jälkeen *AI-avain annettu 24.10.* AI-avain-sivu ohjaa tänne. Kun avain vaihdetaan, sivu nimeää aiempien kopioiden haltijat ja linkittää Käyttäjät ja pääsy -sivulle, jossa jokainen annetaan erikseen.
2. **AI-avain-sivulla.** AI-avain-sivulla on kortti *Jo liittyneet*. Siinä lukee, mitä sivusto on antanut ja kenelle (*Ei annettu*, *Annettu 20.10. (aiempi avain …m4Pz)*), ja painike *Anna avain liittyneille…*. Dialogi tarkistaa kaikki kerralla. Valita voi vain ne, joille kirjoitus on mahdollinen, ja heidät on valittu valmiiksi. Käyttäjät ja pääsy -sivulla näkyy vain tulos *AI-avain annettu*.
3. **Molemmat.** Suunnan 2 kortti ja suunnan 1 rivipainike. Molemmat avaavat saman dialogin.

## Suositus

**AI-avain-sivulla.** Antaminen liittyy aina avaimeen itseensä. Se tehdään, kun avain asetetaan ensimmäisen kerran (kaikki aiemmin liittyneet) tai kun avain vaihdetaan (aiempien kopioiden haltijat). Molemmat ovat joukkotoimia, ja ehdot, vaihto, poisto ja kopioiden haltijat ovat samalla sivulla. Yksittäisen henkilön voi antaa samasta dialogista poistamalla muut valinnat. Rivipainike (suunta 3) lisäisi jokaiselle käyttäjäriville toisen painikkeen harvinaista tapausta varten.

## Mitä näkymät olettavat hostilta

- **Uusi henkilöiden välinen tieto: tarkistus.** Yhdyskäytävä kysyy henkilön omalta palvelulta (daemonilta) tämän UID:n alla yhden kiinteämuotoisen vastauksen: `absent | site_current | site_earlier | own | unknown`. Yhdyskäytävä lähettää säilyttämänsä sivuston avainten suolatut sormenjäljet, ja daemon vertaa niitä omassa UID:ssään. Henkilön omasta avaimesta ei lähde mitään, ei edes tiivistettä. Tämä on sama tieto, jonka `admin ai-key seed --dry-run` tarvitsee joka tapauksessa. Nyt se näkyy myös selaimessa ylläpitäjälle.
- **Kirjoitus** on sama `seed`-toiminto kuin käyttöönotossa, mutta sillä on yksi lisäehto: tunnuksen saa korvata, jos se on täsmälleen sivuston aiemmin antama (sormenjälki täsmää). Kirjoitus päättää asian uudelleen Pi:n lukon alla. Avain tulee Pi:n oletukseksi vain, jos henkilöllä ei ole oletusta.
- **Annettujen kopioiden luettelo** on yhdyskäytävän oma kirjanpito (henkilö, avaimen sormenjälki, päivä). Siihen kuuluvat sekä käyttöönoton että myöhemmät antamiset. Se ei kerro, mitä henkilöllä nyt on, ja kortti sanoo tämän.
- **Henkilön näkymä** lukee henkilön omasta kirjanpitorivistä, että avain on sivuston antama ja milloin. Merkintä *sivusto on vaihtanut avaimensa* tulee siitä, ettei sormenjälki ole enää nykyinen.
- **Ei vastausta** (daemon ei vastaa): mitään ei kirjoiteta, eikä mitään yritetä automaattisesti uudelleen.

## Kysymykset Jarille

1. AI-avain-sivulla (suositus), rivillä vai molemmissa?
2. Saako ylläpitäjä selaimessa nähdä tarkistuksen tuloksen (*oma tunnus* / *ei tunnusta*)? Tämä on uusi henkilöiden välinen tieto, vaikka se on yksi sana eikä kerro tunnuksen lajia. Vaihtoehto on kirjoittaa sokkona ja näyttää vain tulos (*kirjoitettu* / *oma tunnus, ei muutettu*).
3. Avaimen vaihto: riittääkö, että sivu nimeää aiempien kopioiden haltijat ja tarjoaa erillisen *Anna uusi avain heille…* -toiminnon? Vai pitäisikö vaihdon kysyä samalla, päivitetäänkö kopiot? Kumpikin poikkeaa ADR:n linjasta "vaihto muuttaa vain tulevia"; ehdotettu erillinen toiminto poikkeaa siitä vähemmän.
4. Pitäisikö henkilön saada antamisesta erillinen ilmoitus (esim. kerran Työtilat-sivulla), vai riittääkö Yhteydet-rivi?

## Päätökset myöhempää tarkastelua varten

- **Ylläpitäjä ei näe henkilön oman tunnuksen lajia** (avain, tilaus vai loppuosa). Hän näkee vain *Oma Anthropic-tunnus*. Vaihtoehto oli näyttää *Claude-tilaus* tai `sk-ant-…k9Lw`, mutta sitä ylläpitäjä ei tarvitse päätökseensä.
- **Sallittuja, jotka eivät ole vielä kirjautuneet, ja poistettuja ei listata.** Sallitut saavat avaimen ensimmäisellä kirjautumisella. Poistetuille ei anneta mitään.
- **Poisto ei peru kopioita**, kuten ADR 0030:ssa. Sormenjälkien avulla kopiot voisi teknisesti poistaa, mutta ADR:n mukaan sivusto ei koskaan ota kopiota takaisin.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-10-24-ai-avain-liittyneille/build.mjs [kansio]   # {index,offline}.html
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-24-ai-avain-liittyneille/check.mjs <html-tai-url> <kuvakansio>
```

`check.mjs` käy kolme suuntaa läpi leveyksillä 1440, 820 ja 390 px, vaaleana ja tummana. Se antaa avaimen yhdelle ja usealle, varmistaa, ettei oma avain korvaudu (myös sen jälkeen, kun Aino vaihtaa omaan avaimeen), kokeilee henkilön, joka ei vastaa, sekä avaimen vaihdon, aiempien kopioiden uusimisen, poiston ja avaimen asettamisen tyhjästä. Konsolin on oltava puhdas. Tulos oli 66 tarkistuspistettä sekä paikallisessa tiedostossa että julkaistulla sivulla (`ak-checks.json`, `ak-hosted-checks.json`). Tuotannon komponentit: `SiteKeyEditor`, `ControlButton`, `Segmented`, `Checkbox`, `StatusMark` ja `Icon` sekä niiden CSS. `access.tsx` on tuotannon `ServerAccess`, johon on lisätty yksi ehdotettu prop `aiKey`. Kierroksen omia ovat antamisdialogi, poistodialogin teksti, *Jo liittyneet* -kortti ja henkilön avainrivi.
