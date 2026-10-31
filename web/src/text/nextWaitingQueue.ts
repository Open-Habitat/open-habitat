import { catalog } from "../i18n";

// The round through waiting conversations (components/NextWaitingQueue.tsx).
const fi = {
  label: "Odottavat keskustelut",
  handled: (done: number, total: number) => `${done}/${total} hoidettu`,
  previous: "Edellinen",
  next: "Seuraava",
  backToOrigin: "Takaisin lähtöön",
  toOrigin: "Lähtöön",
  origin: "Lähtö",
  end: "Lopeta kierros",
};

export const nextWaitingQueueText = catalog(fi, {
  label: "Waiting conversations",
  handled: (done, total) => `${done}/${total} handled`,
  previous: "Previous",
  next: "Next",
  backToOrigin: "Back to where you started",
  toOrigin: "Back",
  origin: "Start",
  end: "End the round",
});
