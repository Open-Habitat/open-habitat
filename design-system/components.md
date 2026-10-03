# Tuotantokomponentit

Sovellus ja Storybook käyttävät samoja komponentteja
[`web/src/components/`](../web/src/components/)-hakemistosta. Propsit ja
käyttäjän tapahtumat määritellään niiden TypeScript-lähteissä. Storyt näyttävät
komponenttien esitystilat valmiilla näyttömalleilla.

| Osa | Lähde |
|---|---|
| Painikkeet, kentät ja valinnat | `Primitives.tsx` |
| Valikot ja dialogit | `Overlays.tsx` |
| Ikonit ja tilamerkinnät | `Icon.tsx`, `Status.tsx` |
| Sovelluskehys ja navigaatio | `Navigation.tsx`, `ConversationFrame.tsx` |
| Tilivalikko ja asetukset | `Account.tsx` |
| Keskustelu, kirjoituskenttä ja jonot | `Conversation.tsx`, `AgentInteractionControls.tsx` |
| Markdown ja koodi | `Markdown.tsx` |
| Työn eteneminen ja operaatiot | `WorkingProgress.tsx`, `Operations.tsx` |
| Käyttöönotto | `GitHubRepoChooser.tsx`, `PiDeviceSignIn.tsx` |

`index.ts` kokoaa viennit. Samassa hakemistossa olevat `*.stories.tsx`-tiedostot
muodostavat ajettavan katalogin. [Design system](../docs/design-system.md)
kertoo sen avaamisesta ja tarkistamisesta.

Designer suunnittelee keskustelulohkot ja niiden esitystilat. Kunkin lohkon
merkityksen, käsittelijän ja katalogiesimerkin pitää löytyä yhdessä;
[@raw-thinking-history-blocks](../issues/raw-thinking-history-blocks/item.md)
kokoaa tämän työn. Näkymän tarvitsema uusi komponentti täydentää samaa kirjastoa.
