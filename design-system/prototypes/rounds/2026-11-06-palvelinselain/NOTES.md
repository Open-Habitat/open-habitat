# Oma palvelinselain – kierros 1

Issue `proto-remote-browser-session`. Jari (6.11.2026): henkilöllä on
palvelimella oma selain. Hän avaa sen etänäkymänä Habitatissa, kirjautuu
sillä palveluun ja sulkee näkymän, minkä jälkeen agentti käyttää samaa
kirjautunutta selainta. Kierros kysyy, missä selain asuu Habitatissa.

Kierros on rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`AgentNavItem`, `AgentHeader`, `ConversationTimeline`, `UserMessage`,
`AgentTurn`, `PiToolUse`, `Composer`, `ViewSplit`, `ControlButton`,
`Segmented`, react-aria `Modal`). Etäselain on mock: kehys, osoiterivi ja
yksinkertainen Netvisor-tyylinen sivu, jonka värit ovat sivuston omat eivätkä
Habitatin (etäselain näyttää sivuston sellaisenaan myös tummassa teemassa).
Kaikki on synteettistä: Contoso, Aino Virtanen, keskustelu "Lokakuun
ostolaskut".

## Akseli ja suunnat

Akseli: missä henkilön palvelinselain asuu Habitatissa.

- **1 Rinnakkain**: selain avautuu keskustelun viereen kuten editori; yläpalkin Selain-painike, ohjaus ja agentin nykyinen toimi paneelin alalaidassa.
- **2 Oma näkymä**: selain on sivupalkissa omana kohtanaan ja avautuu koko näkymäksi; vieressä Agentin toimet -loki kaikista keskusteluista.
- **3 Pyydettäessä**: selainta ei näy ennen kuin sitä tarvitaan; se avautuu arkkina keskustelun päälle, ja agentin työ näkyy keskustelussa pienenä elävänä kuvana.

Suositus: **1 Rinnakkain** (issuen `result.md`).

## Sama kaikissa suunnissa

- Tarina: Aino pyytää hakemaan lokakuun ostolaskut Netvisorista. Agentti
  toteaa, ettei rajapinta-avainta ole, ja pyytää kirjautumaan omaan
  selaimeen (pyyntökortti keskustelussa). Aino kirjautuu (salasana, sitten
  tunnistussovelluksen koodi) ja painaa **Valmis, agentti jatkaa**.
  Agentti tarkistaa ensin itse sivulta, että Aino on kirjautunut ("Etusivulla
  lukee Aino Virtanen"), avaa ostolaskut, rajaa lokakuun ja lataa kuusi
  laskua. Sitten Netvisor pyytää koodia uudelleen; agentti pysähtyy ja
  pyytää Ainoa (toinen pyyntökortti). Aino syöttää koodin, antaa selaimen
  takaisin, ja agentti lataa loput ja kirjoittaa yhteenvedon.
- Ohjaus on aina yhdellä kerrallaan, ja se sanotaan sanoin ja kuvakkeella:
  *Sinä ohjaat*, *Agentti käyttää*, *Sinä ohjaat · agentti odottaa*.
  Kun agentti käyttää selainta, etänäkymä on vain katseltava: klikkaus kertoo,
  että ohjauksen voi ottaa. Agentin osoitin näkyy nimettynä pisteenä.
- **Ota ohjaus** pysäyttää agentin heti; **Anna takaisin agentille**
  jatkaa. Valmis-painike on harmaa, kunnes sivu näyttää kirjautuneen tilan.
- Agentin jokainen selaintoimi on tavallinen työkalurivi `selain` sen omassa
  keskustelussa (natiivi historia). Pi:n tuotannon live-työnäkymä pinoaa
  valmiit rivit; se on tuotannon käytöstä eikä kierroksen valinta.
- Sulkeminen ei kirjaa ulos: selain jää palvelimelle kirjautuneena.

## Mitä suunnat päättävät

- **1** pitää selaimen samassa paikassa kuin editorin ja näkymät
  (`ViewSplit`): yläpalkin maapallopainike avaa ja sulkee sen, ja piste
  painikkeessa kertoo, että agentti käyttää selainta paneelin ollessa kiinni.
  Puhelimessa paneeli peittää keskustelun kuten muutkin näkymät.
- **2** tekee selaimesta henkilön oman paikan keskustelujen yläpuolelle:
  sivupalkin rivi kertoo tilan (*Ei kirjautunut*, *Netvisor · kirjautunut*,
  *Agentti käyttää*, *Odottaa sinua*). Näkymässä on lisäksi loki kaikkien
  keskustelujen selaintoimista, myös eiliseltä. Keskustelussa on vain
  rivi "Agentti käyttää omaa selaintasi · Avaa selain". Puhelimessa selain
  ja loki ovat välilehtinä.
- **3** ei lisää Habitatiin pysyvää paikkaa: selain avautuu vain agentin
  pyyntökortista tai elävästä kuvasta, modaalina arkkina (puhelimessa
  alhaalta). Luovutus sulkee arkin itse, ja työ näkyy keskustelussa
  pienoiskuvana, jossa on *Näytä isona* ja *Ota ohjaus*. Henkilö, joka haluaa
  avata selaimen ilman agentin pyyntöä, pyytää sitä agentilta.

## Ohjaimet

Yläpalkissa: teema, **Alusta** (selain auki kirjautumissivulla, oletus) ja
**Alusta suljettuna** (selain kiinni, näkyy suunnan sisäänkäynti). Valitsin
alhaalla vaihtaa suuntaa. Koodikenttään kelpaa mikä tahansa kuusi numeroa.
Agentti etenee noin sekunnin välein. Suunnassa 3 arkki on modaali: sulje se
(Esc tai ×) ennen kuin painat Alusta.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-06-palvelinselain/build.mjs
node design-system/prototypes/rounds/2026-11-06-palvelinselain/check.mjs \
  design-system/prototypes/dist/palvelinselain/offline.html <kuvahakemisto>
```

`build.mjs` tarvitsee `web/node_modules`-hakemiston committoidusta lukosta.
`check.mjs` käy jokaisen suunnan koko tarinan läpi 1440 ja 390 px vaaleana,
oletukset myös tummana, ja kirjoittaa kuvat kertoimella 2.
