# text/upgradeNotice.ts

Generated from web/src/text/upgradeNotice.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// An installation upgrade root has announced: the page-wide banner and
// Habitat's line in a conversation whose agent was told
// (components/UpgradeNotice.tsx). Times come in as "14.32" / "14:32".
const fi = {
  countdown: {
    title: (at: string, minutes: number) =>
      minutes <= 1
        ? `Habitat päivitetään klo ${at}, alle minuutin kuluttua`
        : `Habitat päivitetään klo ${at}, noin ${minutes} minuutin kuluttua`,
    detail:
      "Agentit pysähtyvät silloin hetkeksi ja jatkavat päivityksen jälkeen. Luonnoksesi säilyvät, ja voit lähettää viestejä edelleen.",
    short: (at: string) => `Päivitys klo ${at}`,
  },
  starting: {
    title: "Päivitys alkaa",
    detail:
      "Habitat käynnistyy uudelleen muutaman minuutin kuluttua. Sivu yhdistää itse; älä lähetä keskeneräistä viestiä uudestaan.",
  },
  withdrawn: {
    title: "Päivitys peruttiin",
    detail: "Habitat jatkaa nykyisellä versiolla.",
  },
  unknown: {
    title: "Päivityksen tila ei ole tiedossa",
    detail: "Habitat ei juuri nyt tiedä, jatkuuko ilmoitettu päivitys.",
  },
  dismiss: "Sulje",
  // Habitat's line where the agent got the announcement.
  habitat: "Habitat",
  told: (version: string, at: string) =>
    `kertoi agentille päivityksestä versioon ${version} klo ${at}: agentti pysähtyy silloin ja käynnistyy uudelleen.`,
  toldIdle: (version: string, at: string) =>
    `kertoi agentille päivityksestä versioon ${version} klo ${at}, koska sen taustatyöt pysähtyvät silloin:`,
};

export const upgradeNoticeText = catalog(
  fi,
  {
    countdown: {
      title: (at, minutes) =>
        minutes <= 1
          ? `Habitat will be updated at ${at}, in less than a minute`
          : `Habitat will be updated at ${at}, in about ${minutes} minutes`,
      detail:
        "Agents stop briefly then and continue after the update. Your drafts are kept, and you can still send messages.",
      short: (at) => `Update at ${at}`,
    },
    starting: {
      title: "Update starting",
      detail:
        "Habitat restarts in a few minutes. The page reconnects by itself; do not send an unfinished message again.",
    },
    withdrawn: {
      title: "Update canceled",
      detail: "Habitat continues on the current version.",
    },
    unknown: {
      title: "Update status unknown",
      detail:
        "Habitat cannot tell right now whether the announced update goes ahead.",
    },
    dismiss: "Close",
    habitat: "Habitat",
    told: (version, at) =>
      `told the agent about the update to version ${version} at ${at}: the agent stops then and is started again.`,
    toldIdle: (version, at) =>
      `told the agent about the update to version ${version} at ${at}, because its background work stops then:`,
  },
  {
    withdrawn: {
      title: "Update cancelled",
      detail: "Habitat continues on the current version.",
    },
  },
);

```
