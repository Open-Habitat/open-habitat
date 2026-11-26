# Vastaa näkymään tai tiedostoon – kierros 1

Issue `reply-view-file`. Jari 26.11.2026: kokeellisen vastaa viestiin
-toiminnon ↩ myös näkymä- ja tiedostokortteihin; prototyyppikorttiin
vastaaminen on tapa vastata sen kysymyksiin. Suositus ja päätökset ovat
issuen `result.md`:ssä.

Suunnat: Nyt (tuotanto tänään: korteissa ei ↩:ta), A Kulmassa, B Rivissä ja
C Tiedostoon. Keskustelu on sama kaikissa: näkymäkortti (pitkä otsikko),
yhden tiedoston kortti (PDF) ja kolmen tiedoston paketti, lähetetty vastaus
PDF:ään ja kesken oleva vastaus näkymään. Paketin kortti avaa tuotannon
`OfferPanel`in tiedostolistan oikealle (puhelimessa keskustelun päälle).
Oikean sarakkeen *Mitä agentti saa* näyttää `<reply-to>`-lohkon täsmälleen
sellaisena kuin daemon sen kirjoittaisi.

Tuotannosta, muuttamatta: `ConversationFrame`, `AgentHeader`,
`ConversationTimeline`, `UserMessage` (`quote`), `AgentTurn` viestien omine
↩-painikkeineen (`ReplyContext`), `ToolRow`, `Markdown`, `Composer`
(`fieldQuote`), `ViewOfferCard`, `FileOfferCard`, `OfferCard`,
`OfferActions` (`children`), `OfferMark`, `OfferPanel`, `ViewHeader`,
`ComposerQuote` ja `SentQuote`. Kierroksen omia ovat kortin ↩ (A ja C kortin
kulman päällä, B `OfferActions`in lapsena, C:ssä myös paketin rivien
ikoniryhmässä portaalilla), tarjouksen lainaus kentässä ja lähetetyssä
viestissä (tuotannon lainausluokat), hyppy korttiin (`data-located`) ja
lohkosarake. Ei kuvia eikä tiedostojen esikatselua, koska ne hakisivat
tavuja verkosta.

## Rakentaminen ja tarkistus

```
ln -s <open-habitat>/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-26-reply-view-file/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-26-reply-view-file/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

Oletus-`<out>` on `design-system/prototypes/dist/2026-11-26-reply-view-file`.
`check.mjs` tarjoilee sivun näkymän hiekkalaatikon CSP:llä ja käy kaikki
suunnat Päivä-, Yö- ja Korkea kontrasti -teemassa 1440 ja 390 px
vähennetyllä liikkeellä suomeksi ja kahdesti englanniksi. `DIRS=1,3` ja
`WIDTHS=390` rajaavat ajon vianetsintää varten.

Playwrightin koko sivun kuvakaappaus emuloidulla puhelimella nollaa
kosketuksen mediakyselyn (`hover: none` lakkaa täsmäämästä), ja sen jälkeen
kortin ikonirivi on piilossa kuin työpöydällä. Siksi puhelimen kuvat ovat
näkymän kokoisia keskustelun kehyksen kohdalta, ja jokainen kuva tarkistaa,
että kosketuksen media on yhä voimassa.
