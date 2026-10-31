import { catalog } from "../i18n";

// The round through waiting conversations (components/NextWaitingQueue.tsx).
const fi = {
  label: "Odottavat keskustelut",
  handled: (done: number, total: number) => `${done}/${total} hoidettu`,
  previous: "Edellinen",
  next: "Seuraava",
  finishTitle: "Päätä kierros tähän",
  finish: "Valmis",
  end: "Lopeta kierros",
};

export const nextWaitingQueueText = catalog(fi, {
  label: "Waiting conversations",
  handled: (done, total) => `${done}/${total} handled`,
  previous: "Previous",
  next: "Next",
  finishTitle: "End the round here",
  finish: "Done",
  end: "End the round",
});
