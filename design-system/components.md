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
| Keskustelu, kirjoituskenttä ja jonot | `Conversation.tsx`, `AgentInteractionControls.tsx` |
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
`--ah-muted`, `--ah-accent`). Yhteinen resepti on
`web/src/components/interactive.module.css`; arvot ovat **väliaikaisia**, eivät
hyväksytty design. @design-control-states päättää lopullisen tilamatriisin.

@migrate-bespoke-controls siirtää jäljellä olevat käsin tyylitetyt kontrollit
(kuten työtilan avausnuolen, Tiedot-painikkeen, mobiilinavigaation,
työkalurivin avaajan, jonolinkit ja vain luku -alatunnisteen) sekä yhteiset
rivi- ja toimintoriviasettelut. @refine-agent-status päättää agentin tilojen
merkitykset; tämä kontrollityö ei tulkitse niitä uudelleen.

Designer suunnittelee keskustelulohkot ja niiden esitystilat. Kunkin lohkon
merkityksen, käsittelijän ja katalogiesimerkin pitää löytyä yhdessä;
[@raw-thinking-history-blocks](../issues/raw-thinking-history-blocks/item.md)
kokoaa tämän työn. Näkymän tarvitsema uusi komponentti täydentää samaa kirjastoa.
