# Tekoälyn kirjautuminen vanhentui – kierros 2 (riffi B Kentästä)

Issue `proto-ai-sign-in-expired`. Edellinen kierros:
`design-system/prototypes/rounds/2026-11-04-tekoaly-kirjautuminen/`. Jari
valitsi 6.11. suunnan **B Kenttä**: varoitus kentän yllä jokaisessa saman
palvelun keskustelussa ja kello yläpalkissa. Viesti odottaa kentässä ja
lähtee heti, kun agentti on taas linjoilla.

**Uutta kaikissa riffeissä, ja se näkyy oletusnäkymässä:** epäonnistunut
viesti on kentässä, ja kentän alla lukee *Odottaa kentässä · lähtee itse
heti, kun olet kirjautunut*. Kirjautumisen jälkeen viesti lähtee
painamatta, sellaisena kuin kenttä sen silloin sisältää. Ihminen voi
muokata tekstiä tai tyhjentää kentän sillä välin. Kentän yllä lukee
korjauksen jälkeen *Claude-tilaus kirjautunut. Viestisi lähti.* Kierroksella
1 viesti odotti kentässä Lähetä-painallusta.

Kierros on rakennettu samoista tuotannon komponenteista kuin kierros 1
(`AppShell`, `WorkspaceRail`, `AgentNavItem`, `AgentHeader`, `StatusBell`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`, `Composer`,
`WarningBanner`, `PiDeviceSignIn`, `SignInSteps`, `AccountShelf` ja koko
`AccountSettings` Tekoäly-osioineen). Host on `fetch`-sijainen, joka vastaa
sopimusten mukaan. Kierroksen omia ovat varoitus- ja kellotekstit, ikkuna,
B3:n vuorokortin sisältö ja kentän alla oleva odotusrivi. Rivillä on
tuotannon `ah-composer-reason`-ulkoasu, mutta tuotannon `Composer` ei osaa
näyttää syyriviä muokattavan kentän alla, joten kierros piirtää sen itse
komposerin viimeiseksi riviksi. Kaikki on synteettistä.

## Riffit

Kaksi avointa kysymystä: (a) korjataanko asetussivulla vai ikkunassa, ja
(c) näkyykö epäonnistunut vuoro lyhyenä rivinä vai koko selityksenä.
B1:n ja B2:n ero vastaa kysymykseen (a), B2:n ja B3:n ero kysymykseen (c).

- **B1 Asetukset**: Kirjaudu uudelleen vie Asetukset › Tekoäly -sivulle, josta palataan itse keskusteluun. Epäonnistunut vuoro on lyhyt rivi.
- **B2 Ikkuna**: kirjautuminen aukeaa ikkunaan keskustelun päälle, eikä keskustelusta poistuta. Epäonnistunut vuoro on lyhyt rivi.
- **B3 Selitys**: ikkuna kuten B2, mutta epäonnistunut vuoro kertoo koko syyn, ja palvelun oman viestin saa auki.

Yläpalkin *Tilanne* vaihtaa syyn kuten kierroksella 1: Claude-tilaus
vanhentunut (oletus), ChatGPT-tilaus vanhentunut, OpenAI-avain peruttu tai
Claude ei vastaa (ylikuormitus). Ylikuormituksessa yläpalkissa on
*Simuloi: Claude vastaa taas*, joka seisoo palvelun toipumisen paikalla.
*Alusta* aloittaa alusta.

## Mitä kussakin tapahtuu

- **Kaikissa.** Rivi on Sinun vuorosissa: *Viesti odottaa kirjautumista*.
  Kello sanoo *Claude poikki*. *Kesäajan virhe* (sama palvelu) näyttää saman
  varoituksen. Jos siellä kirjoittaa ja lähettää, viesti jää odottamaan
  omaan kenttäänsä ja lähtee kirjautumisen jälkeen samalla tavalla.
  Ylikuormituksessa varoitus on harmaa eikä kelloa ole. Rivi pysyy
  Käynnissä-osiossa, koska ihmiseltä ei tarvita mitään (*Viesti odottaa:
  Claude ei vastaa*). Viesti lähtee itse, kun Claude vastaa taas.
- **B1.** *Kirjaudu uudelleen* (varoituksesta tai kellosta) vie Asetukset ›
  Tekoäly -sivulle Clauden rivin kohdalle (avain: API-avainrivi, ChatGPT:
  laitekoodisivu kuten kierroksella 1). Siellä painetaan vielä *Kirjaudu
  uudelleen*. Kun kirjautuminen on valmis, sovellus palaa keskusteluun ja
  viesti lähtee.
- **B2.** *Kirjaudu uudelleen* avaa ikkunan, jossa samat vaiheet alkavat
  heti (Clauden koodi, OpenAI:n laitekoodi tai uusi avain). Kun
  kirjautuminen on valmis, ikkuna sulkeutuu ja viesti lähtee. Keskustelu,
  varoitus ja kenttä näkyvät koko ajan ikkunan takana.
- **B3.** Kuten B2, mutta vuorokortti sanoo koko syyn (*Claude-kirjautumisesi
  on vanhentunut, eikä palvelin voi uusia sitä itse. Viestiäsi ei
  käsitelty.*), ja *Palvelun oma viesti* avaa raakatekstin. Varoitus kentän
  yllä sanoo osittain saman.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-tekoaly-kirjautuminen-riff/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-tekoaly-kirjautuminen-riff/check.mjs \
  design-system/prototypes/dist/tekoaly-kirjautuminen-riff/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen riffin läpi kaikissa neljässä tilanteessa 1440 px
vaaleana. Joka kerta se tarkistaa, että viesti odottaa kentässä ja rivi on
oikeassa osiossa. Sitten se muokkaa odottavaa viestiä, tekee korjauksen
riffin paikassa ja varmistaa, että muokattu teksti lähtee itse, kenttä
tyhjenee ja kello poistuu, ja odottaa vastauksen. B1:ssä myös toisen
keskustelun odottava viesti lähtee. Claude-kulku käydään myös tummana ja
390 px:n kosketuksella, avain puhelimessa ja oletusnäkymät 390 px:n
tummana. Kuvat otetaan kertoimella 2, ja konsolin pitää pysyä puhtaana.
`index.html` on sama sivu ilman upotettuja fontteja glasspadia varten.
