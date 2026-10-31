import { catalog } from "../i18n";

// Signing Pi in to ChatGPT with a device code
// (components/PiDeviceSignIn.tsx).
const fi = {
  outcomes: {
    waiting: {
      label: "Valmistellaan kirjautumista",
      detail: "Valmistellaan vahvistuskoodia. Odota hetki.",
    },
    cancelling: {
      label: "Peruutetaan kirjautumisyritystä",
      detail: "Odota hetki.",
    },
    start: {
      label: "ChatGPT-kirjautuminen tarvitaan",
      detail: "Kirjaudu ChatGPT-tilillesi, niin voit aloittaa työtiloissa.",
    },
    connected: {
      label: "ChatGPT-kirjautuminen vahvistettu",
      detail: "Voit nyt siirtyä työtiloihin.",
    },
    expired: {
      label: "Kirjautumisyritys päättyi",
      detail:
        "Tämä koodi ei ole enää käytössä. Kirjautumisen tulosta ei tiedetä. Voit aloittaa uudella koodilla.",
    },
    interrupted: {
      label: "Kirjautuminen keskeytyi",
      detail: "Tarkista kirjautumisen tila ennen uutta yritystä.",
    },
    failed: {
      label: "Kirjautuminen epäonnistui",
      detail:
        "Yritä uudelleen uudella koodilla. Jos virhe toistuu, ota yhteyttä ylläpitäjään.",
    },
    unavailable: {
      label: "Kirjautuminen keskeytyi",
      detail: "Tilaa ei voitu tarkistaa. Yritä tarkistaa se uudelleen.",
    },
  },
  copied: "Koodi kopioitu leikepöydälle.",
  copyFailed: "Kopiointi ei onnistunut. Valitse ja kopioi koodi käsin.",
  hint: "Kirjautuminen tehdään OpenAI:n omalla sivulla. Salasanaa ei syötetä tänne.",
  label: "ChatGPT-kirjautuminen",
  eyebrow: "Käyttöönotto",
  title: "Kirjaudu OpenAI-tiliisi",
  checking: "Tarkistetaan tilaa",
  step1: "Kopioi koodi",
  copyCode: "Kopioi koodi",
  step2: "Syötä koodi OpenAI:n sivulla",
  openPage: "Avaa OpenAI:n vahvistussivu (uusi välilehti)",
  step3: "Palaa tänne ja odota",
  waiting: "Odotetaan vahvistusta OpenAI:lta",
  autoRefresh: "Sivu päivittyy automaattisesti, kun kirjaudut sisään.",
  unsafe:
    "Vahvistussivua tai koodia ei voi näyttää turvallisesti. Pyydä uusi kirjautumisyritys.",
  interrupted: "Kirjautuminen keskeytyi",
  unconfirmed: "Tilaa ei voitu vahvistaa",
  checkingServer: "Tarkistetaan palvelimen tilaa.",
  check: "Tarkista tila",
  cancel: "Peruuta kirjautumisyritys",
  start: "Aloita kirjautuminen",
  retry: "Aloita uusi yritys",
  back: "Takaisin valitsemaan GitHub-repoja",
};

export const piDeviceSignInText = catalog(fi, {
  outcomes: {
    waiting: {
      label: "Preparing the sign-in",
      detail: "Preparing a confirmation code. One moment.",
    },
    cancelling: {
      label: "Cancelling the sign-in attempt",
      detail: "One moment.",
    },
    start: {
      label: "ChatGPT sign-in needed",
      detail: "Sign in to your ChatGPT account to start working in workspaces.",
    },
    connected: {
      label: "ChatGPT sign-in confirmed",
      detail: "You can now go to your workspaces.",
    },
    expired: {
      label: "The sign-in attempt ended",
      detail:
        "This code is no longer valid. It is not known whether the sign-in went through. You can start again with a new code.",
    },
    interrupted: {
      label: "The sign-in was interrupted",
      detail: "Check the sign-in status before trying again.",
    },
    failed: {
      label: "The sign-in failed",
      detail:
        "Try again with a new code. If the error keeps happening, contact your administrator.",
    },
    unavailable: {
      label: "The sign-in was interrupted",
      detail: "The status could not be checked. Try checking it again.",
    },
  },
  copied: "Code copied to the clipboard.",
  copyFailed: "Copying did not work. Select and copy the code by hand.",
  hint: "You sign in on OpenAI's own page. No password is entered here.",
  label: "ChatGPT sign-in",
  eyebrow: "Getting started",
  title: "Sign in to your OpenAI account",
  checking: "Checking the status",
  step1: "Copy the code",
  copyCode: "Copy code",
  step2: "Enter the code on OpenAI's page",
  openPage: "Open OpenAI's confirmation page (new tab)",
  step3: "Come back here and wait",
  waiting: "Waiting for confirmation from OpenAI",
  autoRefresh: "This page updates by itself once you have signed in.",
  unsafe:
    "The confirmation page or code cannot be shown safely. Start a new sign-in attempt.",
  interrupted: "The sign-in was interrupted",
  unconfirmed: "The status could not be confirmed",
  checkingServer: "Checking the server's status.",
  check: "Check status",
  cancel: "Cancel the sign-in attempt",
  start: "Start signing in",
  retry: "Start a new attempt",
  back: "Back to choosing GitHub repositories",
});
