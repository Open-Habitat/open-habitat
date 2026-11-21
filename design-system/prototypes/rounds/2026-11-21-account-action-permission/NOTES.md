# Agentti kysyy luvan tilin toimelle

- **1 Kortti** (suositus): kysymys on kortti keskustelussa siinä kohdassa,
  jossa agentti pysähtyi. Kortissa ovat ikoni, "Agentti pyytää lupaa", tili,
  toimi ihmisen sanoin, mitä siitä seuraa, Tekninen kutsu (avattava) sekä
  Älä salli / Salli. Päätöksen jälkeen kortti tiivistyy riviksi
  (✓ Sallit / ✕ Et sallinut ja toimi), ja sen alle tulee itse kutsu
  tavallisena työkalurivinä.
- **2 Kenttä**: kysymys nousee kirjoituskentän paikalle, ja puhelimessa se on
  alalaidan arkki. Keskustelussa on vain rivi "Agentti odottaa lupaasi ·
  toimi". Päätöksen jälkeen rivi kertoo päätöksen ja kenttä palaa.
- **3 Työkalurivi**: kysymys on odottava työkalurivi (`delete-mail-folder
  Laskut 2024`, *odottaa lupaa*). Rivi on auki, ja sen sisällä ovat toimi,
  tili, seuraus ja painikkeet. Päätös näkyy rivin tilana.

Issue `agent-account-instructions-clarity`. Suunnat, ikonisuositus ja
kysymykset Jarille ovat issuen `result-permission.md`:ssä.

## Maailma

Aino Virtanen (synteettinen) on yhdistänyt Microsoft-tilin
`aino.virtanen@contoso.test`. Hän pyytää poistamaan postikansion Laskut 2024
ja jakamaan Perhe-kalenterin Villelle muokattavaksi. Agentti listaa kansiot
ja kalenterit (`ms-mail`, `ms-calendar`, tutkimuksen aluenimet), jonka
jälkeen tulee kaksi kysymystä peräkkäin, yksi kerrallaan, koska Pi:n
`confirm` odottaa vastausta ennen seuraavaa kutsua. Agentin loppuvastaus
kertoo, mitkä toimet tehtiin ja mitkä jäivät tekemättä. Yläpalkin "Toinen
pyyntö" lähettää uuden viestin (poista tiistain hammaslääkäri), jolloin
tulee kolmas kysymys. Odottaessa otsikkopalkin merkki on tilassa `waiting`,
ja ruudunlukijalle ja puhelimen otsikkoriville tila on "Odottaa lupaasi".
Kenttä näyttää Stop-painikkeen, koska vuoro on kesken.

Yläpalkin Ikoni-valinta vaihtaa ikonin kaikkiin suuntiin, ja Ikoniehdokkaat
avaa arkin, jossa viisi ehdokasta näkyy 16, 20 ja 24 px:n koossa,
tuotannon ikonien vieressä (shield, mail, calendar, trash) sekä kolmessa
paikassa: keskustelun rivissä, kortin otsikossa ja otsikkopalkin tilassa.
Ehdokkaat noudattavat `Icon.tsx`:n tyyliä: 24-ruudukko, viiva 1.8,
pyöreät päät.

`?theme=light|dark|contrast`, `?lang=en`, `?icon=<id>` ja `?sheet=1`
valitsevat alkutilan.

Sivu koostuu tuotannon osista: `AppShell`, `WorkspaceRail`,
`AccountShelf`, `AgentHeader`, `ConversationFrame`, `ConversationStream`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`, `ToolRow`,
`ControlButton`, `HabitatMark` ja `Composer`. Kierroksen omia osia ovat
kysymys, sen päätösrivi, odotusrivi, telakka ja ikonit. Rakennus ja
valitsin on kopioitu kierroksesta `2026-11-21-multiplayer-owner`. Valitsimen
nimet pidetään yhdellä rivillä samalla säännöllä kuin siellä.

## Hostin puoli

1. Habitatin Pi-laajennuksen `tool_call`-koukku tunnistaa nimetyt kutsut
   (poistot, lähetykset, kalenterin jakaminen ja sen muutokset;
   tutkimuksen 19 kutsua) ja kutsuu `ctx.ui.confirm(title, message)`.
   Kieltävä vastaus palauttaa `{ block: true, reason }`. Ilman selainta
   (`ctx.hasUI` false) kutsu estetään syyn kanssa.
2. Kortti tarvitsee enemmän kuin nykyinen kysymys (`question_kind`
   `confirm` ja vapaa `prompt`). Se tarvitsee tiedon, että kysymys on
   tilin toimen lupa, sekä toimen, tilin, seurauksen ja teknisen kutsun
   erikseen. Muuten selain joutuisi jäsentämään tekstiä. Tämä on
   sopimusmuutos (`contracts/v1/event.schema.json`), joten se suunnitellaan
   skeemasta alkaen. Toinen vaihtoehto on laajennuksen otsikkokäytäntö,
   jonka selain tunnistaa, mutta se olisi juuri sitä tekstin
   jäsentämistä.
3. Nimet ja määrät ("Laskut 2024", 37 viestiä) eivät ole kutsun
   argumenteissa, koska kutsu tuntee vain tunnisteen. Koukun pitää hakea
   ne lukevalla kutsulla ennen kysymistä, tai kysymys näyttää
   tunnisteen. Prototyyppi olettaa, että nimi ja määrä ovat saatavilla.
4. Seurauslause ei väitä mitään palautettavuudesta (siirtyykö kansio
   Poistetut-kansioon). Sitä ei ole todennettu Graphista.

Prototyyppi ei toteuta näistä mitään.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-21-account-action-permission/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 580 \
  node design-system/prototypes/rounds/2026-11-21-account-action-permission/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`<out>` on oletuksena `design-system/prototypes/dist/account-action-permission`.
`web/node_modules` vastaa lukkotiedostoa (`npm ci --prefix web`).
Rakennuksen CSS-varoitukset tulevat tuotannon `Controls.module.css`:stä.
Tarkistus: 550 tarkistusta ja puhdas konsoli 1440 ja 390 px:n leveydellä
Päivässä, Yössä ja Kontrastissa (kulku Päivässä ja Yössä), ikoniarkki
jokaisessa sekä englanniksi työpöydällä ja puhelimessa.
