import type { ReactNode } from "react";
import { catalog } from "../i18n";

// Gitea in Settings › Koodipalvelut: the connection card and its dialogs
// (components/GiteaConnection.tsx).
const fi = {
  api: {
    ok: "Tunnus toimii",
    token_rejected: "Gitea hylkäsi tunnuksen",
    insufficient_scope: "Tunnukselta puuttuu lukuoikeus",
    account_mismatch: "Tunnus kuuluu toiselle tilille",
    unreachable: "Palvelin ei vastaa",
    tls_untrusted: "Palvelimen varmennetta ei voitu tarkistaa",
    redirect_refused: "Palvelin ohjasi toiseen osoitteeseen",
    forbidden_destination: "Osoitteeseen ei voi yhdistää",
    not_gitea: "Osoitteesta ei vastannut Gitea",
  },
  readOnly:
    "Vain luku: tunnukselta puuttuu repojen kirjoitusoikeus (write:repository), joten push ei onnistu. Vaihda tilalle tunnus, jolla se on.",
  teaLogin: "tea-kirjautuminen",
  check: "Tarkista",
  replace: "Vaihda tunnus…",
  disconnectOpen: "Irrota…",
  ambiguous:
    "tea-asetuksissa on tälle tilille kaksi kirjautumista. Kumpaakaan ei käytetä ennen kuin poistat toisen tealla.",
  noToken:
    "Tämä tea-kirjautuminen ei käytä pääsytunnusta, joten Habitat ei käytä sitä. Se toimii edelleen tealla.",
  repos: "Git-repot",
  gitPush:
    "Kloonaus, haku ja push käyttävät tätä tunnusta. Myös agenttisi voivat käyttää sitä.",
  gitFetch:
    "Kloonaus ja haku käyttävät tätä tunnusta. Myös agenttisi voivat käyttää sitä.",
  gitForeign:
    "Git-asetuksissasi on tälle palvelimelle toinen tunnusapuri, joten Habitat ei käytä tunnusta Gitissä.",
  gitNotYet:
    "Git ei vielä käytä tätä tunnusta. Kloonaus ei onnistu ennen kuin Git-asetus on kunnossa.",
  repair: "Korjaa Git-asetus",
  pushUnknown:
    "Pushin toimivuutta ei voitu tarkistaa: tililtä ei löytynyt repoa, johon se saa pushata, tai Gitea ei vastannut.",
  addressHint:
    "Anna palvelimen HTTPS-osoite, esimerkiksi https://git.example.org.",
  tokenMissing: "Anna pääsytunnus.",
  replaced: "Tunnus vaihdettu",
  connected: "Tili yhdistetty",
  replaceTitle: "Vaihda Gitean pääsytunnus",
  connectTitle: "Yhdistä Gitea",
  uncertain:
    "Yhteys palvelimeen katkesi, eikä tiedetä, tallentuiko muutos. Sivu lukee tilanteen uudelleen; tarkista se ennen kuin yrität uudelleen.",
  close: "Sulje",
  readOnlyClone: "Kloonaus ja haku toimivat tälläkin tunnuksella.",
  canChoose: "Voit nyt valita Giteasta repon uudeksi työtilaksi.",
  pushWorks: " Push toimii samalla tunnuksella Gitillä.",
  savedNotGit:
    "Tunnus tallentui, mutta Git ei vielä käytä sitä, joten repoja ei voi kloonata ennen kuin Git-asetus on kunnossa.",
  done: "Valmis",
  replaceFor: (user: ReactNode, server: ReactNode): ReactNode => (
    <>
      Anna tilin {user} uusi tunnus palvelimelle {server}. Vanha jää voimaan,
      jos Gitea ei hyväksy uutta.
    </>
  ),
  address: "Gitea-palvelimen osoite",
  token: "Henkilökohtainen pääsytunnus",
  tokenPlaceholder: "Liitä Giteassa luotu tunnus",
  hideToken: "Piilota tunnus",
  showToken: "Näytä tunnus",
  hide: "Piilota",
  show: "Näytä",
  whereToken: (open: boolean) => `Mistä saan tunnuksen? ${open ? "−" : "+"}`,
  inGitea: "Giteassa: Asetukset → Sovellukset",
  scopes: (code: (text: string) => ReactNode): ReactNode => (
    <>
      Luo uusi pääsytunnus ja anna sille käyttäjätietojen lukuoikeus ja repojen
      kirjoitusoikeus ({code("read:user")}, {code("write:repository")}).
      Kirjoitusoikeudella sinä ja agenttisi voitte pushata Gitillä; suojatut
      haarat ja tilisi oikeudet rajaavat sitä Giteassa kuten ennenkin. Pelkällä
      lukuoikeudella ({code("read:repository")}) kloonaus ja haku toimivat,
      mutta push ei.
    </>
  ),
  copyHere:
    "Kopioi tunnus tähän. Sen tarkat oikeusvalinnat riippuvat Gitean versiosta.",
  agentNote: "Myös agenttisi voivat käyttää yhdistämääsi Gitea-tiliä.",
  connect: "Yhdistä",
  cancel: "Peruuta",
  checking: "Tarkistetaan…",
  replaceToken: "Vaihda tunnus",
  connectAccount: "Yhdistä tili",
  disconnectTitle: "Irrota Gitea-tili",
  disconnectEffect:
    "Tunnus poistetaan tea-asetuksistasi tällä palvelimella. Kloonatut työtilat jäävät, mutta niiden haku ei enää käytä tätä tunnusta. Tunnus ei peruunnu Giteassa: poista se Gitean asetuksista, jos et enää tarvitse sitä. Agentti, joka jo ehti saada tunnuksen, voi käyttää sitä kunnes poistat sen Giteassa.",
  disconnect: "Irrota",
};

export const giteaText = catalog(fi, {
  api: {
    ok: "The token works",
    token_rejected: "Gitea rejected the token",
    insufficient_scope: "The token lacks read access",
    account_mismatch: "The token belongs to another account",
    unreachable: "The server does not answer",
    tls_untrusted: "The server's certificate could not be verified",
    redirect_refused: "The server redirected to another address",
    forbidden_destination: "The address cannot be connected to",
    not_gitea: "No Gitea answered at the address",
  },
  readOnly:
    "Read only: the token lacks write access to repositories (write:repository), so push does not work. Replace it with a token that has it.",
  teaLogin: "tea login",
  check: "Check",
  replace: "Change token…",
  disconnectOpen: "Disconnect…",
  ambiguous:
    "tea's settings have two logins for this account. Neither is used until you remove one with tea.",
  noToken:
    "This tea login does not use an access token, so Habitat does not use it. It still works with tea.",
  repos: "Git repositories",
  gitPush:
    "Cloning, fetching and push use this token. Your agents can use it too.",
  gitFetch: "Cloning and fetching use this token. Your agents can use it too.",
  gitForeign:
    "Your Git settings have another credential helper for this server, so Habitat does not use the token in Git.",
  gitNotYet:
    "Git does not use this token yet. Cloning does not work until the Git setting is in order.",
  repair: "Fix the Git setting",
  pushUnknown:
    "Whether push works could not be checked: the account has no repository it may push to, or Gitea did not answer.",
  addressHint:
    "Give the server's HTTPS address, for example https://git.example.org.",
  tokenMissing: "Give an access token.",
  replaced: "Token changed",
  connected: "Account connected",
  replaceTitle: "Change the Gitea access token",
  connectTitle: "Connect Gitea",
  uncertain:
    "The connection to the server broke, and it is not known whether the change was saved. The page reads the situation again; check it before you try again.",
  close: "Close",
  readOnlyClone: "Cloning and fetching work with this token too.",
  canChoose: "You can now choose a Gitea repository as a new workspace.",
  pushWorks: " Push works with the same token in Git.",
  savedNotGit:
    "The token was saved, but Git does not use it yet, so repositories cannot be cloned until the Git setting is in order.",
  done: "Done",
  replaceFor: (user, server) => (
    <>
      Give a new token of the account {user} for the server {server}. The old
      one stays valid if Gitea does not accept the new one.
    </>
  ),
  address: "Gitea server address",
  token: "Personal access token",
  tokenPlaceholder: "Paste the token made in Gitea",
  hideToken: "Hide token",
  showToken: "Show token",
  hide: "Hide",
  show: "Show",
  whereToken: (open) => `Where do I get a token? ${open ? "−" : "+"}`,
  inGitea: "In Gitea: Settings → Applications",
  scopes: (code) => (
    <>
      Create a new access token and give it read access to user data and write
      access to repositories ({code("read:user")}, {code("write:repository")}).
      With write access you and your agents can push with Git; protected
      branches and your account's rights limit it in Gitea as before. With read
      access alone ({code("read:repository")}) cloning and fetching work, but
      push does not.
    </>
  ),
  copyHere:
    "Copy the token here. Its exact permission choices depend on Gitea's version.",
  agentNote: "Your agents can also use the Gitea account you connect.",
  connect: "Connect",
  cancel: "Cancel",
  checking: "Checking…",
  replaceToken: "Change token",
  connectAccount: "Connect account",
  disconnectTitle: "Disconnect the Gitea account",
  disconnectEffect:
    "The token is removed from your tea settings on this server. Cloned workspaces stay, but fetching them no longer uses this token. The token is not revoked in Gitea: remove it in Gitea's settings if you no longer need it. An agent that already got the token can use it until you remove it in Gitea.",
  disconnect: "Disconnect",
});
