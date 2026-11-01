# text/integrationsSettings.ts

Generated from web/src/text/integrationsSettings.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The integrations' refusals and outcomes (app/IntegrationsSettings.tsx).
const fi = {
  refusals: {
    credentials_rejected:
      "Palvelin ei hyväksynyt tunnusta tai salasanaa. Mitään ei tallennettu.",
    server_unreachable:
      "Palvelimeen ei saatu yhteyttä. Tarkista palvelimen nimi, portti ja suojaus. Mitään ei tallennettu.",
    endpoint_rejected:
      "DAV-osoitteesta ei löytynyt kalentereita tai yhteystietoja, tai palvelin ohjasi toiseen verkkotunnukseen. Tarkista osoite. Mitään ei tallennettu.",
    account_exists: "Tämä tili on jo yhdistetty.",
    account_missing: "Tiliä ei enää ole. Sivu päivitetään.",
    provider_unavailable:
      "Tämä integraatio ei ole käytettävissä tällä palvelimella.",
    level_unavailable:
      "Tämä taso ei ole käytettävissä tällä palvelimella. Valitse toinen taso tai pyydä ylläpitäjää ottamaan se käyttöön.",
    redirect_invalid:
      "Tämä ei ole se osoite, johon kirjautuminen päättyi. Liitä osoiteriviltä koko osoite.",
    quota_insufficient:
      "Valitut kansiot eivät enää mahdu kotihakemistoosi. Jätä jokin pois.",
    attempt_active:
      "Kirjautuminen tai ensimmäinen synkronointi on kesken. Odota, että se päättyy.",
    attempt_not_found: "Kirjautuminen ei ole enää voimassa. Aloita alusta.",
  } as Record<string, string>,
  gitea: {
    invalid_address:
      "Anna palvelimen HTTPS-osoite, esimerkiksi https://git.example.org.",
    forbidden_destination:
      "Tähän osoitteeseen ei voi yhdistää. Anna Gitea-palvelimen oma osoite.",
    unreachable:
      "Palvelin ei vastaa. Tarkista osoite ja Habitatin verkkoyhteys palvelimeen.",
    tls_untrusted:
      "Palvelimen varmennetta ei voitu tarkistaa. Ylläpitäjän pitää lisätä sen varmentaja luotettuihin.",
    redirect_refused:
      "Palvelin ohjasi toiseen osoitteeseen. Anna Gitean lopullinen osoite.",
    not_gitea:
      "Osoitteesta ei vastannut Gitea. Tarkista osoite ja sen mahdollinen polku.",
    invalid_token:
      "Tunnuksessa on merkkejä, joita pääsytunnuksessa ei ole. Kopioi se uudelleen.",
    token_rejected:
      "Tunnus hylättiin. Tarkista tunnus ja sen lukuoikeudet Giteassa.",
    insufficient_scope:
      "Tunnukselta puuttuu lukuoikeus käyttäjätietoihin tai repoihin. Anna sille read:user ja write:repository.",
    account_mismatch: "Tunnus kuuluu toiselle Gitea-tilille kuin tämä yhteys.",
    connection_exists: "Tämä Gitea-tili tai tunnus on jo yhdistetty.",
    native_conflict:
      "tea-asetuksissa on jo samanniminen tai kahdentunut kirjautuminen. Selvitä se tealla.",
    connection_changed: "Yhteys on muuttunut. Sivu päivitetään.",
    native_busy: "Toinen muutos on kesken. Yritä hetken päästä uudelleen.",
    write_failed: "Asetusta ei voitu tallentaa. Mitään ei muutettu.",
    provider_unavailable: "Gitea ei ole käytettävissä tällä palvelimella.",
  } as Record<string, string>,
  giteaAction: {
    clone_running:
      "Tämän yhteyden kloonaus on käynnissä. Keskeytä se tai odota sen valmistumista ja yritä sitten uudelleen.",
    helper_conflict:
      "Git-asetuksissasi on tälle palvelimelle jo toinen tunnusapuri. Habitat ei kirjoita sen päälle.",
    connection_changed: "Yhteys on muuttunut. Sivu päivitetään.",
    native_busy: "Toinen muutos on kesken. Yritä hetken päästä uudelleen.",
    unsupported_entry: "Tätä tea-kirjautumista ei voi muuttaa täältä.",
  } as Record<string, string>,
  apple: {
    credentials_rejected:
      "Apple ei hyväksynyt Apple ID:tä ja salasanaa. Tarkista, että annoit sovellussalasanan etkä Apple-tilin omaa salasanaa. Mitään ei tallennettu.",
    server_unreachable:
      "Appleen ei saatu yhteyttä. Yritä hetken päästä uudelleen. Mitään ei tallennettu.",
    endpoint_rejected:
      "iCloud ei kertonut kalenterin tai yhteystietojen osoitetta. Mitään ei tallennettu.",
    account_exists: "Valittu palvelu on jo yhdistetty.",
  } as Record<string, string>,
  reuse: {
    credentials_rejected:
      "Tallennettu sovellussalasana ei enää kelpaa. Luo uusi ja anna se tähän. Mitään ei tallennettu.",
    account_missing:
      "Tallennettua sovellussalasanaa ei löytynyt. Anna se tähän.",
  } as Record<string, string>,
  refused: "Pyyntöä ei hyväksytty. Mitään ei muutettu.",
  appleRemoved: "Apple-tili poistettu.",
  removeUncertain:
    "Poiston tulosta ei saatu. Sivu päivitetään; tarkista tila ennen kuin yrität uudelleen.",
  cancelUncertain:
    "Kirjautumisen peruminen ei varmistunut. Se voi vielä valmistua; tarkista tilanne tältä sivulta.",
  stopElsewhere:
    "Keskeytä synkronointi siinä selainistunnossa, jossa aloitit sen. Palvelimen itse jatkaman ensimmäisen synkronoinnin voi pysäyttää vain poistamalla tilin.",
  stopping:
    "Synkronointi keskeytetään. Jo kopioidut tiedostot ja kirjautuminen säilyvät.",
  stopUncertain:
    "Keskeyttämisen tulos ei varmistunut. Tarkista tila ennen uutta yritystä.",
  removedKept: (dirs: string[]) =>
    `Poistettu. ${dirs.join(" ja ")} jäi kotihakemistoosi.`,
  removedTrashed: (dirs: string[]) =>
    `Poistettu. ${dirs.join(" ja ")} siirrettiin roskakoriin.`,
  removed: "Poistettu.",
  noReply:
    "Vastausta ei saatu. Sivu päivitetään; tarkista tila ennen kuin yrität uudelleen.",
  giteaDisconnected:
    "Gitea-tili irrotettu. Kloonatut työtilat jäivät; poista tunnus tarvittaessa myös Giteasta.",
  disconnectUncertain:
    "Irrotuksen tulosta ei saatu. Sivu päivitetään; tarkista tila ennen kuin yrität uudelleen.",
  listFailed: "Integraatioita ei voitu hakea. Yritä hetken päästä uudelleen.",
  reading: "Luetaan integraatioita työkaluilta…",
  stale: "Tilaa ei voitu tarkistaa. Näytetään edellinen tieto.",
};

export const integrationsSettingsText = catalog(
  fi,
  {
    refusals: {
      credentials_rejected:
        "The server did not accept the username or password. Nothing was saved.",
      server_unreachable:
        "The server could not be reached. Check the server's name, port and security. Nothing was saved.",
      endpoint_rejected:
        "No calendars or contacts were found at the DAV address, or the server redirected to another domain. Check the address. Nothing was saved.",
      account_exists: "This account is already connected.",
      account_missing: "The account no longer exists. The page is refreshed.",
      provider_unavailable: "This integration is not available on this server.",
      level_unavailable:
        "This level is not available on this server. Choose another level or ask the administrator to enable it.",
      redirect_invalid:
        "This is not the address the sign-in ended at. Paste the whole address from the address bar.",
      quota_insufficient:
        "The chosen folders no longer fit in your home directory. Leave one out.",
      attempt_active:
        "A sign-in or the first synchronization is under way. Wait for it to end.",
      attempt_not_found: "The sign-in is no longer valid. Start over.",
    },
    gitea: {
      invalid_address:
        "Give the server's HTTPS address, for example https://git.example.org.",
      forbidden_destination:
        "This address cannot be connected to. Give the Gitea server's own address.",
      unreachable:
        "The server does not answer. Check the address and Habitat's network connection to the server.",
      tls_untrusted:
        "The server's certificate could not be verified. The administrator has to add its certificate authority to the trusted ones.",
      redirect_refused:
        "The server redirected to another address. Give Gitea's final address.",
      not_gitea:
        "No Gitea answered at the address. Check the address and its possible path.",
      invalid_token:
        "The token has characters an access token does not have. Copy it again.",
      token_rejected:
        "The token was rejected. Check the token and its read permissions in Gitea.",
      insufficient_scope:
        "The token lacks read access to user data or repositories. Give it read:user and write:repository.",
      account_mismatch:
        "The token belongs to another Gitea account than this connection.",
      connection_exists: "This Gitea account or token is already connected.",
      native_conflict:
        "tea's settings already have a login with the same name or a duplicate. Sort it out with tea.",
      connection_changed: "The connection has changed. The page is refreshed.",
      native_busy: "Another change is under way. Try again in a moment.",
      write_failed: "The setting could not be saved. Nothing was changed.",
      provider_unavailable: "Gitea is not available on this server.",
    },
    giteaAction: {
      clone_running:
        "A clone of this connection is running. Stop it or wait for it to finish, then try again.",
      helper_conflict:
        "Your Git settings already have another credential helper for this server. Habitat does not write over it.",
      connection_changed: "The connection has changed. The page is refreshed.",
      native_busy: "Another change is under way. Try again in a moment.",
      unsupported_entry: "This tea login cannot be changed from here.",
    },
    apple: {
      credentials_rejected:
        "Apple did not accept the Apple ID and password. Check that you gave an app-specific password and not the Apple account's own password. Nothing was saved.",
      server_unreachable:
        "Apple could not be reached. Try again in a moment. Nothing was saved.",
      endpoint_rejected:
        "iCloud did not tell the calendar's or contacts' address. Nothing was saved.",
      account_exists: "The chosen service is already connected.",
    },
    reuse: {
      credentials_rejected:
        "The saved app-specific password is no longer valid. Create a new one and give it here. Nothing was saved.",
      account_missing:
        "The saved app-specific password was not found. Give it here.",
    },
    refused: "The request was not accepted. Nothing was changed.",
    appleRemoved: "Apple account removed.",
    removeUncertain:
      "The result of removing did not arrive. The page is refreshed; check the state before you try again.",
    cancelUncertain:
      "Canceling the sign-in was not confirmed. It may still finish; check the situation on this page.",
    stopElsewhere:
      "Stop the synchronization in the browser session where you started it. A first synchronization the server continues by itself can be stopped only by removing the account.",
    stopping:
      "The synchronization is being stopped. Files already copied and the sign-in stay.",
    stopUncertain:
      "The result of stopping was not confirmed. Check the state before trying again.",
    removedKept: (dirs) =>
      `Removed. ${dirs.join(" and ")} stayed in your home directory.`,
    removedTrashed: (dirs) =>
      `Removed. ${dirs.join(" and ")} moved to the Trash.`,
    removed: "Removed.",
    noReply:
      "No reply arrived. The page is refreshed; check the state before you try again.",
    giteaDisconnected:
      "Gitea account disconnected. The cloned workspaces stayed; remove the token from Gitea too if needed.",
    disconnectUncertain:
      "The result of disconnecting did not arrive. The page is refreshed; check the state before you try again.",
    listFailed: "The integrations could not be fetched. Try again in a moment.",
    reading: "Reading the integrations from the tools…",
    stale: "The state could not be checked. The previous information is shown.",
  },
  {
    cancelUncertain:
      "Cancelling the sign-in was not confirmed. It may still finish; check the situation on this page.",
  },
);

```
