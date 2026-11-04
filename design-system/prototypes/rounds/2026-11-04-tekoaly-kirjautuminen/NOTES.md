# Tekoälyn kirjautuminen vanhentui – kierros 1

Issue `proto-ai-sign-in-expired`. Lähtökohta on Jarin tilanne 4.11.:
Claude-tilauksen kirjautuminen oli vanhentunut, ja viestin jälkeen
vastauskortissa luki *Vastaus valmis* ja palveluntarjoajan oma virhe
"Failed to authenticate: OAuth session expired and could not be refreshed".
Mikään ei kertonut, mitä tehdä. Hän löysi korjauksen itse: Asetukset ›
Tekoäly ja uusi kirjautuminen.

Kierros on rakennettu tuotannon komponenteista (`AppShell`,
`WorkspaceRail`, `AgentNavItem`, `AgentHeader`, `StatusBell`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`,
`WaitingMessage`, `Composer`, `WarningBanner`, `PiDeviceSignIn`,
`SignInSteps`, `AccountShelf` sekä koko `AccountSettings` Tekoäly-osioineen,
jossa ovat oikeat Claude-, ChatGPT- ja API-avainrivit). Hostin paikalla on
`fetch`-sijainen, joka vastaa sopimusten (`claude-login`, `pi-credentials`,
`pi-models`) mukaan, joten asetusrivien painikkeet tekevät saman kuin
tuotannossa. Palveluntarjoajan sivu (Claude, OpenAI) ei aukea; kierros
näyttää yläreunassa, mitä siellä tapahtuisi, ja antaa Clauden koodin.
Kierroksen omia ovat A:n vuorokortin sisältö, B:n varoitus- ja
kellotekstit, C:n odottavan viestin rivi, kaistale ja ikkuna sekä
sanamuodot. Kaikki on synteettistä.

Hostin faktat ja tarpeet ovat issuen `result.md`:ssä.

## Suunnat

Akseli: missä epäonnistunut lähetys kertoo, että tekoälyn kirjautuminen
pitää uusia, ja mistä sen uusii.

- **Nyt**: virhe näkyy valmiina vastauksena palveluntarjoajan omin sanoin, keskustelu jää Käynnissä-osioon, ja korjaus löytyy itse Asetukset › Tekoäly -sivulta.
- **A Vuoro**: epäonnistunut vuoro kertoo syyn ja kirjautuu kortissa paikan päällä; sen jälkeen kortissa on Lähetä uudelleen. Muualla ei näy mitään.
- **B Kenttä**: kuten GitHub-varoitus. Kentän yllä varoitus jokaisessa saman palvelun keskustelussa ja kello yläpalkissa; korjaus Asetukset › Tekoäly -sivulla, josta palataan viesti kentässä.
- **C Odottaa**: viesti ei lähtenyt vaan odottaa. Kaistale jokaisen keskustelun yläpalkin alla kertoo syyn, kirjautuminen aukeaa ikkunaan, ja viesti lähtee itse kirjautumisen jälkeen.

Oletusnäkymä on kaikissa sama hetki: olet juuri lähettänyt *Viikon tunnit*
-keskusteluun viestin, ja se epäonnistui. Yläpalkin *Tilanne*-valinta vaihtaa
syyn: Claude-tilaus vanhentunut (oletus, Jarin tilanne), ChatGPT-tilaus
vanhentunut, OpenAI-avain peruttu tai Claude ei vastaa (ylikuormitus, ei
kirjautumisvika). *Alusta* aloittaa alusta.

## Mitä kussakin tapahtuu

- **Nyt.** Claude: *Vastaus valmis* ja raaka virhe; rivi jää Käynnissä-osioon
  kuin työ jatkuisi. Tilivalikon Asetukset › Tekoäly sanoo Claude-rivillä
  *Kirjautunut* (`claude auth status` lukee tallennetun kirjautumisen eikä
  kokeile sitä). *Kirjaudu uudelleen* → Clauden sivu → koodi → *Vahvista
  Claude-koodi* toimii, mutta viesti pitää kirjoittaa uudelleen. ChatGPT ja
  avain: tuotannon nykyinen varoitus *Kielimallikirjautuminen ei ole
  kunnossa* (daemonin 401/403-tunnistus) ja *Kirjaudu uudelleen*, joka vie
  koko sivun tekoälyvaiheeseen; avaimen kohdalla se on väärä korjaus:
  ChatGPT-kirjautuminen ei vaihda avainta, ja lähetys epäonnistuu taas.
  Ylikuormitus: *Epäonnistui* ja raaka 529-viesti.
- **A.** Vuorokortissa *Epäonnistui*, syy suomeksi ja *Kirjaudu Claudeen*
  (*Kirjaudu ChatGPT:hen*, *Vaihda avain*). Painallus avaa saman
  kirjautumisen kuin asetuksissa kortin sisään; valmiina kortti sanoo
  *Claude-tilaus kirjautunut. Viestisi on tallessa.* ja *Lähetä viesti
  uudelleen* lähettää saman viestin. *Palvelun oma viesti* avaa raakatekstin.
  Rivi on Sinun vuorosissa epäonnistuneena. Muut Claude-keskustelut eivät
  kerro mitään ennen omaa epäonnistumistaan. Ylikuormitus: syy ja *Yritä
  uudelleen*, ei kirjautumista.
- **B.** Vuorokortissa vain lyhyt syy. Kentän yllä yhteinen varoitus
  (punainen, kuten GitHub-yhteys) jokaisessa saman palvelun keskustelussa,
  myös *Kesäajan virheessä*, ja yläpalkin kello sanoo *Claude poikki*.
  *Kirjaudu uudelleen* vie Asetukset › Tekoäly -sivulle Claude-rivin kohdalle
  (avain: API-avainrivi; ChatGPT: laitekoodisivu). Kun kirjautuminen on
  valmis, sovellus palaa keskusteluun itse: vihreä *Claude-tilaus
  kirjautunut. Viestisi on kentässä* ja viesti kentässä odottaa Lähetä-
  painallusta. Kello poistuu. Ylikuormitus: harmaa varoitus ilman kelloa ja
  viesti kentässä.
- **C.** Viestisi kupla on *Ei lähtenyt* (sama kuin agentin käynnistyksen
  epäonnistuessa), eikä vastauskorttia ole. Alla rivi: syy, *Viesti on
  tallessa ja lähtee, kun kirjaudut*, *Kirjaudu Claudeen* ja *Muokkaa*.
  Jokaisen keskustelun yläpalkin alla on punainen kaistale, joka kertoo myös
  odottavan viestin. Kirjautuminen aukeaa ikkunaan; kun se on valmis, ikkuna
  sulkeutuu ja viesti lähtee itse. *Muokkaa* palauttaa viestin kenttään.
  Ylikuormitus: ei kaistaletta; rivi sanoo *Claude ei vastaa · yritetään
  uudelleen… (1/3)*, ja viesti lähtee itse, kun palvelu vastaa (myös *Lähetä
  nyt*).

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-04-tekoaly-kirjautuminen/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-04-tekoaly-kirjautuminen/check.mjs \
  design-system/prototypes/dist/tekoaly-kirjautuminen/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-tilan ja jokaisen suunnan läpi kaikissa neljässä
tilanteessa 1440 px vaaleana: epäonnistunut lähetys, korjaus suunnan
paikassa (Clauden koodi, OpenAIn laitekoodi, uusi avain), paluu ja uusi
lähetys vastaukseen asti. Claude-kulku myös tummana ja 390 px
kosketuksella, avain myös puhelimessa, oletusnäkymät 390 px tummana.
Kuvat kertoimella 2, konsoli puhdas. `index.html` on sama ilman upotettuja
fontteja glasspadia varten.

Rakennus ratkaisee suhteelliset tuonnit tarkalla kirjainkoolla, koska
`web/src/app/AccountKeys.tsx` ja `accountKeys.ts` eroavat vain siinä ja
esbuildin hakemistovälimuisti sekoittaa ne.
