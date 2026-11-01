# text/workingProgress.ts

Generated from web/src/text/workingProgress.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// What a working agent is doing (components/WorkingProgress.tsx).
const fi = {
  usingTool: (tool: string) => `Käyttää työkalua ${tool}`,
  usingAnyTool: "Käyttää työkalua",
  toolResult: "Työkalun tulos saapui",
  preparingNext: "Valmistelee seuraavaa vaihetta",
  starting: "Aloittaa työtä",
  waitingNext: "Odottaa agentin seuraavaa vaihetta",
  stopping: "Keskeytystä odotetaan",
  uncertain:
    "Agentin työ keskeytyi tai yhteys siihen katkesi. Historia on luettavissa, mutta työn päättymistä ei voida vahvistaa.",
  progress: "Agentin työn eteneminen",
};

export const workingProgressText = catalog(fi, {
  usingTool: (tool) => `Using the ${tool} tool`,
  usingAnyTool: "Using a tool",
  toolResult: "Tool result arrived",
  preparingNext: "Preparing the next step",
  starting: "Getting started",
  waitingNext: "Waiting for the agent's next step",
  stopping: "Waiting for the stop to take effect",
  uncertain:
    "The agent's work was interrupted or the connection to it was lost. The history can be read, but it cannot be confirmed that the work finished.",
  progress: "Agent's progress",
});

```
