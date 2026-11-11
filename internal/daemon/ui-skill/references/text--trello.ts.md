# text/trello.ts

Generated from web/src/text/trello.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// Trello through its own MCP server (mcp.trello.com), signed in by Pi with
// the person's Atlassian account. Same administrator policy as Atlassian's
// MCP server, so the request names the same settings.
export const trelloText = catalog(
  {
    waiting: "Jos kirjautuminen odottaa ylläpitäjän hyväksyntää",
    help: "Kopioi pyyntö ja toimita se ylläpitäjällesi. Habitat ei lähetä mitään. Odottaminen ei yksin kerro, että pyyntö olisi hyväksyttävänä.",
    request:
      "Haluan käyttää Trelloa Open Habitatin agenttien kautta omalla Atlassian-tililläni Trellon omalla MCP-palvelimella (https://mcp.trello.com/v1). Tarkistattehan organisaation Connectors → Atlassian MCP server -asetukset: onko Trello sallittu, Read- ja tarvittaessa Write-oikeudet sekä omat oikeuteni Workspaceihin ja tauluihin. Kirjautuminen käyttää natiivia loopback-paluuosoitetta http://127.0.0.1:<vaihtuva portti>/callback. Tarkistakaa ensin, sallivatko tuetut osoitteet sen jo; tarvittaessa Atlassianin dokumentoima sääntö on http://127.0.0.1:*/**. Sääntö sallii myös muut natiivit loopback-asiakkaat, ei vain Habitatia. Mahdollisen IP-sallintalistan tulee sallia Habitat-palvelimen ulospäin näkyvä IP-osoite. Habitat pyytää vain lukuoikeutta, kun valitsen vain luvun, mutta ei voi estää laajempaa lupaa: jos agenttien pitää vain lukea, rajatkaa Trello lukuun näissä asetuksissa. Tarkistetaan pyydetyt ja lopulta myönnetyt oikeudet yhdessä ennen käyttöä.",
    copy: "Kopioi pyyntö",
    workspaces:
      "Trello kysyy kirjautuessa, mihin Workspaceen yhteys pääsee. Jos tarvitset toisen Workspacen erikseen, lisää toinen Trello-yhteys. Jokainen yhteys on oma kirjautumisensa.",
    reauthorize:
      "Tämän yhteyden vanha kirjautuminen poistetaan ennen uuden luvan pyytämistä. Muut Trello-yhteydet säilyvät. Jos et viimeistele kirjautumista, yhteys jää kirjautumatta.",
    refused:
      "Trello-kirjautuminen evättiin. Paluuosoite ilmoitti access_denied. Se ei yksin kerro, oliko syy oma peruutuksesi vai organisaation sääntö.",
  },
  {
    waiting: "If sign-in is waiting for administrator approval",
    help: "Copy the request and give it to your administrator. Habitat sends nothing. Waiting alone does not prove that a request is pending approval.",
    request:
      "I want to use Trello through Open Habitat agents with my own Atlassian account, using Trello's own MCP server (https://mcp.trello.com/v1). Please check the Connectors → Atlassian MCP server settings: whether Trello is allowed, Read and, if needed, Write permissions, and my Workspace and board permissions. Sign-in uses the native loopback redirect http://127.0.0.1:<allocated port>/callback. First check whether the supported domains already allow it; if needed, Atlassian's documented rule is http://127.0.0.1:*/**. This permits other native loopback clients too, not only Habitat. Any IP allowlist must permit the Habitat server's outgoing IP address. When I choose read only, Habitat requests read permissions only but cannot prevent a broader grant: if agents must only read, please limit Trello to read in these settings. Let us check both requested and actually granted permissions together before use.",
    copy: "Copy request",
    workspaces:
      "Trello asks at sign-in which Workspace the connection may reach. If you need another Workspace separately, add another Trello connection. Each connection is its own sign-in.",
    reauthorize:
      "This connection's previous sign-in is removed before requesting a new grant. Your other Trello connections stay. If you do not finish signing in, the connection stays signed out.",
    refused:
      "Trello sign-in was refused. The return URL reported access_denied. This alone does not tell whether you declined or a policy refused it.",
  },
);

```
