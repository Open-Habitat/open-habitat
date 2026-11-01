# text/guide.ts

Generated from web/src/text/guide.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// A start-page goal's guide: the panel beside the conversation
// (components/GuidePanel.tsx) and its toggle in the conversation's header
// (app/ViewHost.tsx).
const fi = {
  guide: "Opas",
  guideFor: (title: string) => `Opas: ${title}`,
  eyebrow: (page: string) => `OPAS · ${page}`,
  close: "Sulje opas",
  show: "Näytä opas",
  hide: "Piilota opas",
  steps: "Näin etenet",
  outcome: "Mitä saat",
  note: "Ohje, ei agentin edistyminen: Habitat ei tiedä, missä vaiheessa agentti on.",
  allGoals: "← Kaikki tavoitteet",
  guideEyebrow: "OPAS",
};

export const guideText = catalog(fi, {
  guide: "Guide",
  guideFor: (title) => `Guide: ${title}`,
  eyebrow: (page) => `GUIDE · ${page}`,
  close: "Close guide",
  show: "Show guide",
  hide: "Hide guide",
  steps: "How it goes",
  outcome: "What you get",
  note: "Instructions, not the agent's progress: Habitat does not know which step the agent is at.",
  allGoals: "← All goals",
  guideEyebrow: "GUIDE",
});

```
