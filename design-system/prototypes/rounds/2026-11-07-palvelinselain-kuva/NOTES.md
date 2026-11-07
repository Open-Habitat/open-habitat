# Oma palvelinselain – kierros 2: pienoiskuva

Issue `proto-remote-browser-session`. Jari valitsi 7.11.2026 kierroksen 1
suunnan **3 Pyydettäessä**: selain avautuu arkkina keskustelun päälle vasta,
kun sitä tarvitaan, ja agentin työ näkyy keskustelussa pienoiskuvana, kun
arkki on kiinni. Tämä kierros riffaa sitä pienoiskuvaa: mitä se näyttää,
kuinka iso se on, miten se avaa arkin, miltä se näyttää, kun agentti on
valmis tai odottaa henkilöä, ja miten henkilö näkee, mikä keskustelu
selainta käyttää, kun toinen keskustelu haluaa sen.

Kierros on rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`AgentNavItem`, `AgentHeader`, `ConversationFrame`, `ConversationFloatingAction`,
`ConversationTimeline`, `UserMessage`, `AgentTurn`, `PiToolUse`, `Composer`,
`ControlButton`, react-aria `Modal`). Etäselain on sama mock kuin
kierroksella 1, ja mukana on toinen sivusto (rekrytointihaku). Kaikki on
synteettistä.

## Riffit

- **1 Kuva keskustelussa**: iso elävä kuva keskustelun lopussa; kun agentti odottaa sinua, kuva on itse pyyntö, ja toisen keskustelun kuva kertoo, kuka selainta käyttää.
- **2 Palkki kentän yllä**: kapea palkki pienellä kuvalla kirjoituskentän yllä kaikissa keskusteluissa; se nimeää keskustelun, joka selainta käyttää, ja sen, joka odottaa.
- **3 Kelluva ikkuna**: pieni ikkuna keskustelun nurkassa seuraa sinua keskustelusta toiseen; otsikko on selainta käyttävä keskustelu, ja valmiina ikkuna kutistuu napiksi.

Suositus: **1 Kuva keskustelussa** (issuen `result.md`).

## Sama kaikissa

- Tarina jatkuu kierroksesta 1: Aino on kirjautunut Netvisoriin ja antanut
  selaimen agentille. Keskustelun *Lokakuun ostolaskut* agentti lataa
  laskuja. Samaan aikaan keskustelun *Rekrytointi: myyjä* agentti yritti
  avata LinkedIn Recruiterin, sai vastauksen "selain on toisen keskustelun
  käytössä" (tavallinen epäonnistunut `selain`-rivi) ja odottaa vuoroaan.
- Selain on yksi ja Ainon oma. Ohjaa yksi kerrallaan: agentti, toinen
  agentti tai Aino. Kun ostolaskut on valmis, selain siirtyy itsestään
  odottavalle keskustelulle. **Siirrä tälle** antaa selaimen odottavalle
  keskustelulle heti, ja keskeytetty keskustelu odottaa vuoroaan ja jatkaa,
  kun selain vapautuu.
- Sivupalkki kertoo sanoin, mitä kukin keskustelu tekee: *Käyttää selainta*,
  *Odottaa selainta*, *Odottaa sinua*.
- Kuvan painaminen avaa arkin (kierroksen 1 arkki), jossa näkyy sama
  selain. Agentin ohjatessa arkki on vain katseltava. **Ota ohjaus** ja
  **Anna takaisin agentille** toimivat kuten kierroksella 1.
- Kun Netvisor pyytää koodia kesken työn, agentti pysähtyy ja **Syötä koodi**
  avaa arkin koodisivulle.

## Mitä riffit päättävät

- **1** pitää kuvan keskustelun historiassa, sen keskustelun lopussa, joka
  selainta käyttää. Kuva on iso (352 × 220 px, puhelimessa koko leveys), joten
  sivun sisällön näkee arkkia avaamatta. Pyyntö ja kuva ovat sama kortti.
  Odottavassa keskustelussa on vastaava kortti, jossa on haalistettu kuva
  siitä, mitä toinen keskustelu tekee, ja *Siirrä tälle*. Valmiina kuva
  jähmettyy pieneksi viimeiseen sivuun: *Valmis klo 10.19 · 7 tointa*.
  Vierittäessä kuva katoaa historian mukana.
- **2** tekee selaimesta henkilön yhteisen tilan, joka näkyy samassa
  kohdassa kaikissa keskusteluissa: palkki kentän yllä (kuva 80 × 50 px).
  Palkki sanoo aina, kuka selainta käyttää ja kuka odottaa. Kun agentti
  tarvitsee henkilöä, palkki muuttuu pyynnöksi. Valmiina palkki poistuu ja
  jättää keskusteluun rivin *Agentti käytti selaintasi klo 10.14–10.19*.
  Kuva on niin pieni, että sivua ei tunnista, vaan se kertoo lähinnä, että
  selain on käytössä.
- **3** on sama yhteinen tila kelluvana ikkunana (kuva 238 × 149 px), joka
  pysyy näkyvissä vierittäessä ja keskustelua vaihdettaessa. Otsikko on
  selainta käyttävän keskustelun nimi, ja sitä painamalla pääsee siihen
  keskusteluun. Ikkunan voi pienentää napiksi. Valmiina ikkuna kutistuu
  napiksi *Selain vapaa · kirjautunut*. Ikkuna peittää osan keskustelusta,
  puhelimessa noin puolet leveydestä.

## Ohjaimet

Yläpalkissa ovat teema ja keskustelu (sama kuin sivupalkin valinta;
puhelimessa sivupalkki on valikon takana) sekä kolme kohtausta: **Alusta**
(agentti työssä, oletus), **Odottaa sinua** (Netvisor pyytää koodia) ja
**Valmis** (ostolaskut valmis, selain siirtyi rekrytoinnille, joka on valmis
muutaman sekunnin päästä). Agentti etenee noin kahden sekunnin välein.
Koodikenttään kelpaa mikä tahansa kuusi numeroa. Valitsin alhaalla vaihtaa
riffiä.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-07-palvelinselain-kuva/build.mjs
node design-system/prototypes/rounds/2026-11-07-palvelinselain-kuva/check.mjs \
  design-system/prototypes/dist/palvelinselain-kuva/offline.html <kuvahakemisto>
```

`build.mjs` tarvitsee `web/node_modules`-hakemiston committoidusta lukosta.
`check.mjs` käy jokaisen riffin tarinan läpi 1440 ja 390 px vaaleana,
oletukset myös tummana, ja kirjoittaa kuvat kertoimella 2.
