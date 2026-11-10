// Round 2's words on top of round 1's vocabulary, in both review languages.
import { TEXT as R1 } from "../2026-11-10-vuoron-muutokset/text";

const fi = {
  ...R1.fi,
  soFarLine: "tähän mennessä",
  more: (n: number) => `+${n} muuta`,
  showChanges: "Näytä vuoron muutokset",
  timelineButton: "Aikajana",
  timelineOn: "Näytä muutokset vuoron aikajanalla",
  title: "Vuoron muutokset · kierros 2",
};

const en: typeof fi = {
  ...R1.en,
  soFarLine: "so far",
  more: (n) => `+${n} more`,
  showChanges: "Show the turn's changes",
  timelineButton: "Timeline",
  timelineOn: "Show the changes on the turn's timeline",
  title: "Turn changes · round 2",
};

export type Text = typeof fi;
export const TEXT = { fi, en };
