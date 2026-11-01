# text/workspaceGit.ts

Generated from web/src/text/workspaceGit.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// Reading and fetching a workspace's Git state (app/workspaceGit.ts).
const fi = {
  unreadable: "Git-tilaa ei voitu lukea.",
  tooLarge: "Git-vastaus ylitti lukurajan.",
  unconfirmed: "Git-tilaa ei voitu vahvistaa.",
  fetch: {
    remote_ssh_unavailable:
      "Haku epäonnistui: etärepo käyttää SSH:ta, eikä palvelimella ole SSH-agenttia tai avainta, jolla yhteys aukeaisi. Hae päätteessä tai vaihda etärepo HTTPS-osoitteeseen.",
    remote_auth_unavailable:
      "Haku epäonnistui: etärepo vaati kirjautumisen, eikä Git löytänyt tunnuksia palvelimelta.",
    remote_unreachable: "Haku epäonnistui: etärepoon ei saatu yhteyttä.",
    remote_rewritten:
      "Hakua ei tehty: Git-asetuksesi (url.insteadOf tai pushInsteadOf) ohjaisivat Gitea-etärepon osoitteen muualle, tai etärepolla on useampi osoite. Tarkista asetukset päätteessä.",
    remote_not_found:
      "Haku epäonnistui: etärepoa ei löytynyt tai siihen ei ole pääsyä.",
    fetch_timeout:
      "Haku keskeytettiin, koska se kesti yli 45 sekuntia. Hae päätteessä.",
    no_remote: "Työtilalla ei ole etärepoa, josta hakea.",
    fetch_in_progress: "Haku on jo käynnissä.",
    workspace_changed: "Työtila muuttui. Lue tila uudelleen.",
    fetch_failed:
      "Haku epäonnistui. Git ei kertonut syytä, jonka voisi näyttää.",
  } as Record<string, string>,
  refused: "Palvelin ei hyväksynyt hakua.",
  login: "Istunto päättyi. Kirjaudu uudelleen.",
  uncertain: "Haun tulos jäi epävarmaksi. Lue tila uudelleen.",
};

export const workspaceGitText = catalog(fi, {
  unreadable: "The Git state could not be read.",
  tooLarge: "The Git reply exceeded the read limit.",
  unconfirmed: "The Git state could not be confirmed.",
  fetch: {
    remote_ssh_unavailable:
      "The fetch failed: the remote uses SSH, and the server has no SSH agent or key to open the connection. Fetch in a terminal or switch the remote to an HTTPS address.",
    remote_auth_unavailable:
      "The fetch failed: the remote required signing in, and Git found no credentials on the server.",
    remote_unreachable: "The fetch failed: the remote could not be reached.",
    remote_rewritten:
      "No fetch was made: your Git settings (url.insteadOf or pushInsteadOf) would redirect the Gitea remote's address elsewhere, or the remote has more than one address. Check the settings in a terminal.",
    remote_not_found:
      "The fetch failed: the remote was not found or you have no access to it.",
    fetch_timeout:
      "The fetch was stopped because it took over 45 seconds. Fetch in a terminal.",
    no_remote: "The workspace has no remote to fetch from.",
    fetch_in_progress: "A fetch is already running.",
    workspace_changed: "The workspace changed. Read the state again.",
    fetch_failed: "The fetch failed. Git gave no reason that could be shown.",
  },
  refused: "The server did not accept the fetch.",
  login: "The session ended. Sign in again.",
  uncertain: "The result of the fetch is uncertain. Read the state again.",
});

```
