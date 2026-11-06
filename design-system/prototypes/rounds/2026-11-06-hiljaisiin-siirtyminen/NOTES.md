# Sinun vuorosi ↔ Hiljaiset: laukaisijat – kierros 1

Issue `proto-quiet-transition-triggers`. Jari 6.11.: keskustelut putoavat
liian helposti Hiljaisiin, kun hän käy keskustelussa eikä vastaa heti vaan
siirtyy kiireesti muualle. Kierros näyttää, mikä siirtää keskustelun
Sinun vuorosista Hiljaisiin ja takaisin. Rakennettu tuotannon
komponenteista (`AppShell`, `WorkspaceRail`, `AgentNavItem`,
`WorkspaceNavRow`, `AgentHeader`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `Menu`, `Button`, `Composer`; osioiden ja Hiljaisten
otsakkeen luokat tuotannon CSS:stä). Kierroksen omia ovat rivin alle tuleva
syyrivi, renkaaksi muuttuva pallo, kentän yllä oleva ilmoitusrivi ja
yläreunan päivänauha. Kaikki on synteettistä. Hostin faktat ja nykyinen
sääntö ovat issuen `result.md`:ssä.

## Suunnat

Akseli: mikä laukaisee siirtymän Sinun vuorosi → Hiljaiset ja Hiljaiset →
Sinun vuorosi.

- **Nyt**: avaaminen kuittaa heti, kun keskustelu näkyy, vaikka vilkaisisit vain sekunnin. Takaisin Sinun vuoroosi vain agentin uudesta vastauksesta tai kysymyksestä.
- **A Vastaus**: Sinun vuorosi pysyy, kunnes vastaat agentille tai valitset Ei nyt. Avaaminen vain sammuttaa pallon renkaaksi (Luettu). Takaisin agentin uudesta vastauksesta.
- **B Luku**: kuittaa vasta luettu: auki 20 s ja vastauksen loppu näkyi. Vilkaisu jää Sinun vuoroosi, ja luettu siirtyy Hiljaisiin vasta kun poistut. Takaisin agentin uudesta vastauksesta.
- **C Paluu**: avaaminen kuittaa kuten nyt, mutta vastaamatta jätetty palaa Sinun vuoroosi 2 tunnin päästä (Palasi). Avoin keskustelu kertoo milloin, ja ajan voi vaihtaa.

## Päivä

Sama käsikirjoitettu päivä toistetaan jokaisen säännön alla. Yläreunan
nauhassa on sarake kullekin hetkelle ja rivi kolmelle keskustelulle; solu
kertoo, missä keskustelu oli silloin (sävytetty = Sinun vuorosi, rengas =
avattu mutta hoitamatta). Sarakkeen tai ‹ ›-painikkeen valinta vie
hetkeen, ja sen jälkeen näkymää voi käyttää vapaasti.

1. 9.16 Laskun muistutus ja NDA-viestin tarkistus valmistuvat.
2. 9.20 Avaat NDA:n.
3. 9.20 12 sekunnin päästä puhelin soi; siirryt Kesäajan virheeseen ja lähetät sinne viestin.
4. 9.25 Luet Laskun luonnoksen kokonaan (2 min).
5. 9.27 Palaat Kesäajan virheeseen; Laskuun ei tarvitse vastata.
6. 9.30 Kokoukseen, välilehti piiloon.
7. 11.30 Kesäajan virhe valmistui 9.41 poissa ollessasi.
8. **12.40 Palaat koneelle** (oletusnäkymä).
9. 12.42 Vastaat NDA:han.

Oletusnäkymä 12.40: **Nyt** sanoo *Mikään ei odota sinua*, vaikka NDA on
vastaamatta. **A**:ssa Sinun vuorosissa on kolme rengasta (myös luettu
Lasku ja juuri nähty Kesäaika). **B**:ssä NDA (*Vilkaisit 12 s*) ja
Kesäaika (*Luet nyt*), Lasku on Hiljaisissa. **C**:ssä NDA ja Lasku
(*Palasi · et vastannut*), Kesäaika Hiljaisissa *Palaa 14.40*.

## Mitä kussakin voi tehdä

- **Nyt.** Avaa NDA: se on jo Hiljaisissa, eikä mikään palauta sitä.
- **A.** Avattu keskustelu pysyy, ja kentän yllä lukee *Pysyy Sinun
  vuorosissasi, kunnes vastaat agentille.* sekä *Ei nyt*. Lähettäminen vie
  sen Käynnissä-osioon; agentin vastaus tuo sen takaisin.
- **B.** Kentän yllä *Luet tätä · 7/20 s*; 20 sekunnin jälkeen *Luettu.
  Siirtyy Hiljaisiin, kun poistut.* Rivi pysyy paikallaan, kunnes avaat
  muun.
- **C.** Avattu siirtyy heti Hiljaisiin, ja kentän yllä *Palaa Sinun
  vuoroosi 14.40, jos et vastaa.* sekä *Muuta*: tunnin päästä, 2 tunnin
  päästä, huomenna klo 9, ei palaa. Palaa kerran; uudelleen avattu saa uuden
  ajan.

Jokaisessa suunnassa viestin lähettäminen tuo agentin vastauksen 2,5
sekunnin päästä, ja suunnan sääntö pätee siihen.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-hiljaisiin-siirtyminen/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-hiljaisiin-siirtyminen/check.mjs \
  design-system/prototypes/dist/hiljaisiin-siirtyminen/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-tilan ja jokaisen suunnan läpi vaaleana ja tummana,
1440 px osoittimella ja 390 px kosketuksella, valekellolla (B:n 20 s):
oletushetki, kiireinen poistuminen 9.20, NDA:n avaaminen suunnan tavalla
(A *Ei nyt*, B luettu ja poistuminen, C paluuajan muutos), 12.42 vastaaminen
ja elävä vastaus. 252 tarkistuspistettä, konsoli puhdas, kuvat kertoimella
2. `index.html` on sama ilman upotettuja fontteja glasspadia varten.

Syyrivi on kierroksessa tuotannon rivin alla omana kappaleenaan;
toteutuksessa se olisi `NavLink`in `line`-paikka, jota työpuun rivit jo
käyttävät.
