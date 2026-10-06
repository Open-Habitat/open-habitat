# Tuotantokomponentit

Sovellus ja Storybook käyttävät samoja komponentteja
[`web/src/components/`](../web/src/components/)-hakemistosta. Propsit ja
käyttäjän tapahtumat määritellään niiden TypeScript-lähteissä. Storyt näyttävät
komponenttien esitystilat valmiilla näyttömalleilla.

| Osa | Lähde |
|---|---|
| Painikkeet, kentät ja valinnat | `Primitives.tsx`, `ControlElements.tsx` |
| Valikot ja dialogit | `Overlays.tsx`, `ControlElements.tsx` |
| Ikonit ja tilamerkinnät | `Icon.tsx`, `Status.tsx` |
| Sovelluskehys ja navigaatio | `Navigation.tsx`, `ConversationFrame.tsx` |
| Tilivalikko ja asetukset | `Account.tsx` |
| Keskustelu, kirjoituskenttä ja jonot | `Conversation.tsx`, `AgentInteractionControls.tsx`, `ArchiveControls.tsx` |
| Markdown ja koodi | `Markdown.tsx` |
| Työn eteneminen ja operaatiot | `WorkingProgress.tsx`, `Operations.tsx` |
| Käyttöönotto | `GitHubRepoChooser.tsx`, `PiDeviceSignIn.tsx` |

`index.ts` kokoaa viennit. Samassa hakemistossa olevat `*.stories.tsx`-tiedostot
muodostavat ajettavan katalogin.

Katalogin voi avata kehityspalvelimena tai rakentaa staattiseksi:

```sh
npm ci --prefix web
npm run storybook --prefix web -- --no-open
npm run build-storybook --prefix web
```

Storybookin työkaluriviltä voi vaihtaa vaalean ja tumman teeman.
Storyt näyttävät komponenttien esitystilat synteettisillä tiedoilla;
ne eivät simuloi sessiosidontaa, reititystä tai Pi:n kuittauksia.
[Tarkistukset](../TESTING.md#component-catalog-and-visual-checks) kuvaavat
katalogin rakentamisen sekä komponentti-, kuva- ja saavutettavuustestit.

`ControlStates.stories.tsx` näyttää oikeat painikkeet, ikonipainikkeen,
navigaatio- ja listarivin, tilavalikon, avattavan kontrollin ja kentän molemmissa
teemoissa. Hover, painettu, näppäimistöfokus, nykyinen/valittu, estetty ja
odottava tila käyttävät toistaiseksi nykyisen paletin arvoja
(`--ah-surface-2`, `--ah-accent-soft`, `--ah-accent-line`, `--ah-line`,
`--ah-muted`, `--ah-accent`). Yhteinen nykyinen resepti on
`web/src/components/interactive.module.css`; nämä tuotannon arvot ovat
**väliaikaisia**. Hyväksytty esitystavoite, kummankin teeman soveltuvat tilat
ja ehdotetut tokenit ovat
[Kontrollitilat ja agentin tila](drafts/Kontrollitilat%20ja%20agentin%20tila.dc.html)
-vedoksessa. @apply-control-state-design sovittaa ne todellisiin
komponentteihin ja testaa käytöksen: vedoksen ehdottama CSS tai
`AgentPresentation`-prop ei itsessään määrää tuotannon API:a. Agentin
aktiivisuus, huomio, kirjoitusoikeus ja operaatiot muodostavat erilliset
esityskanavat, joiden faktat johdetaan sovelluksessa, ei Status-komponentissa.

@migrate-bespoke-controls siirtää jäljellä olevat käsin tyylitetyt kontrollit
(kuten työtilan avausnuolen, Tiedot-painikkeen, mobiilinavigaation,
työkalurivin avaajan, jonolinkit ja vain luku -alatunnisteen) sekä yhteiset
rivi- ja toimintoriviasettelut. @refine-agent-status päättää agentin tilojen
merkitykset; tämä kontrollityö ei tulkitse niitä uudelleen.

[Pi-keskustelun lohkot](drafts/Pi-keskustelun%20lohkot.dc.html) on näkyvien
Pi-sisältöjen suunnittelutavoite; nykyinen `Conversation.tsx` ja
`WorkingProgress.tsx` ovat vielä väliaikainen toteutus. Työkalun kutsu,
elävä eteneminen ja tallennettu tulos tarvitsevat yhden saman avattavan
esityksen. Historialla ja elävällä näkymällä on yhteiset tulkinnat myös
paikalliselle komennolle, ajattelulle, tiivistelmille ja tuntemattomille
lohkoille. Kunkin lohkon merkityksen, käsittelijän, designin ja katalogin
esimerkin pitää löytyä yhdessä. Vedoksen ehdottamat komponenttinimet
(esimerkiksi `ToolUse`, `TurnFooter` ja `BlockReader`) eivät määrää tuotannon
prop-API:a eivätkä oikeuta uuden pysyvän kysymyshistorian tekemiseen; hostin
vahvistetut faktat ja käytettävissä olevat natiivilohkoluvut rajaavat esitystä.
[@design-pi-event-blocks](../issues/design-pi-event-blocks/item.md) tallentaa
sovituspäätökset. Aiempi
[@raw-thinking-history-blocks](../issues/raw-thinking-history-blocks/item.md)
selitti alkuperäisen oireen ja on suljettu vanhentuneena.
