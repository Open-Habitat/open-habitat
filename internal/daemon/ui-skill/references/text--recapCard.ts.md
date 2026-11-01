# text/recapCard.ts

Generated from web/src/text/recapCard.ts; do not edit.

```tsx
import type { RecapFailureReason } from "../app/conversations";
import { catalog } from "../i18n";

// The recap card at the top of a conversation (components/RecapCard.tsx).
const fi = {
  // Why no recap was written, in words the person can act on. Every reason
  // the daemon reports has one, so a failure never shows as silence.
  failures: {
    no_message: "Keskustelussa ei ole vielä viestejä.",
    no_model: "Katsaukselle ei löytynyt mallia, johon on kirjautuminen.",
    model_error: "Malli ei vastannut katsauspyyntöön.",
    model_timeout: "Malli ei vastannut ajoissa.",
    model_incomplete: "Mallin vastaus jäi kesken.",
    invalid_response: "Mallin vastauksesta ei saatu katsausta.",
    superseded: "Keskustelu jatkui ennen kuin katsaus valmistui.",
    busy: "Edellinen katsaus on vielä tekeillä.",
    write_failed: "Katsausta ei voitu tallentaa keskusteluun.",
    history_unavailable: "Keskustelun historiaa ei voitu lukea.",
    command_unavailable: "Agentti ei tarjonnut katsaustoimintoa.",
    controller_unavailable: "Yhteys agenttiin katkesi kesken katsauksen.",
    outcome_unknown: "Katsauksen tulosta ei saatu agentilta.",
    not_written: "Katsaus ei tallentunut keskusteluun.",
  } satisfies Record<RecapFailureReason, string>,
  // What to do instead of a plain retry, where retrying alone may not help.
  timeoutAction:
    "Yritä hetken päästä uudelleen. Jos tämä toistuu, valitse katsaukselle nopeampi malli asetuksista.",
  unavailable: "Yhteys tai ohjaus ei ole käytettävissä.",
  pending: "Katsausta luodaan.",
  label: "Keskustelun yhteenveto",
  heading: "Tilannekatsaus",
  refresh: "Päivitä katsaus",
  create: "Luo katsaus",
  settings: "Tilannekatsauksen asetukset",
  dismiss: "Sulje katsaus",
  creating: "Luodaan katsausta",
  next: "Seuraavaksi",
  empty: "Pyydä lyhyt katsaus ennen kuin jatkat.",
  unverifiable: "Katsausta ei voitu tarkistaa. Lataa sivu uudelleen.",
  uncertain:
    "Luonnin tulos ei ole tiedossa. Tarkista katsaus lataamalla sivu uudelleen.",
  failed: "Katsausta ei voitu luoda.",
  retry: "Yritä uudelleen.",
};

export const recapCardText = catalog(fi, {
  failures: {
    no_message: "The conversation has no messages yet.",
    no_model: "No model you are signed in to was found for the recap.",
    model_error: "The model did not answer the recap request.",
    model_timeout: "The model did not answer in time.",
    model_incomplete: "The model's answer was cut short.",
    invalid_response: "No recap could be made from the model's answer.",
    superseded: "The conversation moved on before the recap was ready.",
    busy: "The previous recap is still being made.",
    write_failed: "The recap could not be saved in the conversation.",
    history_unavailable: "The conversation's history could not be read.",
    command_unavailable: "The agent did not offer a recap.",
    controller_unavailable:
      "The connection to the agent was lost during the recap.",
    outcome_unknown: "The agent did not report the recap's outcome.",
    not_written: "The recap was not saved in the conversation.",
  },
  timeoutAction:
    "Try again in a moment. If this keeps happening, choose a faster model for recaps in Settings.",
  unavailable: "The connection or control is not available.",
  pending: "Making the recap.",
  label: "Conversation recap",
  heading: "Recap",
  refresh: "Refresh recap",
  create: "Make a recap",
  settings: "Recap settings",
  dismiss: "Close recap",
  creating: "Making the recap",
  next: "Next",
  empty: "Ask for a short recap before you continue.",
  unverifiable: "The recap could not be checked. Reload the page.",
  uncertain:
    "It is not known whether the recap was made. Reload the page to check.",
  failed: "The recap could not be made.",
  retry: "Try again.",
});

```
