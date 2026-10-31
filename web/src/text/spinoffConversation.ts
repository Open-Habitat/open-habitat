import { catalog } from "../i18n";

// A worker's conversation (app/SpinoffConversation.tsx): why its pull
// request facts are missing.
const fi = {
  prSignedOut:
    "PR-tiedot puuttuvat, koska gh ei ole kirjautunut GitHubiin. Muutokset näkyvät silti.",
  prUnavailable: "PR-tietoja ei saatu gh:lta. Muutokset näkyvät silti.",
};

export const spinoffConversationText = catalog(fi, {
  prSignedOut:
    "Pull request details are missing because gh is not signed in to GitHub. The changes are shown anyway.",
  prUnavailable:
    "Pull request details could not be read from gh. The changes are shown anyway.",
});
