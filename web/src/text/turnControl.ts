import { catalog } from "../i18n";

// The composer row's Nosta / Ei nyt (components/composer/TurnControl.tsx,
// raise-to-your-turn, experimental). The person's daemon keeps the mark, so
// it holds on every device.
const fi = {
  raise: "Nosta",
  raiseTip: "Nosta Sinun vuoroosi. Odottaa siellä, kunnes vastaat.",
  raised: "Sinun vuorossasi",
  raisedLabel: "Sinun vuorossasi. Laske Hiljaisiin",
  notNow: "Ei nyt",
  notNowTip: "Ei nyt: siirrä Hiljaisiin. Palaa, kun agentti vastaa.",
  refused: (reason: string) => `Ei onnistunut: ${reason}`,
};

export const turnControlText = catalog(fi, {
  raise: "Raise",
  raiseTip: "Raise to Your turn. It waits there until you reply.",
  raised: "Your turn",
  raisedLabel: "Your turn. Lower to Quiet",
  notNow: "Not now",
  notNowTip: "Not now: move to Quiet. It returns when the agent replies.",
  refused: (reason) => `Did not work: ${reason}`,
});
