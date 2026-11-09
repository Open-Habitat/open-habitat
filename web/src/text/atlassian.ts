import { catalog } from "../i18n";

export const atlassianText = catalog(
  {
    waiting: "Jos kirjautuminen odottaa ylläpitäjän hyväksyntää",
    help: "Kopioi pyyntö ja toimita se ylläpitäjällesi. Habitat ei lähetä mitään. Odottaminen ei yksin kerro, että pyyntö olisi hyväksyttävänä.",
    request:
      "Haluan käyttää Jiraa ja Confluencea Open Habitatin agenttien kautta omalla Atlassian-tililläni. Tarkistattehan organisaation Connectors → Atlassian MCP server -asetukset, Read/Search- ja tarvittaessa Write-oikeudet, Rovo-käyttöoikeuden sekä omat projekti- ja sivuoikeuteni. Kirjautuminen käyttää natiivia loopback-paluuosoitetta http://127.0.0.1:<vaihtuva portti>/callback. Tarkistakaa ensin, sallivatko tuetut osoitteet sen jo; tarvittaessa Atlassianin dokumentoima sääntö on http://127.0.0.1:*/**. Sääntö sallii myös muut natiivit loopback-asiakkaat, ei vain Habitatia. Mahdollisen IP-sallintalistan tulee sallia Habitat-palvelimen ulospäin näkyvä IP-osoite. Tarkistetaan pyydetyt ja lopulta myönnetyt oikeudet yhdessä ennen käyttöä.",
    copy: "Kopioi pyyntö",
    reauthorize:
      "Vanha kirjautuminen poistetaan ennen uuden luvan pyytämistä. Jos et viimeistele kirjautumista, yhteys jää kirjautumatta.",
    refused:
      "Atlassian-kirjautuminen evättiin. Paluuosoite ilmoitti access_denied. Se ei yksin kerro, oliko syy oma peruutuksesi vai organisaation sääntö.",
  },
  {
    waiting: "If sign-in is waiting for administrator approval",
    help: "Copy the request and give it to your administrator. Habitat sends nothing. Waiting alone does not prove that a request is pending approval.",
    request:
      "I want to use Jira and Confluence through Open Habitat agents with my own Atlassian account. Please check the Connectors → Atlassian MCP server settings, Read/Search and, if needed, Write permissions, Rovo entitlement, and my project and page permissions. Sign-in uses the native loopback redirect http://127.0.0.1:<allocated port>/callback. First check whether the supported domains already allow it; if needed, Atlassian's documented rule is http://127.0.0.1:*/**. This permits other native loopback clients too, not only Habitat. Any IP allowlist must permit the Habitat server's outgoing IP address. Let us check both requested and actually granted permissions together before use.",
    copy: "Copy request",
    reauthorize:
      "The previous sign-in is removed before requesting a new grant. If you do not finish signing in, the connection stays signed out.",
    refused:
      "Atlassian sign-in was refused. The return URL reported access_denied. This alone does not tell whether you declined or a policy refused it.",
  },
);
