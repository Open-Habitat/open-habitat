import type { ReactNode } from "react";
import { catalog } from "../i18n";

// GitLab in Settings › Koodipalvelut: the connection card and its dialogs
// (components/GitLabConnection.tsx) and the refusals of
// app/gitlabSettings.tsx.
const fi = {
  api: {
    ok: "Tunnus toimii",
    token_rejected: "GitLab hylkäsi tunnuksen",
    token_expired: "Tunnus on vanhentunut",
    insufficient_scope: "Tunnukselta puuttuu read_api",
    account_mismatch: "Tunnus kuuluu toiselle tilille",
    unreachable: "Palvelin ei vastaa",
    tls_untrusted: "Palvelimen varmennetta ei voitu tarkistaa",
    redirect_refused: "Palvelin ohjasi toiseen osoitteeseen",
    forbidden_destination: "Osoitteeseen ei voi yhdistää",
    not_gitlab: "Osoitteesta ei vastannut GitLab",
  },
  push: {
    yes: "Kloonaus, pull ja push käyttävät tätä tunnusta. Myös agenttisi voivat käyttää sitä.",
    no: "Kloonaus ja pull käyttävät tätä tunnusta. Push ei onnistu: tunnukselta puuttuu write_repository.",
    unknown:
      "Kloonaus ja pull käyttävät tätä tunnusta. GitLab ei kerro, saako tällä tunnuksella pushata; se selviää ensimmäisellä pushilla.",
  },
  pushDone: {
    yes: "Toimii",
    no: "Ei toimi: tunnukselta puuttuu write_repository",
    unknown: "Ei tiedossa: selviää ensimmäisellä pushilla",
  },
  glabLogin: "glab-kirjautuminen",
  check: "Tarkista",
  replace: "Vaihda tunnus…",
  disconnectOpen: "Irrota…",
  ambiguous:
    "glab-asetuksissa on tälle palvelimelle kaksi merkintää. Kumpaakaan ei käytetä ennen kuin poistat toisen.",
  keyring:
    "glab säilyttää tämän palvelimen tunnuksen käyttöjärjestelmän avainnipussa, jota Habitat ei lue. Se toimii edelleen glabilla.",
  oauth:
    "Tämä glab-kirjautuminen on tehty selaimella (OAuth), joten Habitat ei käytä sitä. Se toimii edelleen glabilla.",
  insecure:
    "glab on asetettu ohittamaan tämän palvelimen varmenteen tarkistus tai käyttämään välityspalvelinta, joten Habitat ei käytä tätä kirjautumista.",
  unsupported:
    "Habitat ei osaa käyttää tätä glab-kirjautumista. Se toimii edelleen glabilla.",
  repos: "Git-repot",
  lapsed:
    "GitLab ei enää hyväksy tunnusta, joten pull ja push eivät onnistu ennen kuin vaihdat sen. Paikallinen työ jatkuu.",
  gitForeign:
    "Git-asetuksissasi on tälle palvelimelle toinen tunnusapuri, joten Habitat ei käytä tunnusta Gitissä.",
  gitNotYet:
    "Git ei vielä käytä tätä tunnusta. Kloonaus ei onnistu ennen kuin Git-asetus on kunnossa.",
  repair: "Korjaa Git-asetus",
  broken: "Ei toimi",
  pushWorks: "Push toimii",
  readOnly: "Vain luku",
  pushUnknown: "Push ei tiedossa",
  accessToken: "Pääsytunnus",
  reading: "Luetaan GitLabista…",
  rejected: "GitLab ei enää hyväksy tunnusta.",
  noDetails: "Tunnuksen tietoja ei saatu juuri nyt.",
  noScopes: "GitLab ei kerro tämän tunnuksen oikeuksia eikä voimassaoloa.",
  fine: "Hienojakoinen tunnus",
  noRights: "ei oikeuksia",
  expiredOn: (date: string) => `vanheni ${date}`,
  validUntil: (date: string) => `voimassa ${date} asti`,
  noExpiry: "ei vanhenemispäivää",
  renewBefore: (date: string) =>
    `Luo GitLabissa uusi tunnus ja vaihda se tähän ennen ${date}, niin kloonit eivät lakkaa toimimasta.`,
  apiNote:
    "Tunnuksella on api-oikeus: agenttisi voivat glabilla myös muuttaa GitLabissa merge requesteja, issueita ja asetuksia sinun nimissäsi.",
  expired: "Vanhentunut",
  expiresIn: (days: number) => `Vanhenee ${days} pv:n päästä`,
  valid: "Voimassa",
  addressHint:
    "Anna GitLabin HTTPS-osoite, esimerkiksi https://gitlab.com tai https://gitlab.yritys.fi.",
  taken: (server: string, user: string) =>
    `Palvelimella ${server} on jo yhdistetty tili ${user}. glab pitää yhden tilin palvelinta kohden: vaihda sen tunnus tai irrota se ensin.`,
  tokenMissing: "Anna pääsytunnus.",
  replaced: "Tunnus vaihdettu",
  connected: "Tili yhdistetty",
  replaceTitle: "Vaihda GitLabin pääsytunnus",
  connectTitle: "Yhdistä GitLab",
  uncertain:
    "Yhteys palvelimeen katkesi, eikä tiedetä, tallentuiko muutos. Sivu lukee tilanteen uudelleen; tarkista se ennen kuin yrität uudelleen.",
  close: "Sulje",
  token: "Tunnus",
  validUntilCap: (date: string) => `Voimassa ${date} asti`,
  noExpiryCap: "Ei vanhenemispäivää",
  noValidity: "GitLab ei kertonut voimassaoloa",
  cannotPush:
    "Voit kloonata ja hakea muutoksia, mutta agentit eivät voi pushata. Jos haluat pushata, luo tunnus oikeuksilla read_api ja write_repository ja vaihda se.",
  apiDone:
    "Tunnuksella on api-oikeus. Se toimii, mutta antaa agenteillesi oikeuden muuttaa GitLabissa kaikkea, mitä sinä voit. Suppeampi tunnus riittää kloonaukseen ja pushiin.",
  projectsListed:
    "GitLabin projektit näkyvät nyt Uusi työtila -sivun listassa.",
  savedNotGit:
    "Tunnus tallentui, mutta Git ei vielä käytä sitä, joten projekteja ei voi kloonata ennen kuin Git-asetus on kunnossa.",
  newWorkspace: "Uusi työtila…",
  done: "Valmis",
  createToken: "Luo tunnus GitLabissa",
  addressFirst: "Anna ensin osoite, niin linkki avaa sen GitLabin tunnussivun.",
  replaceFor: (user: ReactNode, server: ReactNode): ReactNode => (
    <>
      Anna tilin {user} uusi tunnus palvelimelle {server}. Vanha jää voimaan,
      jos GitLab ei hyväksy uutta.
    </>
  ),
  address: "GitLab-palvelimen osoite",
  personalToken: "Henkilökohtainen pääsytunnus",
  hideToken: "Piilota tunnus",
  showToken: "Näytä tunnus",
  hide: "Piilota",
  show: "Näytä",
  whereToken: (open: boolean) => `Mistä saan tunnuksen? ${open ? "−" : "+"}`,
  inGitLab: "GitLabissa: Edit profile → Access tokens",
  prefilled: (code: (text: string) => ReactNode): ReactNode => (
    <>
      Linkki avaa sivun valmiiksi täytettynä: nimi Open Habitat ja oikeudet{" "}
      {code("read_api")} ja {code("write_repository")}. Valitse vanhenemispäivä
      (GitLab sallii yleensä enintään vuoden) ja luo tunnus.
    </>
  ),
  scopesExplained: (code: (text: string) => ReactNode): ReactNode => (
    <>
      {code("read_api")} näyttää projektisi, {code("write_repository")} sallii
      kloonauksen ja pushin. Myös {code("api")} kelpaa, mutta sillä agentit
      voivat muuttaa GitLabissa kaikkea, mitä sinä voit.
    </>
  ),
  groupTokens:
    "Ryhmän tai projektin tunnus ja hienojakoinen tunnus käyvät samaan kenttään.",
  agentNote: "Myös agenttisi voivat käyttää yhdistämääsi GitLab-tiliä.",
  connect: "Yhdistä",
  cancel: "Peruuta",
  checking: "Tarkistetaan…",
  replaceToken: "Vaihda tunnus",
  connectAccount: "Yhdistä tili",
  disconnectTitle: "Irrota GitLab-tili",
  disconnectEffect:
    "Tunnus poistetaan glab-asetuksistasi tällä palvelimella. Kloonatut työtilat jäävät, mutta niiden pull ja push eivät enää käytä tätä tunnusta. Tunnus ei peruunnu GitLabissa: peru se GitLabin Access tokens -sivulla, jos et enää tarvitse sitä. Agentti, joka jo ehti saada tunnuksen, voi käyttää sitä, kunnes perut sen.",
  disconnect: "Irrota",
  e_forbidden:
    "Tähän osoitteeseen ei voi yhdistää. Anna GitLab-palvelimen oma osoite.",
  e_unreachable:
    "Palvelin ei vastaa. Tarkista osoite. Jos GitLab on yrityksen sisäverkossa, tämän palvelimen ylläpitäjän pitää sallia yhteys sinne.",
  e_tls:
    "Palvelimen varmennetta ei voitu tarkistaa, eikä Habitat ohita tarkistusta. Jos GitLab käyttää yrityksen omaa varmentajaa, tämän palvelimen ylläpitäjä voi lisätä sen luotettaviin.",
  e_redirect:
    "Palvelin ohjasi toiseen osoitteeseen. Anna GitLabin lopullinen osoite.",
  e_notGitlab:
    "Osoitteesta ei vastannut GitLab. Anna sama osoite, jolla avaat GitLabin selaimessa, esimerkiksi https://gitlab.yritys.fi.",
  e_token: "Tunnus ei kelpaa. Liitä GitLabissa luotu tunnus sellaisenaan.",
  e_rejected:
    "GitLab hylkäsi tunnuksen. Se voi olla peruttu tai kopioitu vajaana.",
  e_expired:
    "Tunnus on vanhentunut. Luo GitLabissa uusi tunnus ja liitä se tähän.",
  e_scope:
    "Tunnukselta puuttuu read_api-oikeus, joten Habitat ei näe projektejasi. Luo tunnus oikeuksilla read_api ja write_repository.",
  e_account: "Tunnus kuuluu toiselle GitLab-tilille kuin tämä yhteys.",
  e_exists:
    "Tällä palvelimella on jo yhdistetty tili, tai sama tunnus on jo käytössä. glab pitää yhden tilin palvelinta kohden: vaihda sen tunnus tai irrota se ensin.",
  e_insecure:
    "glab-asetuksissasi on tälle palvelimelle asetuksia, joita Habitat ei käytä (esimerkiksi varmenteen tarkistuksen ohitus tai välityspalvelin). Poista ne glabin asetuksista ja yritä uudelleen.",
  e_ambiguous:
    "glab-asetuksissa on tälle palvelimelle kaksi merkintää. Poista toinen ja yritä uudelleen.",
  e_busyGlab:
    "glab muuttaa asetuksiaan juuri nyt. Yritä hetken päästä uudelleen.",
  e_write: "glab-asetuksia ei voitu tallentaa. Mitään ei muutettu.",
  e_changed: "Yhteys on muuttunut. Sivu päivitetään.",
  e_unavailable: "GitLab ei ole käytettävissä tällä palvelimella.",
  e_refused: "Pyyntöä ei hyväksytty. Mitään ei muutettu.",
  e_cloning:
    "Tämän yhteyden kloonaus on käynnissä. Keskeytä se tai odota sen valmistumista ja yritä sitten uudelleen.",
  e_foreign:
    "Git-asetuksissasi on tälle palvelimelle jo toinen tunnusapuri. Habitat ei kirjoita sen päälle.",
  e_busy: "Toinen muutos on kesken. Yritä hetken päästä uudelleen.",
  e_glabOnly: "Tätä glab-kirjautumista ei voi muuttaa täältä.",
  e_noReply:
    "Vastausta ei saatu. Sivu päivitetään; tarkista tila ennen kuin yrität uudelleen.",
  e_noDisconnectReply:
    "Irrotuksen tulosta ei saatu. Sivu päivitetään; tarkista tila ennen kuin yrität uudelleen.",
  disconnected: (host: string) =>
    `GitLab ${host} irrotettu. Kloonatut työtilat jäivät; peru tunnus tarvittaessa myös GitLabissa.`,
};

export const gitlabText = catalog(fi, {
  api: {
    ok: "The token works",
    token_rejected: "GitLab rejected the token",
    token_expired: "The token has expired",
    insufficient_scope: "The token lacks read_api",
    account_mismatch: "The token belongs to another account",
    unreachable: "The server does not answer",
    tls_untrusted: "The server's certificate could not be verified",
    redirect_refused: "The server redirected to another address",
    forbidden_destination: "The address cannot be connected to",
    not_gitlab: "No GitLab answered at the address",
  },
  push: {
    yes: "Cloning, pull and push use this token. Your agents can use it too.",
    no: "Cloning and pull use this token. Push does not work: the token lacks write_repository.",
    unknown:
      "Cloning and pull use this token. GitLab does not tell whether this token may push; the first push settles it.",
  },
  pushDone: {
    yes: "Works",
    no: "Does not work: the token lacks write_repository",
    unknown: "Unknown: the first push settles it",
  },
  glabLogin: "glab login",
  check: "Check",
  replace: "Change token…",
  disconnectOpen: "Disconnect…",
  ambiguous:
    "glab's settings have two entries for this server. Neither is used until you remove one.",
  keyring:
    "glab keeps this server's token in the operating system's keyring, which Habitat does not read. It still works with glab.",
  oauth:
    "This glab login was made with a browser (OAuth), so Habitat does not use it. It still works with glab.",
  insecure:
    "glab is set to skip this server's certificate check or to use a proxy, so Habitat does not use this login.",
  unsupported: "Habitat cannot use this glab login. It still works with glab.",
  repos: "Git repositories",
  lapsed:
    "GitLab no longer accepts the token, so pull and push do not work until you change it. Local work continues.",
  gitForeign:
    "Your Git settings have another credential helper for this server, so Habitat does not use the token in Git.",
  gitNotYet:
    "Git does not use this token yet. Cloning does not work until the Git setting is in order.",
  repair: "Fix the Git setting",
  broken: "Does not work",
  pushWorks: "Push works",
  readOnly: "Read only",
  pushUnknown: "Push unknown",
  accessToken: "Access token",
  reading: "Reading from GitLab…",
  rejected: "GitLab no longer accepts the token.",
  noDetails: "The token's details did not arrive just now.",
  noScopes: "GitLab does not tell this token's permissions or validity.",
  fine: "Fine-grained token",
  noRights: "no permissions",
  expiredOn: (date) => `expired ${date}`,
  validUntil: (date) => `valid until ${date}`,
  noExpiry: "no expiry date",
  renewBefore: (date) =>
    `Create a new token in GitLab and change it here before ${date}, so the clones do not stop working.`,
  apiNote:
    "The token has the api scope: with glab your agents can also change merge requests, issues and settings in GitLab in your name.",
  expired: "Expired",
  expiresIn: (days) => `Expires in ${days} d`,
  valid: "Valid",
  addressHint:
    "Give GitLab's HTTPS address, for example https://gitlab.com or https://gitlab.example.com.",
  taken: (server, user) =>
    `The server ${server} already has the connected account ${user}. glab keeps one account per server: change its token or disconnect it first.`,
  tokenMissing: "Give an access token.",
  replaced: "Token changed",
  connected: "Account connected",
  replaceTitle: "Change the GitLab access token",
  connectTitle: "Connect GitLab",
  uncertain:
    "The connection to the server broke, and it is not known whether the change was saved. The page reads the situation again; check it before you try again.",
  close: "Close",
  token: "Token",
  validUntilCap: (date) => `Valid until ${date}`,
  noExpiryCap: "No expiry date",
  noValidity: "GitLab did not tell the validity",
  cannotPush:
    "You can clone and fetch changes, but agents cannot push. If you want to push, create a token with read_api and write_repository and change it.",
  apiDone:
    "The token has the api scope. It works, but it lets your agents change everything in GitLab that you can. A narrower token is enough for cloning and push.",
  projectsListed:
    "GitLab's projects now show in the New workspace page's list.",
  savedNotGit:
    "The token was saved, but Git does not use it yet, so projects cannot be cloned until the Git setting is in order.",
  newWorkspace: "New workspace…",
  done: "Done",
  createToken: "Create a token in GitLab",
  addressFirst:
    "Give the address first, and the link opens that GitLab's token page.",
  replaceFor: (user, server) => (
    <>
      Give a new token of the account {user} for the server {server}. The old
      one stays valid if GitLab does not accept the new one.
    </>
  ),
  address: "GitLab server address",
  personalToken: "Personal access token",
  hideToken: "Hide token",
  showToken: "Show token",
  hide: "Hide",
  show: "Show",
  whereToken: (open) => `Where do I get a token? ${open ? "−" : "+"}`,
  inGitLab: "In GitLab: Edit profile → Access tokens",
  prefilled: (code) => (
    <>
      The link opens the page already filled in: the name Open Habitat and the
      scopes {code("read_api")} and {code("write_repository")}. Choose an expiry
      date (GitLab usually allows at most a year) and create the token.
    </>
  ),
  scopesExplained: (code) => (
    <>
      {code("read_api")} shows your projects, {code("write_repository")} allows
      cloning and push. {code("api")} works too, but with it agents can change
      everything in GitLab that you can.
    </>
  ),
  groupTokens:
    "A group or project token and a fine-grained token go in the same field.",
  agentNote: "Your agents can also use the GitLab account you connect.",
  connect: "Connect",
  cancel: "Cancel",
  checking: "Checking…",
  replaceToken: "Change token",
  connectAccount: "Connect account",
  disconnectTitle: "Disconnect the GitLab account",
  disconnectEffect:
    "The token is removed from your glab settings on this server. Cloned workspaces stay, but their pull and push no longer use this token. The token is not revoked in GitLab: revoke it on GitLab's Access tokens page if you no longer need it. An agent that already got the token can use it until you revoke it.",
  disconnect: "Disconnect",
  e_forbidden:
    "This address cannot be connected to. Give the GitLab server's own address.",
  e_unreachable:
    "The server does not answer. Check the address. If GitLab is in a company's internal network, this server's administrator has to allow the connection there.",
  e_tls:
    "The server's certificate could not be verified, and Habitat does not skip the check. If GitLab uses a company's own certificate authority, this server's administrator can add it to the trusted ones.",
  e_redirect:
    "The server redirected to another address. Give GitLab's final address.",
  e_notGitlab:
    "No GitLab answered at the address. Give the same address you open GitLab with in a browser, for example https://gitlab.example.com.",
  e_token: "The token is not valid. Paste the token made in GitLab as it is.",
  e_rejected:
    "GitLab rejected the token. It may have been revoked or copied incompletely.",
  e_expired:
    "The token has expired. Create a new token in GitLab and paste it here.",
  e_scope:
    "The token lacks the read_api scope, so Habitat cannot see your projects. Create a token with read_api and write_repository.",
  e_account:
    "The token belongs to another GitLab account than this connection.",
  e_exists:
    "This server already has a connected account, or the same token is already in use. glab keeps one account per server: change its token or disconnect it first.",
  e_insecure:
    "Your glab settings have settings for this server that Habitat does not use (for example skipping the certificate check, or a proxy). Remove them from glab's settings and try again.",
  e_ambiguous:
    "glab's settings have two entries for this server. Remove one and try again.",
  e_busyGlab: "glab is changing its settings just now. Try again in a moment.",
  e_write: "glab's settings could not be saved. Nothing was changed.",
  e_changed: "The connection has changed. The page is refreshed.",
  e_unavailable: "GitLab is not available on this server.",
  e_refused: "The request was not accepted. Nothing was changed.",
  e_cloning:
    "A clone of this connection is running. Stop it or wait for it to finish, then try again.",
  e_foreign:
    "Your Git settings already have another credential helper for this server. Habitat does not write over it.",
  e_busy: "Another change is under way. Try again in a moment.",
  e_glabOnly: "This glab login cannot be changed from here.",
  e_noReply:
    "No reply arrived. The page is refreshed; check the state before you try again.",
  e_noDisconnectReply:
    "The result of disconnecting did not arrive. The page is refreshed; check the state before you try again.",
  disconnected: (host) =>
    `GitLab ${host} disconnected. Cloned workspaces stay; revoke the token in GitLab too if needed.`,
});
